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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware

from service import (
    init_db, get_db, supabase_client, USING_SUPABASE, supabase_count, supabase_write_with_fallback,
    STAFF_USERS, _resolve_login, _LOGIN_FAILS, LOGIN_MAX_FAILS, LOGIN_LOCKOUT_SECONDS,
    make_token, get_current_staff, require_admin, load_db_users, add_db_user,
    set_db_user_password, remove_db_user, verify_password,
    LoginRequest, NewStaffRequest, ChangePasswordRequest, ResolveUnansweredRequest, IngestTextRequest
)
from ingestion import ingest_file, chunk_text, embed_chunks

init_db()

app = FastAPI(
    title="Olinda Dashboard Management System Service",
    description="Decoupled microservice for Hobart College staff management portal and knowledge ingestion",
    version="1.0.0"
)

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "https://olinda.rafistacks.dev,https://portal-olinda.rafistacks.dev,https://olinda-ai.vercel.app,http://localhost:3000,http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "dashboard_server",
        "db": "supabase" if supabase_client else "sqlite"
    }


@app.get("/")
def service_info():
    return {
        "service": "dashboard_server",
        "message": "Dashboard API is running. Host the dashboard frontend separately.",
        "health": "/health",
    }


# ---------------------------------------------------------------------------
# Staff Authentication APIs
# ---------------------------------------------------------------------------

@app.post("/api/login")
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


@app.get("/api/me")
def get_me(staff: dict = Depends(get_current_staff)):
    return {"username": staff["username"], "name": staff["name"], "role": staff.get("role", "user")}


@app.post("/api/me/password")
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


# ---------------------------------------------------------------------------
# Staff Management APIs (Admins only)
# ---------------------------------------------------------------------------

@app.get("/api/staff")
def list_staff(admin: dict = Depends(require_admin)):
    out = []
    for uname, info in STAFF_USERS.items():
        out.append({"username": uname, "name": info["name"], "role": info.get("role", "admin"), "builtin": True, "removable": False})
    for uname, info in load_db_users().items():
        out.append({"username": uname, "name": info["name"], "role": info.get("role", "user"), "builtin": False, "removable": True})
    return out


@app.post("/api/staff")
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


@app.delete("/api/staff/{username}")
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


# ---------------------------------------------------------------------------
# Staff Dashboard Analytics & Unanswered Queue APIs
# ---------------------------------------------------------------------------

@app.get("/api/analytics")
def get_analytics(staff: dict = Depends(get_current_staff)):
    if supabase_client:
        try:
            return {
                "total_messages": supabase_count("messages"),
                "unanswered_count": int(
                    supabase_client.table("unanswered_log")
                    .select("*", count="exact")
                    .eq("reviewed", False)
                    .limit(1)
                    .execute()
                    .count
                    or 0
                ),
                "escalated_count": int(
                    supabase_client.table("messages")
                    .select("*", count="exact")
                    .eq("escalated", True)
                    .limit(1)
                    .execute()
                    .count
                    or 0
                ),
                "knowledge_chunks": supabase_count("course_chunks"),
            }
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Supabase analytics query failed: {e}") from e

    if USING_SUPABASE:
        raise HTTPException(status_code=503, detail="Supabase is unavailable")

    conn = get_db()
    total_messages = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    unanswered_count = conn.execute("SELECT COUNT(*) FROM unanswered_log WHERE reviewed = 0").fetchone()[0]
    escalated_count = conn.execute("SELECT COUNT(*) FROM messages WHERE escalated = 1").fetchone()[0]
    total_chunks = conn.execute("SELECT COUNT(*) FROM course_chunks").fetchone()[0]
    conn.close()

    return {
        "total_messages": total_messages,
        "unanswered_count": unanswered_count,
        "escalated_count": escalated_count,
        "knowledge_chunks": total_chunks,
    }


@app.get("/api/unanswered")
def get_unanswered(staff: dict = Depends(get_current_staff)):
    if supabase_client:
        for cols in (
            "id,question,confidence_score,occurred_at,reviewed,resolved_by",
            "id,question,confidence_score,occurred_at,reviewed",
        ):
            try:
                result = (
                    supabase_client.table("unanswered_log")
                    .select(cols)
                    .order("occurred_at", desc=True)
                    .execute()
                )
                return result.data or []
            except Exception as e:
                print(f"Supabase unanswered select '{cols}' failed: {e}")

        raise HTTPException(status_code=503, detail="Supabase unanswered-question query failed")

    conn = get_db()
    rows = conn.execute(
        "SELECT id, question, confidence_score, occurred_at, reviewed, resolved_by FROM unanswered_log ORDER BY occurred_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/unanswered/resolve")
def resolve_unanswered(req: ResolveUnansweredRequest, staff: dict = Depends(get_current_staff)):
    question = None
    conn = None
    if supabase_client:
        try:
            res = supabase_client.table("unanswered_log").select("question").eq("id", req.id).limit(1).execute()
            if res.data and len(res.data) > 0:
                question = res.data[0].get("question")
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Supabase question lookup failed: {e}") from e
    else:
        conn = get_db()
        row = conn.execute("SELECT question FROM unanswered_log WHERE id = ?", (req.id,)).fetchone()
        if row:
            question = row["question"]

    if not question:
        if conn:
            conn.close()
        raise HTTPException(status_code=404, detail="Unanswered question item not found")

    combined_knowledge = f"Question: {question}\nOfficial Answer: {req.answer}"
    staff_name = staff["name"]

    embeddings = embed_chunks([combined_knowledge])
    chunk_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    if conn:
        conn.execute(
            """INSERT INTO course_chunks (chunk_id, content, embedding, doc_type, source_file, created_at, added_by)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (chunk_id, combined_knowledge, json.dumps(embeddings[0]), "staff_faq", "staff_dashboard", now_iso, staff_name),
        )
        conn.execute(
            "UPDATE unanswered_log SET reviewed = 1, resolution_chunk_id = ?, resolved_by = ? WHERE id = ?",
            (chunk_id, staff_name, req.id),
        )
        conn.commit()
        conn.close()

    if supabase_client:
        try:
            supabase_write_with_fallback("course_chunks", {
                "chunk_id": chunk_id,
                "content": combined_knowledge,
                "embedding": embeddings[0],
                "doc_type": "staff_faq",
                "source_file": "staff_dashboard",
                "added_by": staff_name,
            })
            try:
                supabase_client.table("unanswered_log").update({
                    "reviewed": True,
                    "resolution_chunk_id": chunk_id,
                    "resolved_by": staff_name,
                }).eq("id", req.id).execute()
            except Exception as e2:
                print(f"Supabase resolved_by update degraded: {e2}")
                supabase_client.table("unanswered_log").update({
                    "reviewed": True,
                    "resolution_chunk_id": chunk_id,
                }).eq("id", req.id).execute()
        except Exception as e:
            print(f"Supabase resolve update warning: {e}")

    return {"status": "success", "chunk_id": chunk_id, "resolved_by": staff_name}


@app.get("/api/chunks")
def get_chunks(limit: int = Query(50, le=200), staff: dict = Depends(get_current_staff)):
    if supabase_client:
        for cols in ("chunk_id,content,doc_type,source_file,created_at,added_by",
                     "chunk_id,content,doc_type,source_file,created_at"):
            try:
                result = (
                    supabase_client.table("course_chunks")
                    .select(cols)
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                return result.data or []
            except Exception as e:
                print(f"Supabase chunks select '{cols}' failed: {e}")
            raise HTTPException(status_code=503, detail="Supabase knowledge-base query failed")

    conn = get_db()
    rows = conn.execute(
        "SELECT chunk_id, content, doc_type, source_file, created_at, added_by FROM course_chunks ORDER BY rowid DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.delete("/api/chunks/{chunk_id}")
def delete_chunk(chunk_id: str, staff: dict = Depends(get_current_staff)):
    if not USING_SUPABASE:
        conn = get_db()
        conn.execute("DELETE FROM course_chunks WHERE chunk_id = ?", (chunk_id,))
        conn.commit()
        conn.close()

    if supabase_client:
        try:
            supabase_client.table("course_chunks").delete().eq("chunk_id", chunk_id).execute()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Persistent database delete failed: {e}")

    return {"status": "deleted"}


@app.post("/api/ingest-text")
def ingest_text_api(req: IngestTextRequest, staff: dict = Depends(get_current_staff)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty")

    staff_name = staff["name"]
    chunks = chunk_text(req.text)
    embeddings = embed_chunks(chunks)
    conn = None if USING_SUPABASE else get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    added_ids = []

    for chunk, embedding in zip(chunks, embeddings):
        source_file = (req.source_file or "dashboard_text_input").strip()

        if supabase_client:
            try:
                existing = (
                    supabase_client.table("course_chunks")
                    .select("chunk_id")
                    .eq("content", chunk)
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    continue
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Persistent database lookup failed: {e}")

        chunk_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"olinda:{req.doc_type}:{source_file}:{chunk}"))
        if conn:
            conn.execute(
                """INSERT OR IGNORE INTO course_chunks (chunk_id, content, embedding, doc_type, source_file, created_at, added_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (chunk_id, chunk, json.dumps(embedding), req.doc_type, source_file, now_iso, staff_name),
            )

        if supabase_client:
            try:
                supabase_write_with_fallback("course_chunks", {
                    "chunk_id": chunk_id,
                    "content": chunk,
                    "embedding": embedding,
                    "doc_type": req.doc_type,
                    "source_file": source_file,
                    "added_by": staff_name,
                }, do_upsert=True)
            except Exception as e:
                if conn:
                    conn.rollback()
                    conn.close()
                raise HTTPException(status_code=502, detail=f"Persistent database insert failed: {e}")

        added_ids.append(chunk_id)

    if conn:
        conn.commit()
        conn.close()
    return {"status": "success", "chunks_added": len(added_ids), "added_by": staff_name}


@app.post("/api/upload-file")
async def upload_file_api(
    file: UploadFile = File(...),
    doc_type: str = Form("course_guide"),
    staff: dict = Depends(get_current_staff),
):
    temp_dir = Path("temp_uploads")
    temp_dir.mkdir(exist_ok=True)
    file_path = temp_dir / file.filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks_added = ingest_file(str(file_path), doc_type=doc_type, added_by=staff["name"])
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_added": chunks_added,
            "added_by": staff["name"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    finally:
        if file_path.exists():
            file_path.unlink()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DASHBOARD_PORT", os.getenv("PORT", 8001)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
