"""Staff account persistence."""
from datetime import datetime, timezone
from fastapi import HTTPException
from database import get_db, supabase_client, USING_SUPABASE, supabase_write_with_fallback
from passwords import hash_password

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
            raise RuntimeError(f"Supabase staff_users load failed: {e}") from e
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
            print(f"Supabase staff_users insert failed: {e}")

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
            print(f"Supabase staff_users password update failed: {e}")
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
            print(f"Supabase staff_users delete failed: {e}")
    if not USING_SUPABASE:
        conn = get_db()
        conn.execute("DELETE FROM staff_users WHERE username = ?", (username,))
        conn.commit()
        conn.close()
    if supabase_client and not supa_ok:
        raise HTTPException(status_code=502, detail="Could not remove the account from the persistent database.")
