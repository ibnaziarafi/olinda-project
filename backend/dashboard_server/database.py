"""Dashboard schema and database access."""
import sqlite3
from config import DB_PATH, SUPABASE_URL, SUPABASE_KEY

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
