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

@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "dashboard_server",
        "db": "supabase" if supabase_client else "sqlite"
    }

@router.get("/")
def service_info():
    return {
        "service": "dashboard_server",
        "message": "Dashboard API is running. Host the dashboard frontend separately.",
        "health": "/health",
    }

@router.get("/api/analytics")
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

@router.get("/api/unanswered")
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
