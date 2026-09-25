"""Lazy provider clients: health and persistence do not require model keys."""
import os
from functools import lru_cache

@lru_cache
def gemini():
    from google import genai
    return genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))

@lru_cache
def groq():
    from groq import Groq
    return Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
