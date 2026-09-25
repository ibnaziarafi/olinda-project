"""Input redaction, escalation and response cleanup."""
import re

ESCALATION_PATTERNS = [
    r"\bmy (enrolment|enrollment|fees?|record|results?)\b",
    r"\bcounsell?ing\b",
    r"\bmedical\b",
    r"\bchange my (timetable|schedule)\b",
    r"\bwellbeing (support|issue|concern)\b",
]

PII_PATTERNS = [
    r"\b\d{8,10}\b",                    # student ID-like numbers
    r"[\w.+-]+@[\w-]+\.[\w.-]+",        # email addresses
    r"\b04\d{2}[ -]?\d{3}[ -]?\d{3}\b", # AU mobile numbers
]


def check_escalation(message: str) -> bool:
    return any(re.search(p, message, re.IGNORECASE) for p in ESCALATION_PATTERNS)


def redact_pii(message: str) -> str:
    for pattern in PII_PATTERNS:
        message = re.sub(pattern, "[redacted]", message, flags=re.IGNORECASE)
    return message


def clean_llm_response(text: str) -> str:
    if not text:
        return ""

    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<think>.*$", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<thinking>.*$", "", text, flags=re.DOTALL | re.IGNORECASE)
    return text.strip()
