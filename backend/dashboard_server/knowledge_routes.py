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

@router.post("/api/unanswered/resolve")
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

@router.get("/api/chunks")
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

@router.delete("/api/chunks/{chunk_id}")
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

@router.post("/api/ingest-text")
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

@router.post("/api/upload-file")
async def upload_file_api(
    file: UploadFile = File(...),
    doc_type: str = Form("course_guide"),
    staff: dict = Depends(get_current_staff),
):
    temp_dir = Path("temp_uploads")
    temp_dir.mkdir(exist_ok=True)
    file_path = temp_dir / (uuid.uuid4().hex + Path(file.filename or "upload").suffix)

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
