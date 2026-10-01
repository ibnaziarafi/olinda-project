"""
Olinda Dashboard Management System Service — Dedicated FastAPI Server for Staff Management Portal.
Default Port: 8001
"""

import os
import json
import uuid
import shutil
import time
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
if __package__:
    from .security import configure_app, ORIGINS, redact_pii

    from .service import (
        init_db, get_db, supabase_client, USING_SUPABASE, supabase_count, supabase_write_with_fallback,
        STAFF_USERS, _resolve_login,
        make_token, get_current_staff, require_admin, load_db_users, add_db_user,
        set_db_user_password, remove_db_user, verify_password,
        LoginRequest, NewStaffRequest, ChangePasswordRequest, ResolveUnansweredRequest, IngestTextRequest
    )
    from .ingestion import ingest_file, chunk_text, embed_chunks
else:
    from security import configure_app, ORIGINS, redact_pii

    from service import (
        init_db, get_db, supabase_client, USING_SUPABASE, supabase_count, supabase_write_with_fallback,
        STAFF_USERS, _resolve_login,
        make_token, get_current_staff, require_admin, load_db_users, add_db_user,
        set_db_user_password, remove_db_user, verify_password,
        LoginRequest, NewStaffRequest, ChangePasswordRequest, ResolveUnansweredRequest, IngestTextRequest
    )
    from ingestion import ingest_file, chunk_text, embed_chunks

app = FastAPI(
    title="Olinda Dashboard Management System Service",
    description="Decoupled microservice for Hobart College staff management portal and knowledge ingestion",
    version="1.0.0",
    docs_url=None, redoc_url=None, openapi_url=None,
)

configure_app(app)
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=False,
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

    identity = _resolve_login(username, password)
    if not identity:
        raise HTTPException(status_code=401, detail="Invalid username or password")

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
    if len(new) < 12:
        raise HTTPException(status_code=400, detail="New password must be at least 12 characters.")
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
    if len(password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters.")
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
            raise HTTPException(status_code=503, detail="Persistent storage operation failed") from e

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
                return [{**row, "question": redact_pii(row["question"])} for row in (result.data or [])]
            except Exception as e:
                print("Persistent storage operation failed")

        raise HTTPException(status_code=503, detail="Supabase unanswered-question query failed")

    conn = get_db()
    rows = conn.execute(
        "SELECT id, question, confidence_score, occurred_at, reviewed, resolved_by FROM unanswered_log ORDER BY occurred_at DESC"
    ).fetchall()
    conn.close()
    return [{**dict(r), "question": redact_pii(r["question"])} for r in rows]


@app.post("/api/unanswered/resolve")
def resolve_unanswered(req: ResolveUnansweredRequest, staff: dict = Depends(require_admin)):
    question = None
    conn = None
    if supabase_client:
        try:
            res = supabase_client.table("unanswered_log").select("question").eq("id", req.id).limit(1).execute()
            if res.data and len(res.data) > 0:
                question = res.data[0].get("question")
        except Exception as e:
            raise HTTPException(status_code=503, detail="Persistent storage operation failed") from e
    else:
        conn = get_db()
        row = conn.execute("SELECT question FROM unanswered_log WHERE id = ?", (req.id,)).fetchone()
        if row:
            question = row["question"]

    if not question:
        if conn:
            conn.close()
        raise HTTPException(status_code=404, detail="Unanswered question item not found")

    combined_knowledge = redact_pii(f"Question: {redact_pii(question)}\nOfficial Answer: {req.answer}")
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
                print("Supabase attribution update requires schema migration")
                supabase_client.table("unanswered_log").update({
                    "reviewed": True,
                    "resolution_chunk_id": chunk_id,
                }).eq("id", req.id).execute()
        except Exception as e:
            raise HTTPException(503, "Could not save the answer; please try again") from None

    return {"status": "success", "chunk_id": chunk_id, "resolved_by": staff_name}


@app.get("/api/chunks")
def get_chunks(limit: int = Query(50, ge=1, le=200), staff: dict = Depends(get_current_staff)):
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
                print("Persistent storage operation failed")
            raise HTTPException(status_code=503, detail="Supabase knowledge-base query failed")

    conn = get_db()
    rows = conn.execute(
        "SELECT chunk_id, content, doc_type, source_file, created_at, added_by FROM course_chunks ORDER BY rowid DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.delete("/api/chunks/{chunk_id}")
def delete_chunk(chunk_id: str, staff: dict = Depends(require_admin)):
    if not USING_SUPABASE:
        conn = get_db()
        conn.execute("DELETE FROM course_chunks WHERE chunk_id = ?", (chunk_id,))
        conn.commit()
        conn.close()

    if supabase_client:
        try:
            supabase_client.table("course_chunks").delete().eq("chunk_id", chunk_id).execute()
        except Exception as e:
            raise HTTPException(status_code=502, detail="Persistent storage operation failed")

    return {"status": "deleted"}


@app.post("/api/ingest-text")
def ingest_text_api(req: IngestTextRequest, staff: dict = Depends(require_admin)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text content cannot be empty")

    staff_name = staff["name"]
    chunks = chunk_text(redact_pii(req.text))
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
                raise HTTPException(status_code=502, detail="Persistent storage operation failed")

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
                raise HTTPException(status_code=502, detail="Persistent storage operation failed")

        added_ids.append(chunk_id)

    if conn:
        conn.commit()
        conn.close()
    return {"status": "success", "chunks_added": len(added_ids), "added_by": staff_name}


@app.post("/api/upload-file")
async def upload_file_api(
    file: UploadFile = File(...),
    doc_type: str = Form("course_guide"),
    staff: dict = Depends(require_admin),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".xlsx", ".csv", ".txt"}:
        raise HTTPException(400, "Supported formats: PDF, XLSX, CSV, TXT")
    if doc_type not in {"course_guide", "faq", "tasc_standard", "excel"}:
        raise HTTPException(400, "Invalid document type")
    try:
        # Never use attacker-controlled filenames as paths; isolate concurrent uploads.
        with tempfile.TemporaryDirectory(prefix="olinda-") as temp_dir:
            file_path = Path(temp_dir) / ("document" + suffix)
            size = 0
            with file_path.open("wb") as buffer:
                while chunk := await file.read(65536):
                    size += len(chunk)
                    if size > 5 * 1024 * 1024:
                        raise HTTPException(413, "File exceeds 5 MiB")
                    buffer.write(chunk)
            if suffix == ".pdf" and file_path.read_bytes()[:5] != b"%PDF-":
                raise HTTPException(400, "Invalid PDF")
            if suffix == ".xlsx":
                with zipfile.ZipFile(file_path) as archive:
                    if sum(item.file_size for item in archive.infolist()) > 20 * 1024 * 1024 or len(archive.infolist()) > 1000:
                        raise HTTPException(413, "Expanded workbook exceeds limits")
            chunks_added = await run_in_threadpool(ingest_file, str(file_path), doc_type=doc_type, added_by=staff["name"])
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_added": chunks_added,
            "added_by": staff["name"],
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="File could not be processed")
    finally:
        await file.close()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DASHBOARD_PORT", os.getenv("PORT", 8001)))
    uvicorn.run(app, host="127.0.0.1", port=port)
