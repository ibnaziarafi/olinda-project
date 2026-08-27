-- ============================================================================
-- Olinda Chatbot — Supabase PostgreSQL + pgvector Schema
-- ============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge Base Table (Course Chunks & Embeddings)
CREATE TABLE IF NOT EXISTS course_chunks (
    chunk_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content      TEXT NOT NULL,
    embedding    VECTOR(768),   -- Gemini embedding-001 dimension size
    subject_code TEXT,
    tasc_level   TEXT,            -- '2', '3', '4'
    career_field TEXT,            -- e.g. 'health', 'trades', 'business'
    doc_type     TEXT,            -- 'course_guide' | 'faq' | 'tasc_standard' | 'excel'
    source_file  TEXT,
    created_at   TIMESTAMPTZ DEFAULT now(),
    added_by     TEXT             -- display name of the staff member who added this chunk
);

-- If the table already exists from an earlier version, add the attribution column:
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS added_by TEXT;

-- 3. Sessions & Messages Logging
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
    message_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
    user_message     TEXT NOT NULL,
    bot_reply        TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.0,
    escalated        BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- 4. Staff Unanswered Questions Log
CREATE TABLE IF NOT EXISTS unanswered_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question          TEXT NOT NULL,
    confidence_score  REAL DEFAULT 0.0,
    occurred_at       TIMESTAMPTZ DEFAULT now(),
    reviewed          BOOLEAN DEFAULT FALSE,
    resolution_chunk_id UUID REFERENCES course_chunks(chunk_id) ON DELETE SET NULL,
    resolved_by       TEXT           -- display name of the staff member who answered it
);

-- If the table already exists from an earlier version, add the attribution column:
ALTER TABLE unanswered_log ADD COLUMN IF NOT EXISTS resolved_by TEXT;

-- 4b. Staff accounts added via the dashboard "Manage Staff" page.
-- Passwords are stored salted + PBKDF2-hashed, never in plaintext.
-- Built-in accounts still come from the STAFF_USERS env var and are not stored here.
CREATE TABLE IF NOT EXISTS staff_users (
    username   TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    salt       TEXT NOT NULL,
    pw_hash    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT
);

-- 5. Vector Similarity Search Function (RPC)
CREATE OR REPLACE FUNCTION match_chunks (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.35,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    course_chunks.chunk_id,
    course_chunks.content,
    1 - (course_chunks.embedding <=> query_embedding) AS similarity
  FROM course_chunks
  WHERE 1 - (course_chunks.embedding <=> query_embedding) >= match_threshold
  ORDER BY course_chunks.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- Create an HNSW index for sub-millisecond similarity search scale
CREATE INDEX IF NOT EXISTS course_chunks_embedding_hnsw_idx 
ON course_chunks 
USING hnsw (embedding vector_cosine_ops);
