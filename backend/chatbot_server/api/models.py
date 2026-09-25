"""Public API request and response contracts."""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class ActionLink(BaseModel):
    title: str
    url: str


class MessageItem(BaseModel):
    role: str
    content: str = Field(max_length=16000)


class ChatRequest(BaseModel):
    session_id: str = Field(default="default_session", min_length=1, max_length=128)
    messages: List[MessageItem] = Field(default_factory=list, max_length=20)
    conversation_summary: str = Field(default="", max_length=12000)
    query: Optional[str] = Field(default=None, max_length=4000)
    message: Optional[str] = Field(default=None, max_length=4000)


class ChatResponse(BaseModel):
    message_id: Optional[str] = None
    reply: str
    escalated: bool
    confidence: float
    action_links: Optional[List[ActionLink]] = None
    conversation_summary: Optional[str] = None

class FeedbackRequest(BaseModel):
    message_id: str = Field(min_length=1, max_length=128)
    session_id: str = Field(min_length=1, max_length=128)
    rating: Literal["like", "dislike"]
