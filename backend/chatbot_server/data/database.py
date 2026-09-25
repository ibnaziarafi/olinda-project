"""Chat persistence and feedback storage."""
import sqlite3
import uuid
from datetime import datetime, timezone
from core.config import DB_PATH, SUPABASE_URL, SUPABASE_KEY

supabase_client = None
is_placeholder_url = not SUPABASE_URL or any(p in SUPABASE_URL for p in ("your-project-ref", "your_supabase", "example.com", "YOUR_"))
if SUPABASE_URL and SUPABASE_KEY and not is_placeholder_url:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"Supabase client initialized for {SUPABASE_URL}")
    except Exception as e:
        raise RuntimeError(f"Supabase is configured but could not be initialized: {e}") from e

USING_SUPABASE = supabase_client is not None


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    if USING_SUPABASE:
        return
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS message_feedback (
            message_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            rating TEXT NOT NULL CHECK (rating IN ('like', 'dislike')),
            created_at TEXT NOT NULL
        );
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

        """
    )
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


def log_unanswered(question: str, score: float, conn):
    item_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    if supabase_client:
        try:
            supabase_client.table("unanswered_log").insert({
                "id": item_id,
                "question": question,
                "confidence_score": score,
                "occurred_at": now_iso,
                "reviewed": False,
            }).execute()
        except Exception as e:
            raise RuntimeError(f"Supabase unanswered log failed: {e}") from e
    else:
        conn.execute(
            "INSERT INTO unanswered_log (id, question, confidence_score, occurred_at, reviewed) VALUES (?, ?, ?, ?, 0)",
            (item_id, question, score, now_iso),
        )
        conn.commit()


def log_message(session_id: str, user_message: str, bot_reply: str, score: float, escalated: bool, conn):
    now_iso = datetime.now(timezone.utc).isoformat()
    msg_id = str(uuid.uuid4())
    if supabase_client:
        try:
            supabase_client.table("sessions").upsert({"session_id": session_id, "started_at": now_iso}).execute()
            supabase_client.table("messages").insert({
                "message_id": msg_id,
                "session_id": session_id,
                "user_message": user_message,
                "bot_reply": bot_reply,
                "confidence_score": score,
                "escalated": escalated,
                "created_at": now_iso,
            }).execute()
        except Exception as e:
            raise RuntimeError(f"Supabase message logging failed: {e}") from e
    else:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (session_id, started_at) VALUES (?, ?)",
            (session_id, now_iso),
        )
        conn.execute(
            """INSERT INTO messages
               (message_id, session_id, user_message, bot_reply, confidence_score, escalated, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (msg_id, session_id, user_message, bot_reply, score, int(escalated), now_iso),
        )
        conn.commit()
    return msg_id


def save_feedback(message_id: str, session_id: str, rating: str, conn) -> bool:
    """One changeable vote per answer, restricted to its owning session."""
    now = datetime.now(timezone.utc).isoformat()
    row = {"message_id": message_id, "session_id": session_id,
           "rating": rating, "created_at": now}
    if supabase_client:
        message = (supabase_client.table("messages").select("message_id")
                   .eq("message_id", message_id).eq("session_id", session_id).execute())
        if not message.data:
            return False
        supabase_client.table("message_feedback").upsert(row, on_conflict="message_id").execute()
    else:
        message = conn.execute(
            "SELECT message_id FROM messages WHERE message_id = ? AND session_id = ?",
            (message_id, session_id),
        ).fetchone()
        if not message:
            return False
        conn.execute(
            """INSERT INTO message_feedback (message_id, session_id, rating, created_at)
               VALUES (?, ?, ?, ?) ON CONFLICT(message_id) DO UPDATE SET
               rating=excluded.rating, created_at=excluded.created_at""",
            (message_id, session_id, rating, now),
        )
        conn.commit()
    return True
