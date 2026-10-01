"""Deployment-local security boundary. Keep both server copies identical."""
import asyncio
import collections
import json
import os
import re
import threading
import time
from urllib.parse import urlsplit
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

load_dotenv(Path(__file__).resolve().parent / ".env")
PRODUCTION = os.getenv("APP_ENV", "production") == "production"
ORIGINS = [v.strip() for v in os.getenv("FRONTEND_ORIGINS", "" if PRODUCTION else
    "http://localhost:3000,http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500").split(",") if v.strip()]
UNANSWERED_LOG_ENABLED = os.getenv("UNANSWERED_LOG_ENABLED", "true").lower() == "true"


def validate_config(chat=False):
    if os.getenv("APP_ENV", "production") not in {"production", "development"}:
        raise RuntimeError("APP_ENV must be production or development")
    if not 1 <= int(os.getenv("MAX_CONCURRENT_REQUESTS", "8")) <= 64:
        raise RuntimeError("MAX_CONCURRENT_REQUESTS must be between 1 and 64")
    if not ORIGINS or any(urlsplit(v).scheme not in ({"https"} if PRODUCTION else {"http", "https"})
            or not urlsplit(v).netloc or urlsplit(v).path or urlsplit(v).query or urlsplit(v).fragment
            or "*" in v or urlsplit(v).username for v in ORIGINS):
        raise RuntimeError("FRONTEND_ORIGINS must contain exact approved origins (HTTPS in production)")
    if PRODUCTION:
        if not os.getenv("SUPABASE_KEY") or not os.getenv("SUPABASE_URL", "").startswith("https://"):
            raise RuntimeError("Production requires HTTPS Supabase; local SQLite is development only")
        import ipaddress
        proxies = os.getenv("FORWARDED_ALLOW_IPS", "")
        if not proxies:
            raise RuntimeError("Configure verified reverse proxy addresses in FORWARDED_ALLOW_IPS")
        for proxy in proxies.split(","):
            ipaddress.ip_network(proxy.strip())  # Reject wildcard proxy trust.
    if not 1 <= int(os.getenv("CHAT_REQUESTS_PER_MINUTE", "15")) <= 1000:
        raise RuntimeError("CHAT_REQUESTS_PER_MINUTE must be between 1 and 1000")
    if not 0 <= int(os.getenv("CHAT_DAILY_REQUEST_LIMIT", "200")) <= 100000:
        raise RuntimeError("CHAT_DAILY_REQUEST_LIMIT must be between 0 and 100000")


def redact_pii(text):
    # Heuristics are deliberately applied to every provider/logging boundary.
    # Names, addresses, and free-form identifying context still need review.
    for pattern in (
        r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+",
        r"(?<![\w-])(?:\d[ -]?){13,19}(?![\w-])",  # Card-shaped numbers.
        r"(?<!\w)(?:\+?61[ ()-]*|\(?0[ ()-]*)[23478](?:[ ()-]*\d){8}(?!\w)",
        r"(?<!\w)\+\d{1,3}(?:[ ().-]*\d){7,14}(?!\w)",
        r"(?<![\w-])\d{8,12}(?![\w-])",  # Numeric student identifiers.
    ):
        text = re.sub(pattern, "[redacted]", text, flags=re.IGNORECASE)
    return text



class RateLimiter:
    def __init__(self):
        self.lock = threading.Lock()
        self.windows = collections.OrderedDict()
        self.supabase = None
        if PRODUCTION:
            from supabase import create_client
            self.supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    async def allowed(self, key, limit, window_seconds=60):
        # Store hashed bucket identifiers rather than raw IP addresses.
        import hashlib
        bucket = int(time.time() // window_seconds)
        key = "olinda:rate:" + hashlib.sha256(key.encode()).hexdigest() + f":{bucket}"
        if self.supabase:
            expires = datetime.fromtimestamp((bucket + 2) * window_seconds, timezone.utc).isoformat()
            result = await run_in_threadpool(self.supabase.rpc("consume_api_quota", {
                "p_bucket_key": key, "p_request_limit": limit, "p_expires_at": expires,
            }).execute)
            return result.data is True
        with self.lock:
            now = time.monotonic()
            while self.windows and next(iter(self.windows.values()))[1] < now:
                self.windows.popitem(last=False)
            if key not in self.windows and len(self.windows) >= 10000:
                return False  # Never evict an active limit to accept an attacker.
            count, expiry = self.windows.get(key, (0, now + window_seconds * 2))
            self.windows[key] = (count + 1, expiry)
            return count < limit


class SecurityMiddleware:
    def __init__(self, app, chat=False):
        self.app, self.chat = app, chat
        self.limiter = RateLimiter()
        self.active = 0
        self.maximum = int(os.getenv("MAX_CONCURRENT_REQUESTS", "8"))

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        start = time.perf_counter()
        response_started = False
        headers = dict(scope["headers"])
        path, method = scope["path"], scope["method"]
        async def secure_send(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                message["headers"] += [(b"x-content-type-options", b"nosniff"),
                    (b"cache-control", b"no-store"), (b"referrer-policy", b"no-referrer"),
                    (b"x-frame-options", b"DENY"),
                    (b"server-timing", f"app;dur={(time.perf_counter()-start)*1000:.1f}".encode())]
                if PRODUCTION:
                    message["headers"].append((b"strict-transport-security", b"max-age=31536000"))
            await send(message)
        async def reject(status, detail):
            response = JSONResponse({"detail": detail}, status_code=status,
                headers={"Retry-After": "60"} if status in (429, 503) else None)
            await response(scope, receive, secure_send)
        if PRODUCTION and scope["scheme"] != "https":
            return await reject(400, "HTTPS required")
        origin = headers.get(b"origin", b"").decode()
        if origin and origin not in ORIGINS:
            return await reject(403, "Origin not permitted")
        if method == "OPTIONS" or path in {"/health", "/"}:
            return await self.app(scope, receive, secure_send)
        ip = (scope.get("client") or ("unknown", 0))[0]
        # Never read X-Forwarded-For here. Only a trusted ASGI proxy may set client.
        limit = int(os.getenv("CHAT_REQUESTS_PER_MINUTE", "15")) if self.chat else (6 if path == "/api/login" else 60)
        try:
            scope_name = "chat" if self.chat else "dashboard"
            if not await self.limiter.allowed(f"{scope_name}:ip:{ip}", limit):
                return await reject(429, "Request limit reached")
        except Exception:
            return await reject(503, "Traffic controls temporarily unavailable")
        if self.active >= self.maximum:
            return await reject(503, "Service busy; try again later")
        self.active += 1
        try:
            if method in {"POST", "PUT", "PATCH"}:
                content_type = headers.get(b"content-type", b"").split(b";")[0].lower()
                expected = b"multipart/form-data" if path == "/api/upload-file" else b"application/json"
                if content_type != expected:
                    return await reject(415, "Unsupported content type")
                maximum = 6 * 1024 * 1024 if expected == b"multipart/form-data" else 128 * 1024
                body = bytearray()
                async def read_body():
                    while True:
                        message = await receive()
                        if message["type"] == "http.disconnect":
                            raise ConnectionError()
                        body.extend(message.get("body", b""))
                        if len(body) > maximum:
                            raise OverflowError()
                        if not message.get("more_body"):
                            return
                try:
                    await asyncio.wait_for(read_body(), timeout=10)
                except OverflowError:
                    return await reject(413, "Request too large")
                except asyncio.TimeoutError:
                    return await reject(408, "Request body timeout")
                except ConnectionError:
                    return
                if path == "/api/login":
                    try:
                        username = json.loads(body).get("username", "")
                        if isinstance(username, str) and not await self.limiter.allowed("login:account:" + username.strip().lower(), 6):
                            return await reject(429, "Request limit reached")
                    except (ValueError, AttributeError):
                        pass  # Validation below returns a generic error.
                    except Exception:
                        return await reject(503, "Traffic controls temporarily unavailable")
                delivered = False
                async def replay():
                    nonlocal delivered
                    if not delivered:
                        delivered = True
                        return {"type": "http.request", "body": bytes(body), "more_body": False}
                    return await receive()
                await self.app(scope, replay, secure_send)
            else:
                await self.app(scope, receive, secure_send)
        except Exception:
            if response_started:
                raise
            await reject(503, "Service temporarily unavailable")
        finally:
            self.active -= 1


def configure_app(app, chat=False):
    validate_config(chat)
    app.add_middleware(SecurityMiddleware, chat=chat)
    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse({"detail": "Invalid request fields or size"}, status_code=422)
    @app.exception_handler(Exception)
    async def unexpected_error(request, error):
        # Provider exceptions can include prompts/secrets. Never return their text.
        return JSONResponse({"detail": "Service temporarily unavailable"}, status_code=503)
