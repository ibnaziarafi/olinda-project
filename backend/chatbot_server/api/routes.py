"""HTTP endpoints; always release per-request database connections."""
from fastapi import APIRouter, HTTPException
from ai.chat import answer
from data.database import get_db, supabase_client, save_feedback
from api.models import ChatRequest, ChatResponse, FeedbackRequest

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok", "service": "chatbot_server", "db": "supabase" if supabase_client else "sqlite"}

@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    conn = get_db()
    try:
        return answer(req, conn)
    finally:
        conn.close()

@router.post("/feedback")
def feedback(req: FeedbackRequest):
    conn = get_db()
    try:
        if not save_feedback(req.message_id, req.session_id, req.rating, conn):
            raise HTTPException(status_code=404, detail="Answer not found for this session")
        return {"status": "saved", "rating": req.rating}
    finally:
        conn.close()
