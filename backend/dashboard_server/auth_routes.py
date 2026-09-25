"""
Olinda Dashboard Management System Service — Dedicated FastAPI Server for Staff Management Portal.
Default Port: 8001
"""

import os
import json
import uuid
import shutil
import time
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware

from service import (
    init_db, get_db, supabase_client, USING_SUPABASE, supabase_count, supabase_write_with_fallback,
    STAFF_USERS, _resolve_login, _LOGIN_FAILS, LOGIN_MAX_FAILS, LOGIN_LOCKOUT_SECONDS,
    make_token, get_current_staff, require_admin, load_db_users, add_db_user,
    set_db_user_password, remove_db_user, verify_password,
    LoginRequest, NewStaffRequest, ChangePasswordRequest, ResolveUnansweredRequest, IngestTextRequest
)
from ingestion import ingest_file, chunk_text, embed_chunks

router = APIRouter()

@router.post("/api/login")
def login(req: LoginRequest):
    username = (req.username or "").strip().lower()
    password = req.password or ""

    rec = _LOGIN_FAILS.get(username)
    if rec and rec["count"] >= LOGIN_MAX_FAILS and (time.time() - rec["first"]) < LOGIN_LOCKOUT_SECONDS:
        wait = int(LOGIN_LOCKOUT_SECONDS - (time.time() - rec["first"]))
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {wait} seconds.")

    identity = _resolve_login(username, password)
    if not identity:
        rec = _LOGIN_FAILS.get(username)
        if not rec or (time.time() - rec["first"]) >= LOGIN_LOCKOUT_SECONDS:
            _LOGIN_FAILS[username] = {"count": 1, "first": time.time()}
        else:
            rec["count"] += 1
        raise HTTPException(status_code=401, detail="Invalid username or password")

    _LOGIN_FAILS.pop(username, None)
    token = make_token(username, identity["name"], identity["role"])
    return {"token": token, "name": identity["name"], "username": username, "role": identity["role"]}

@router.get("/api/me")
def get_me(staff: dict = Depends(get_current_staff)):
    return {"username": staff["username"], "name": staff["name"], "role": staff.get("role", "user")}

@router.post("/api/me/password")
def change_my_password(req: ChangePasswordRequest, staff: dict = Depends(get_current_staff)):
    username = staff["username"]
    current = req.current_password or ""
    new = req.new_password or ""

    if username in STAFF_USERS:
        raise HTTPException(status_code=400, detail="This is a built-in account; its password is set on the server (STAFF_USERS).")

    db_user = load_db_users().get(username)
    if not db_user:
        raise HTTPException(status_code=404, detail="Account not found.")
    if not verify_password(current, db_user["salt"], db_user["pw_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    if len(new) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    if new == current:
        raise HTTPException(status_code=400, detail="New password must be different from the current one.")
    if new.lower() == username.lower():
        raise HTTPException(status_code=400, detail="Password must not be the same as your username.")

    set_db_user_password(username, new)
    return {"status": "success"}

@router.get("/api/staff")
def list_staff(admin: dict = Depends(require_admin)):
    out = []
    for uname, info in STAFF_USERS.items():
        out.append({"username": uname, "name": info["name"], "role": info.get("role", "admin"), "builtin": True, "removable": False})
    for uname, info in load_db_users().items():
        out.append({"username": uname, "name": info["name"], "role": info.get("role", "user"), "builtin": False, "removable": True})
    return out

@router.post("/api/staff")
def create_staff(req: NewStaffRequest, admin: dict = Depends(require_admin)):
    uname = (req.username or "").strip().lower()
    name = (req.name or "").strip()
    password = req.password or ""
    role = (req.role or "user").strip().lower()

    if not uname or not uname.isalnum():
        raise HTTPException(status_code=400, detail="Username must contain only letters and numbers.")
    if not name:
        raise HTTPException(status_code=400, detail="Display name is required.")
    if role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if password.lower() == uname:
        raise HTTPException(status_code=400, detail="Password must not be the same as the username.")
    if uname in STAFF_USERS or uname in load_db_users():
        raise HTTPException(status_code=409, detail="That username already exists.")

    add_db_user(uname, name, password, role, admin["name"])
    return {"status": "success", "username": uname, "name": name, "role": role, "added_by": admin["name"]}

@router.delete("/api/staff/{username}")
def delete_staff(username: str, admin: dict = Depends(require_admin)):
    uname = (username or "").strip().lower()
    if uname in STAFF_USERS:
        raise HTTPException(status_code=400, detail="Built-in accounts can't be removed from here.")
    if uname == admin.get("username"):
        raise HTTPException(status_code=400, detail="You can't remove your own account.")
    db_users = load_db_users()
    if uname not in db_users:
        raise HTTPException(status_code=404, detail="User not found.")
    if db_users[uname].get("role") != "user":
        env_admins = sum(1 for u in STAFF_USERS.values() if u.get("role", "admin") == "admin")
        db_admins = sum(1 for u in db_users.values() if u.get("role") == "admin")
        if env_admins + db_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last administrator.")
    remove_db_user(uname)
    return {"status": "deleted", "username": uname}
