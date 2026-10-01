"""
Olinda Chatbot Service — Dedicated FastAPI Server for Student Q&A and Widget Delivery.
Default Port: 8000
"""

import os
import time
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

if __package__:
    from .security import configure_app, ORIGINS, redact_pii, PRODUCTION, RateLimiter
    from .service import (
        init_db, get_db, supabase_client, check_escalation,
        retrieve_context, log_message, log_unanswered,
        summarize_conversation, build_llm_messages, generate_llm_response,
        CONFIDENCE_THRESHOLD, MAX_HISTORY_MESSAGES, MAX_RECENT_MESSAGES,
        STUDENT_SERVICES_CONTACT, SYSTEM_PROMPT, ChatRequest, ChatResponse
    )
else:
    from security import configure_app, ORIGINS, redact_pii, PRODUCTION, RateLimiter
    from service import (
        init_db, get_db, supabase_client, check_escalation,
        retrieve_context, log_message, log_unanswered,
        summarize_conversation, build_llm_messages, generate_llm_response,
        CONFIDENCE_THRESHOLD, MAX_HISTORY_MESSAGES, MAX_RECENT_MESSAGES,
        STUDENT_SERVICES_CONTACT, SYSTEM_PROMPT, ChatRequest, ChatResponse
    )

app = FastAPI(
    title="Olinda Chatbot Service",
    description="Decoupled microservice for Hobart College student advisory chatbot",
    version="1.0.0",
    docs_url=None, redoc_url=None, openapi_url=None,
)

configure_app(app, chat=True)
app.state.chat_budget = RateLimiter()
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "chatbot_server",
        "db": "supabase" if supabase_client else "sqlite"
    }



@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not extract_query(req).strip():
        raise HTTPException(400, "Query string is required")
    daily_limit = int(os.getenv("CHAT_DAILY_REQUEST_LIMIT", "200"))
    if daily_limit == 0:
        raise HTTPException(429, "Chatbot is temporarily paused")
    try:
        allowed = await app.state.chat_budget.allowed("chat:daily:all", daily_limit, window_seconds=86400)
    except Exception:
        raise HTTPException(503, "Usage controls temporarily unavailable; please try later") from None
    if not allowed:
        raise HTTPException(429, "The chatbot has reached its daily question limit. Please contact Student Services.")
    return await run_in_threadpool(run_chat, req)


def run_chat(req):
    conn = None if supabase_client else get_db()
    try:
        return handle_chat(req, conn)
    finally:
        if conn is not None:
            conn.close()


def extract_query(req):
    user_query = req.query or req.message
    if not user_query and req.messages:
        for m in reversed(req.messages):
            if m.role == "user":
                user_query = m.content
                break
        if not user_query:
            user_query = req.messages[-1].content

    return user_query or ""


def handle_chat(req: ChatRequest, conn):
    request_start = time.perf_counter()
    user_query = extract_query(req)

    safe_message = redact_pii(user_query.strip())

    # 1. Check escalation patterns
    if check_escalation(safe_message):
        reply = f"For this you'll need Student Services directly: {STUDENT_SERVICES_CONTACT}."
        log_message(req.session_id, safe_message, reply, 0.0, True, conn)

        print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
        return ChatResponse(reply=reply, escalated=True, confidence=0.0, action_links=None)

    # 2. Retrieve relevant context
    retrieval_start = time.perf_counter()
    chunks, top_score = retrieve_context(safe_message, conn)
    print(
        f"[CHAT] Retrieval: {time.perf_counter() - retrieval_start:.2f}s | "
        f"score: {top_score:.3f} | chunks: {len(chunks)}"
    )

    # 3. Low confidence check
    if top_score < CONFIDENCE_THRESHOLD or not chunks:
        log_unanswered(safe_message, top_score, conn)
        reply = (
            "I'm not fully certain on this one — please confirm with a "
            f"Hobart College Pathway Advisor or Student Services ({STUDENT_SERVICES_CONTACT})."
        )

        log_message(req.session_id, safe_message, reply, top_score, False, conn)
        print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
        return ChatResponse(reply=reply, escalated=False, confidence=top_score, action_links=None)

    # 4. Generate LLM response
    conversation_summary = redact_pii(req.conversation_summary.strip())
    if len(req.messages) > MAX_HISTORY_MESSAGES:
        summary_start = time.perf_counter()
        conversation_summary = summarize_conversation(req.messages, conversation_summary)
        print(
            f"[MEMORY] Existing summary: {len(req.conversation_summary.split())} words | "
            f"Summary time: {time.perf_counter() - summary_start:.2f}s"
        )

    # Documents and client summaries are untrusted data, never system instructions.
    context = redact_pii("\n\n---\n\n".join(chunks))[:24000]
    llm_messages = build_llm_messages(SYSTEM_PROMPT, req.messages, safe_message,
        json.dumps({"reference_knowledge": context, "conversation_summary": conversation_summary}))

    llm_start = time.perf_counter()
    reply = generate_llm_response(llm_messages)
    print(f"[CHAT] LLM: {time.perf_counter() - llm_start:.2f}s")

    if not reply:
        reply = f"I encountered a temporary problem generating an answer. Please contact Student Services ({STUDENT_SERVICES_CONTACT})."

    log_message(req.session_id, safe_message, reply, top_score, False, conn)
    print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
    return ChatResponse(
        reply=reply,
        escalated=False,
        confidence=top_score,
        action_links=None,
        conversation_summary=conversation_summary or None,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CHATBOT_PORT", os.getenv("PORT", 8000)))
    uvicorn.run(app, host="127.0.0.1", port=port)
