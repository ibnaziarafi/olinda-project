-- Reference schema for Olinda's database (SQLite).
-- main.py creates these automatically on first run — this file is here for
-- documentation / your project report, not something you need to run by hand.

CREATE TABLE course_chunks (
    chunk_id     TEXT PRIMARY KEY,
    content      TEXT NOT NULL,
    embedding    TEXT NOT NULL,   -- JSON-encoded list of floats (768 dims, gemini-embedding-001)
    subject_code TEXT,
    tasc_level   TEXT,            -- '2', '3', '4'
    career_field TEXT,            -- e.g. 'health', 'trades', 'business'
    doc_type     TEXT,            -- 'course_guide' | 'faq' | 'tasc_standard'
    source_file  TEXT
);

CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    started_at TEXT
);

CREATE TABLE messages (
    message_id       TEXT PRIMARY KEY,
    session_id       TEXT,
    user_message     TEXT,
    bot_reply        TEXT,
    confidence_score REAL,
    escalated        INTEGER DEFAULT 0,
    created_at       TEXT
);

-- The staff-facing goldmine: every question Olinda wasn't confident about.
-- Group/count these weekly to see what's missing from the course guide/FAQ.
CREATE TABLE unanswered_log (
    id                TEXT PRIMARY KEY,
    question          TEXT,
    confidence_score  REAL,
    occurred_at       TEXT,
    reviewed          INTEGER DEFAULT 0
);

-- If you outgrow SQLite later (e.g. want a hosted, multi-writer setup),
-- swap to Postgres + pgvector: same table shapes, but `embedding` becomes
-- a native VECTOR(384) column instead of a JSON string.
