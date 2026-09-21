"""
Olinda Chatbot Service — Dedicated FastAPI Server for Student Q&A and Widget Delivery.
Default Port: 8000
"""

import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from service import (
    init_db, get_db, supabase_client, redact_pii, check_escalation,
    retrieve_context, log_message, log_unanswered, extract_action_links,
    summarize_conversation, build_llm_messages, generate_llm_response,
    CONFIDENCE_THRESHOLD, MAX_HISTORY_MESSAGES, MAX_RECENT_MESSAGES,
    STUDENT_SERVICES_CONTACT, ChatRequest, ChatResponse
)

init_db()

app = FastAPI(
    title="Olinda Chatbot Service",
    description="Decoupled microservice for Hobart College student advisory chatbot",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://olinda-ai.vercel.app",
        "https://olinda-ai.onrender.com",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8001",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "chatbot_server",
        "db": "supabase" if supabase_client else "sqlite"
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    request_start = time.perf_counter()
    conn = get_db()

    user_query = req.query or req.message
    if not user_query and req.messages:
        for m in reversed(req.messages):
            if m.role == "user":
                user_query = m.content
                break
        if not user_query:
            user_query = req.messages[-1].content

    if not user_query or not user_query.strip():
        conn.close()
        raise HTTPException(status_code=400, detail="Query string is required")

    safe_message = redact_pii(user_query.strip())

    # 1. Check escalation patterns
    if check_escalation(safe_message):
        reply = f"For this you'll need Student Services directly: {STUDENT_SERVICES_CONTACT}."
        log_message(req.session_id, safe_message, reply, 0.0, True, conn)
        conn.close()
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
        conn.close()
        print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
        return ChatResponse(reply=reply, escalated=False, confidence=top_score, action_links=None)

    # 4. Action links
    action_links = extract_action_links(chunks)

    # 5. Generate LLM response
    conversation_summary = req.conversation_summary.strip()
    if len(req.messages) > MAX_HISTORY_MESSAGES:
        summary_start = time.perf_counter()
        conversation_summary = summarize_conversation(req.messages, conversation_summary)
        print(
            f"[MEMORY] Existing summary: {len(req.conversation_summary.split())} words | "
            f"Summary time: {time.perf_counter() - summary_start:.2f}s"
        )

    context = "\n\n---\n\n".join(chunks)
    summary_section = f"\n\nConversation Summary:\n{conversation_summary}" if conversation_summary else ""
    system_content = f"You are Olinda, Hobart College's course advisory assistant.\n{summary_section}\n\nRetrieved Knowledge:\n{context}"
    llm_messages = build_llm_messages(system_content, req.messages, safe_message)

    llm_start = time.perf_counter()
    reply = generate_llm_response(llm_messages)
    print(f"[CHAT] LLM: {time.perf_counter() - llm_start:.2f}s")

    if not reply:
        reply = f"I encountered a temporary problem generating an answer. Please contact Student Services ({STUDENT_SERVICES_CONTACT})."

    log_message(req.session_id, safe_message, reply, top_score, False, conn)
    conn.close()
    print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
    return ChatResponse(
        reply=reply,
        escalated=False,
        confidence=top_score,
        action_links=action_links,
        conversation_summary=conversation_summary or None,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CHATBOT_PORT", os.getenv("PORT", 8000)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
