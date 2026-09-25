"""Response generation with the existing provider fallback."""
from google.genai import types as genai_types
from clients import gemini, groq
from config import GEMINI_MODEL, GROQ_MODEL
from guardrails import clean_llm_response

def generate_gemini_response(messages):
    prompt = "\n\n".join(
        f"{message['role'].upper()}:\n{message['content']}"
        for message in messages
    )
    response = gemini().models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=700,
        ),
    )
    return response.text or ""


def generate_llm_response(messages):
    request_chars = sum(len(message.get("content", "")) for message in messages)
    try:
        print(f"[LLM] Primary: {GROQ_MODEL}")
        response = groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=700,
            reasoning_effort="none",
        )
        reply = response.choices[0].message.content
        if reply:
            print(f"[LLM] Primary success: {GROQ_MODEL}")
            return clean_llm_response(reply)
        print(f"[LLM] Primary returned an empty response: {GROQ_MODEL}")
    except Exception as error:
        error_text = str(error)
        print(
            f"[LLM] Primary error ({GROQ_MODEL}) | messages: {len(messages)} | "
            f"request chars: {request_chars}: {error_text}"
        )

    try:
        print(f"[LLM] Falling back to Gemini: {GEMINI_MODEL}")
        reply = generate_gemini_response(messages)
        if reply:
            print(f"[LLM] Gemini success: {GEMINI_MODEL}")
            return clean_llm_response(reply)
        print(f"[LLM] Gemini returned an empty response: {GEMINI_MODEL}")
    except Exception as error:
        print(
            f"[LLM] Gemini error ({GEMINI_MODEL}) | messages: {len(messages)} | "
            f"request chars: {request_chars}: {error}"
        )

    return None
