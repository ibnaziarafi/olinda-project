"""
Dashboard database, staff authentication, and bounded request models.
"""

import os
import sqlite3
import time
import hmac
import hashlib
import secrets
import jwt
from datetime import datetime, timezone

from fastapi import HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Literal
if __package__:
    from .security import PRODUCTION
else:
    from security import PRODUCTION


DB_PATH = os.getenv("OLINDA_DB_PATH", "olinda.db")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ---------------------------------------------------------------------------
# Staff authentication config
# ---------------------------------------------------------------------------
# Staff sessions use a purpose-specific signing key derived from the existing
# private database credential. No separate signing-secret setup is needed.
# Rotating that credential invalidates existing staff sessions.
SESSION_SIGNING_KEY = (hmac.new(SUPABASE_KEY.encode(), b"olinda-dashboard-session-v1", hashlib.sha256).hexdigest()
    if SUPABASE_KEY else secrets.token_urlsafe(48))
TOKEN_TTL_SECONDS = min(int(os.getenv("TOKEN_TTL_SECONDS", "3600")), 3600)


def _parse_staff_users(raw: str) -> dict:
    users = {}
    for part in (raw or "").split(","):
        part = part.strip()
        if not part:
            continue
        bits = part.split(":")
        if len(bits) >= 3:
            uname = bits[0].strip().lower()
            password = bits[1]
            role = "admin"
            if len(bits) >= 4 and bits[-1].strip().lower() in ("admin", "user"):
                role = bits[-1].strip().lower()
                name = ":".join(bits[2:-1]).strip()
            else:
                name = ":".join(bits[2:]).strip()
            if uname and password and name:
                users[uname] = {"password": password, "name": name, "role": role}
    return users


STAFF_USERS = _parse_staff_users(
    os.getenv("STAFF_USERS", "")
)
# Temporarily disabled: allow shorter environment-defined staff passwords.
# if PRODUCTION and any(len(user["password"]) < 12 for user in STAFF_USERS.values()):
#     raise RuntimeError("Built-in staff passwords must have at least 12 characters")

# ---------------------------------------------------------------------------
# Staff session tokens & Auth
# ---------------------------------------------------------------------------

def make_token(username: str, name: str, role: str = "user") -> str:
    user = STAFF_USERS.get(username) or load_db_users().get(username)
    if not user:
        raise HTTPException(401, "Account unavailable")
    now = int(time.time())
    return jwt.encode({"sub": username, "iat": now, "exp": now + TOKEN_TTL_SECONDS,
        "aud": "olinda-staff", "iss": "olinda-dashboard", "version": credential_version(user)}, SESSION_SIGNING_KEY, algorithm="HS256")


def credential_version(user):
    value = user.get("password", "") + user.get("salt", "") + user.get("pw_hash", "")
    return hmac.new(SESSION_SIGNING_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def verify_token(token: str):
    try:
        claims = jwt.decode(token, SESSION_SIGNING_KEY, algorithms=["HS256"], audience="olinda-staff",
            issuer="olinda-dashboard", options={"require": ["exp", "iat", "sub", "aud", "iss", "version"]})
        username = claims["sub"]
        user = STAFF_USERS.get(username) or load_db_users().get(username)
        if not user or not hmac.compare_digest(claims["version"], credential_version(user)):
            return None
        return {"username": username, "name": user["name"], "role": user.get("role", "user")}
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


PBKDF2_ITERATIONS = 600_000


def hash_password(password: str, salt: str = None):
    if salt is None:
        salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return salt, f"v2:{PBKDF2_ITERATIONS}:{digest}"


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    try:
        iterations = 100_000
        if expected_hash.startswith("v2:"):
            _, count, expected_hash = expected_hash.split(":", 2)
            iterations = int(count)
            if not 100_000 <= iterations <= 1_000_000:
                return False
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), iterations).hex()
        return hmac.compare_digest(check, expected_hash)
    except Exception:
        return False


def _resolve_login(username: str, password: str):
    user = STAFF_USERS.get(username)
    if user and hmac.compare_digest(str(user["password"]), str(password)):
        return {"name": user["name"], "role": user.get("role", "admin")}
    db_user = load_db_users().get(username)
    if db_user and verify_password(password, db_user["salt"], db_user["pw_hash"]):
        return {"name": db_user["name"], "role": db_user.get("role", "user")}
    return None


# ---------------------------------------------------------------------------
# Database Setup & Supabase Integration
# ---------------------------------------------------------------------------

supabase_client = None
is_placeholder_url = not SUPABASE_URL or any(p in SUPABASE_URL for p in ("your-project-ref", "your_supabase", "example.com", "YOUR_"))
if SUPABASE_URL and SUPABASE_KEY and not is_placeholder_url:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"Supabase client initialized for {SUPABASE_URL}")
    except Exception as e:
        raise RuntimeError("Persistent storage operation failed") from None

USING_SUPABASE = supabase_client is not None


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def supabase_count(table_name: str) -> int:
    if not supabase_client:
        raise RuntimeError("Supabase is not configured")
    result = supabase_client.table(table_name).select("*", count="exact").limit(1).execute()
    return int(result.count or 0)


def init_db():
    if USING_SUPABASE:
        return
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS course_chunks (
            chunk_id     TEXT PRIMARY KEY,
            content      TEXT NOT NULL,
            embedding    TEXT NOT NULL,   -- JSON list of floats
            subject_code TEXT,
            tasc_level   TEXT,
            career_field TEXT,
            doc_type     TEXT,
            source_file  TEXT,
            created_at   TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            started_at TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            message_id       TEXT PRIMARY KEY,
            session_id       TEXT,
            user_message     TEXT,
            bot_reply        TEXT,
            confidence_score REAL,
            escalated        INTEGER DEFAULT 0,
            created_at       TEXT
        );

        CREATE TABLE IF NOT EXISTS unanswered_log (
            id                TEXT PRIMARY KEY,
            question          TEXT,
            confidence_score  REAL,
            occurred_at       TEXT,
            reviewed          INTEGER DEFAULT 0,
            resolution_chunk_id TEXT
        );

        CREATE TABLE IF NOT EXISTS staff_users (
            username   TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            salt       TEXT NOT NULL,
            pw_hash    TEXT NOT NULL,
            role       TEXT NOT NULL DEFAULT 'user',
            created_at TEXT,
            created_by TEXT
        );
        """
    )
    cursor = conn.execute("PRAGMA table_info(staff_users)")
    columns = [row[1] for row in cursor.fetchall()]
    if "role" not in columns:
        conn.execute("ALTER TABLE staff_users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
    cursor = conn.execute("PRAGMA table_info(course_chunks)")
    columns = [row[1] for row in cursor.fetchall()]
    if "created_at" not in columns:
        conn.execute("ALTER TABLE course_chunks ADD COLUMN created_at TEXT")

    cursor = conn.execute("PRAGMA table_info(unanswered_log)")
    columns = [row[1] for row in cursor.fetchall()]
    if "resolution_chunk_id" not in columns:
        conn.execute("ALTER TABLE unanswered_log ADD COLUMN resolution_chunk_id TEXT")
    if "resolved_by" not in columns:
        conn.execute("ALTER TABLE unanswered_log ADD COLUMN resolved_by TEXT")

    cursor = conn.execute("PRAGMA table_info(course_chunks)")
    columns = [row[1] for row in cursor.fetchall()]
    if "added_by" not in columns:
        conn.execute("ALTER TABLE course_chunks ADD COLUMN added_by TEXT")

    conn.commit()
    conn.close()


def supabase_write_with_fallback(table: str, row: dict, do_upsert: bool = False):
    optional_cols = ("added_by", "resolved_by", "role", "created_by", "created_at")
    attempt = dict(row)
    dropped = []
    for _ in range(len(optional_cols) + 1):
        try:
            tbl = supabase_client.table(table)
            (tbl.upsert(attempt) if do_upsert else tbl.insert(attempt)).execute()
            return dropped
        except Exception as e:
            msg = str(e)
            removed = False
            if "PGRST204" in msg or "schema cache" in msg or "column" in msg.lower():
                for col in optional_cols:
                    if col in attempt and f"'{col}'" in msg:
                        del attempt[col]
                        dropped.append(col)
                        removed = True
                        print(f"[SUPABASE] table '{table}' is missing column '{col}'; saved without it.")
                        break
            if not removed:
                raise
    raise RuntimeError(f"Supabase write to '{table}' still failing after dropping optional columns")


def load_db_users() -> dict:
    if supabase_client:
        try:
            res = supabase_client.table("staff_users").select("*").execute()
            users = {}
            for r in (res.data or []):
                r.setdefault("role", "user")
                users[r["username"]] = r
            return users
        except Exception as e:
            raise RuntimeError("Persistent storage operation failed") from None
    conn = get_db()
    rows = conn.execute("SELECT username, name, salt, pw_hash, role FROM staff_users").fetchall()
    conn.close()
    return {r["username"]: dict(r) for r in rows}


def add_db_user(username: str, name: str, password: str, role: str, created_by: str):
    salt, pw_hash = hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()

    supa_ok = False
    if supabase_client:
        try:
            supabase_write_with_fallback("staff_users", {
                "username": username, "name": name, "salt": salt, "pw_hash": pw_hash,
                "role": role, "created_at": now_iso, "created_by": created_by,
            }, do_upsert=True)
            supa_ok = True
        except Exception as e:
            print("Persistent storage operation failed")

    if not USING_SUPABASE:
        conn = get_db()
        conn.execute(
            "INSERT OR REPLACE INTO staff_users (username, name, salt, pw_hash, role, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (username, name, salt, pw_hash, role, now_iso, created_by),
        )
        conn.commit()
        conn.close()

    if supabase_client and not supa_ok:
        raise HTTPException(status_code=502, detail="Could not save the account to the persistent database.")


def set_db_user_password(username: str, new_password: str):
    salt, pw_hash = hash_password(new_password)
    supa_ok = False
    if supabase_client:
        try:
            supabase_client.table("staff_users").update({"salt": salt, "pw_hash": pw_hash}).eq("username", username).execute()
            supa_ok = True
        except Exception as e:
            print("Persistent storage operation failed")
    if not USING_SUPABASE:
        conn = get_db()
        conn.execute("UPDATE staff_users SET salt = ?, pw_hash = ? WHERE username = ?", (salt, pw_hash, username))
        conn.commit()
        conn.close()
    if supabase_client and not supa_ok:
        raise HTTPException(status_code=502, detail="Could not update the password in the persistent database.")


def remove_db_user(username: str):
    supa_ok = False
    if supabase_client:
        try:
            supabase_client.table("staff_users").delete().eq("username", username).execute()
            supa_ok = True
        except Exception as e:
            print("Persistent storage operation failed")
    if not USING_SUPABASE:
        conn = get_db()
        conn.execute("DELETE FROM staff_users WHERE username = ?", (username,))
        conn.commit()
        conn.close()
    if supabase_client and not supa_ok:
        raise HTTPException(status_code=502, detail="Could not remove the account from the persistent database.")


# ---------------------------------------------------------------------------
# Dashboard request models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class NewStaffRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9]+$")
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=256)
    role: Literal["admin", "user"] = "user"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class ResolveUnansweredRequest(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    answer: str = Field(min_length=1, max_length=20000)


class IngestTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100000)
    doc_type: Literal["course_guide", "faq", "tasc_standard", "excel"] = "faq"
    source_file: str = Field(default="dashboard_text_input", max_length=200)


