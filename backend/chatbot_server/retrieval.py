"""Embedding and knowledge retrieval."""
import json
import time
import numpy as np
from google.genai import types as genai_types
from clients import gemini
from database import supabase_client
from config import EMBED_MODEL, EMBED_DIMENSIONS, RAG_TOP_K

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    return float(np.dot(a, b) / denom) if denom else 0.0


def embed_query(message: str) -> list[float]:
    result = gemini().models.embed_content(
        model=EMBED_MODEL,
        contents=message,
        config=genai_types.EmbedContentConfig(
            output_dimensionality=EMBED_DIMENSIONS,
            task_type="RETRIEVAL_QUERY",
        ),
    )
    return result.embeddings[0].values


def retrieve_context(message: str, conn):
    embedding_start = time.perf_counter()
    query_vector = embed_query(message)
    print(f"[CHAT] Embedding: {time.perf_counter() - embedding_start:.2f}s")

    if supabase_client:
        try:
            rpc_res = supabase_client.rpc("match_chunks", {
                "query_embedding": query_vector,
                "match_threshold": 0.1,
                "match_count": RAG_TOP_K
            }).execute()
            if rpc_res.data:
                chunks = [row["content"] for row in rpc_res.data]
                top_score = float(rpc_res.data[0]["similarity"]) if rpc_res.data else 0.0
                return chunks, top_score
            return [], 0.0
        except Exception as e:
            raise RuntimeError(f"Supabase vector search failed: {e}") from e

    query_embedding = np.array(query_vector)
    rows = conn.execute("SELECT content, embedding FROM course_chunks").fetchall()
    if not rows:
        return [], 0.0

    scored = []
    for row in rows:
        try:
            chunk_embedding = np.array(json.loads(row["embedding"]))
            score = cosine_similarity(query_embedding, chunk_embedding)
            scored.append((row["content"], score))
        except Exception:
            continue

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:RAG_TOP_K]
    top_score = top[0][1] if top else 0.0
    return [c for c, _ in top], top_score
