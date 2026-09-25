"""Staff sessions and authorization dependencies."""
import base64
import hashlib
import hmac
import time
from fastapi import HTTPException, Depends, Header
from config import AUTH_SECRET, TOKEN_TTL_SECONDS, STAFF_USERS
from passwords import verify_password
from staff import load_db_users

_LOGIN_FAILS = {}
LOGIN_MAX_FAILS = 6
LOGIN_LOCKOUT_SECONDS = 300

def make_token(username: str, name: str, role: str = "user") -> str:
    exp = int(time.time()) + TOKEN_TTL_SECONDS
    name_b64 = base64.urlsafe_b64encode(name.encode("utf-8")).decode("ascii")
    payload = f"{username}|{name_b64}|{role}|{exp}"
    body = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")
    sig = hmac.new(AUTH_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def verify_token(token: str):
    try:
        body, sig = token.split(".", 1)
        expected = hmac.new(AUTH_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = base64.urlsafe_b64decode(body.encode("ascii")).decode("utf-8")
        username, name_b64, role, exp = payload.split("|", 3)
        if int(exp) < int(time.time()):
            return None
        name = base64.urlsafe_b64decode(name_b64.encode("ascii")).decode("utf-8")
        return {"username": username, "name": name, "role": role}
    except Exception:
        return None


def get_current_staff(authorization: str = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    staff = verify_token(authorization.split(" ", 1)[1].strip())
    if not staff:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
    return staff


def require_admin(staff: dict = Depends(get_current_staff)):
    if staff.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access is required for this action.")
    return staff


def _resolve_login(username: str, password: str):
    user = STAFF_USERS.get(username)
    if user and hmac.compare_digest(str(user["password"]), str(password)):
        return {"name": user["name"], "role": user.get("role", "admin")}
    db_user = load_db_users().get(username)
    if db_user and verify_password(password, db_user["salt"], db_user["pw_hash"]):
        return {"name": db_user["name"], "role": db_user.get("role", "user")}
    return None
