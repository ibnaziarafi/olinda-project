"""Chat orchestration, independent of HTTP routing."""
import time
from fastapi import HTTPException
from core.config import CONFIDENCE_THRESHOLD, MAX_HISTORY_MESSAGES, STUDENT_SERVICES_CONTACT, COLLEGE_NAME, SYSTEM_PROMPT
from data.database import log_message, log_unanswered
from core.guardrails import redact_pii, check_escalation
from data.retrieval import retrieve_context
from ai.memory import summarize_conversation, build_llm_messages
from ai.llm import generate_llm_response
from data.links import extract_action_links
from api.models import ChatRequest, ChatResponse

def answer(req: ChatRequest, conn):
    request_start = time.perf_counter()

    user_query = req.query or req.message
    if not user_query and req.messages:
        for m in reversed(req.messages):
            if m.role == "user":
                user_query = m.content
                break
        if not user_query:
            user_query = req.messages[-1].content

    if not user_query or not user_query.strip():
        raise HTTPException(status_code=400, detail="Query string is required")

    safe_message = redact_pii(user_query.strip())

    # 1. Check escalation patterns
    if check_escalation(safe_message):
        reply = f"For this you'll need Student Services directly: {STUDENT_SERVICES_CONTACT}."
        message_id = log_message(req.session_id, safe_message, reply, 0.0, True, conn)
        print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
        return ChatResponse(message_id=message_id, reply=reply, escalated=True, confidence=0.0, action_links=None)

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
            f"{COLLEGE_NAME} Pathway Advisor or Student Services ({STUDENT_SERVICES_CONTACT})."
        )
        message_id = log_message(req.session_id, safe_message, reply, top_score, False, conn)
        print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
        return ChatResponse(message_id=message_id, reply=reply, escalated=False, confidence=top_score, action_links=None)

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
    system_content = f"{SYSTEM_PROMPT}\n{summary_section}\n\nContext:\n{context}"
    llm_messages = build_llm_messages(system_content, req.messages, safe_message)

    llm_start = time.perf_counter()
    reply = generate_llm_response(llm_messages)
    print(f"[CHAT] LLM: {time.perf_counter() - llm_start:.2f}s")

    if not reply:
        reply = f"I encountered a temporary problem generating an answer. Please contact Student Services ({STUDENT_SERVICES_CONTACT})."

    message_id = log_message(req.session_id, safe_message, reply, top_score, False, conn)
    print(f"[CHAT] Total response time: {time.perf_counter() - request_start:.2f}s")
    return ChatResponse(
        message_id=message_id,
        reply=reply,
        escalated=False,
        confidence=top_score,
        action_links=action_links,
        conversation_summary=conversation_summary or None,
    )
