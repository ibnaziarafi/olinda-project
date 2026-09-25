"""Dashboard environment configuration."""
import os
from dotenv import load_dotenv
load_dotenv()

DB_PATH = os.getenv("OLINDA_DB_PATH", "olinda.db")
MAX_RECENT_MESSAGES = int(os.getenv("MAX_RECENT_MESSAGES", "4"))
MAX_SUMMARY_WORDS = 300
MAX_SUMMARY_TOKENS = int(os.getenv("MAX_SUMMARY_TOKENS", "400"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
STUDENT_SERVICES_CONTACT = "hobart.college@decyp.tas.gov.au or (03) 6220 3133"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ---------------------------------------------------------------------------
# Staff authentication config
# ---------------------------------------------------------------------------
AUTH_SECRET = os.getenv("AUTH_SECRET", "dev-insecure-secret-change-me")
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", "43200"))


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
    os.getenv("STAFF_USERS", "admin:olinda2027:Hobart College Staff")
)
