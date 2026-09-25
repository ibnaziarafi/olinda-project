"""Compatibility facade for existing scripts."""
from config import STAFF_USERS
from database import init_db, get_db, supabase_client, USING_SUPABASE, supabase_count, supabase_write_with_fallback
from auth import _resolve_login, _LOGIN_FAILS, LOGIN_MAX_FAILS, LOGIN_LOCKOUT_SECONDS, make_token, get_current_staff, require_admin
from staff import load_db_users, add_db_user, set_db_user_password, remove_db_user
from passwords import verify_password
from models import LoginRequest, NewStaffRequest, ChangePasswordRequest, ResolveUnansweredRequest, IngestTextRequest
