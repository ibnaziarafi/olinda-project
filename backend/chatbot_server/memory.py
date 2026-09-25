"""Conversation context and rolling summaries."""
from typing import List
from google.genai import types as genai_types
from clients import gemini
from config import MAX_RECENT_MESSAGES, MAX_SUMMARY_WORDS, MAX_SUMMARY_TOKENS, GEMINI_MODEL
from guardrails import redact_pii, clean_llm_response

def build_llm_messages(system_content: str, history: List, safe_message: str, summary: str = ""):
    llm_messages = [{"role": "system", "content": system_content}]
    normalized_history = []

    for msg in history[-MAX_RECENT_MESSAGES:]:
        content = redact_pii((msg.content or "").strip())
        role = msg.role.lower().strip()
        if not content or role not in {"user", "assistant", "bot"}:
            continue
        normalized_history.append({
            "role": "assistant" if role in {"assistant", "bot"} else "user",
            "content": content,
        })

    while (
        normalized_history
        and normalized_history[-1]["role"] == "user"
        and normalized_history[-1]["content"] == safe_message
    ):
        normalized_history.pop()

    llm_messages.extend(normalized_history)
    llm_messages.append({"role": "user", "content": safe_message})
    return llm_messages


def summarize_conversation(history: List, existing_summary: str = "") -> str:
    older_messages = history[:-MAX_RECENT_MESSAGES]
    if not older_messages:
        return " ".join(existing_summary.split()[:MAX_SUMMARY_WORDS])

    conversation = "\n".join(
        f"{msg.role}: {redact_pii(msg.content or '').strip()}"
        for msg in older_messages
        if msg.content and msg.role.lower().strip() in {"user", "assistant", "bot"}
    )
    if not conversation:
        return " ".join(existing_summary.split()[:MAX_SUMMARY_WORDS])

    summary_prompt = f"""Create a concise summary of this conversation for a course advisory chatbot.

Keep the user's current interests, subjects discussed, important preferences,
questions already answered, unresolved questions, and facts needed for follow-up.
Do not repeat full answers, invent information, include RAG documents, or add
information not present in the conversation. Maximum {MAX_SUMMARY_WORDS} words.

""" + (f"Existing summary:\n{existing_summary}\n\n" if existing_summary else "") + conversation

    try:
        response = gemini().models.generate_content(
            model=GEMINI_MODEL,
            contents=summary_prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=MAX_SUMMARY_TOKENS,
            ),
        )
        summary = clean_llm_response(response.text or "")
        print(f"[MEMORY] History summarised: {'yes' if summary else 'no'}")
        return " ".join(summary.split()[:MAX_SUMMARY_WORDS])
    except Exception as error:
        print(f"[MEMORY] Summary failed: {error}")
        return " ".join(existing_summary.split()[:MAX_SUMMARY_WORDS])
