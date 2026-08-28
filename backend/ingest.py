"""
Olinda ingestion script — reads a PDF or Excel/CSV document (course guide, TASC standards, schedules),
splits it into chunks, embeds each chunk via Gemini API, and stores it in SQLite and/or Supabase.

Usage:
  python ingest.py path/to/course_guide.pdf --tasc-level 2 --doc-type course_guide
  python ingest.py path/to/courses.xlsx --doc-type excel
"""

import argparse
import csv
import json
import os
import sqlite3
import time
import uuid

import pdfplumber
import openpyxl
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types

load_dotenv()

DB_PATH = os.getenv("OLINDA_DB_PATH", "olinda.db")
EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
EMBED_DIMENSIONS = int(os.getenv("EMBED_DIMENSIONS", "768"))
BATCH_SIZE = 20  # chunks per API call
EMBED_RETRIES = 3

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Connected to Supabase pgvector instance.")
    except Exception as e:
        print(f"Warning: Could not connect to Supabase: {e}")


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    """Embed chunks in small batches (avoids oversized requests / rate limits)."""
    all_embeddings = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        for attempt in range(EMBED_RETRIES):
            try:
                result = client.models.embed_content(
                    model=EMBED_MODEL,
                    contents=batch,
                    config=genai_types.EmbedContentConfig(
                        output_dimensionality=EMBED_DIMENSIONS,
                        task_type="RETRIEVAL_DOCUMENT",
                    ),
                )
                break
            except Exception as error:
                if attempt == EMBED_RETRIES - 1:
                    raise
                delay = 2 ** attempt
                print(f"Embedding batch {i // BATCH_SIZE + 1} failed; retrying in {delay}s: {error}")
                time.sleep(delay)
        all_embeddings.extend([e.values for e in result.embeddings])
        print(f"  embedded {min(i + BATCH_SIZE, len(chunks))}/{len(chunks)} chunks")
        time.sleep(0.5)
    return all_embeddings


def extract_pdf_text(pdf_path: str) -> str:
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text += (page.extract_text() or "") + "\n"
    return text


def extract_excel_or_csv_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    text_lines = []
    if ext == ".csv":
        with open(file_path, mode="r", encoding="utf-8-sig", errors="ignore") as f:
            reader = csv.reader(f)
            headers = None
            for row in reader:
                if not any(row):
                    continue
                if headers is None:
                    headers = [h.strip() for h in row]
                    continue
                formatted_row = [f"{headers[i]}: {val.strip()}" for i, val in enumerate(row) if i < len(headers) and val.strip()]
                if formatted_row:
                    text_lines.append(" | ".join(formatted_row))
    elif ext in [".xlsx", ".xls"]:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        for sheet in wb.worksheets:
            headers = None
            for row in sheet.iter_rows(values_only=True):
                str_row = [str(val).strip() if val is not None else "" for val in row]
                if not any(str_row):
                    continue
                if headers is None:
                    headers = str_row
                    continue
                formatted_row = [f"{headers[i]}: {val}" for i, val in enumerate(str_row) if i < len(headers) and val]
                if formatted_row:
                    text_lines.append(f"Sheet '{sheet.title}': " + " | ".join(formatted_row))
    return "\n".join(text_lines)


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
    return chunks


def ensure_sqlite_table(conn: sqlite3.Connection):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS course_chunks (
            chunk_id     TEXT PRIMARY KEY,
            content      TEXT NOT NULL,
            embedding    TEXT NOT NULL,
            subject_code TEXT,
            tasc_level   TEXT,
            career_field TEXT,
            doc_type     TEXT,
            source_file  TEXT,
            created_at   TEXT
        )
        """
    )
    cursor = conn.execute("PRAGMA table_info(course_chunks)")
    columns = [row[1] for row in cursor.fetchall()]
    if "created_at" not in columns:
        conn.execute("ALTER TABLE course_chunks ADD COLUMN created_at TEXT")
    if "added_by" not in columns:
        conn.execute("ALTER TABLE course_chunks ADD COLUMN added_by TEXT")
    conn.commit()


def ingest_file(file_path: str, subject_code=None, tasc_level=None, career_field=None, doc_type="course_guide", added_by=None):
    print(f"Reading {file_path}...")
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        text = extract_pdf_text(file_path)
    elif ext in [".xlsx", ".xls", ".csv"]:
        text = extract_excel_or_csv_text(file_path)
        doc_type = doc_type or "excel"
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

    chunks = chunk_text(text)
    if not chunks:
        print("No readable text found in file.")
        return 0

    print(f"Split into {len(chunks)} chunks. Embedding via Gemini...")
    embeddings = embed_chunks(chunks)

    # 1. Save to SQLite
    conn = sqlite3.connect(DB_PATH)
    ensure_sqlite_table(conn)
    now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for chunk, embedding in zip(chunks, embeddings):
        chunk_id = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO course_chunks
               (chunk_id, content, embedding, subject_code, tasc_level, career_field, doc_type, source_file, created_at, added_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                chunk_id,
                chunk,
                json.dumps(embedding),
                subject_code,
                tasc_level,
                career_field,
                doc_type,
                os.path.basename(file_path),
                now_str,
                added_by,
            ),
        )

        # 2. Save to Supabase pgvector if configured. Drop optional columns the
        #    table hasn't been migrated for yet, so the chunk still persists.
        if supabase_client:
            row = {
                "chunk_id": chunk_id,
                "content": chunk,
                "embedding": embedding,
                "subject_code": subject_code,
                "tasc_level": tasc_level,
                "career_field": career_field,
                "doc_type": doc_type,
                "source_file": os.path.basename(file_path),
                "added_by": added_by,
            }
            for _ in range(3):
                try:
                    supabase_client.table("course_chunks").insert(row).execute()
                    break
                except Exception as e:
                    msg = str(e)
                    dropped = False
                    for col in ("added_by", "subject_code", "tasc_level", "career_field"):
                        if col in row and f"'{col}'" in msg:
                            del row[col]
                            dropped = True
                            print(f"Supabase course_chunks missing '{col}'; inserting without it.")
                            break
                    if not dropped:
                        print(f"Supabase insert warning: {e}")
                        break

    conn.commit()
    conn.close()
    print(f"Done — {len(chunks)} chunks stored successfully.")
    return len(chunks)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest a PDF, Excel or CSV into Olinda's knowledge base")
    parser.add_argument("file_path", help="Path to PDF, XLSX, XLS or CSV file")
    parser.add_argument("--subject-code", default=None)
    parser.add_argument("--tasc-level", default=None, help="e.g. 2, 3, 4")
    parser.add_argument("--career-field", default=None, help="e.g. health, trades, business")
    parser.add_argument("--doc-type", default="course_guide", help="course_guide | faq | excel | tasc_standard")
    args = parser.parse_args()

    ingest_file(args.file_path, args.subject_code, args.tasc_level, args.career_field, args.doc_type)
