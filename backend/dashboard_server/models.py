"""Dashboard request contracts."""
from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str


class NewStaffRequest(BaseModel):
    username: str
    name: str
    password: str
    role: str = "user"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ResolveUnansweredRequest(BaseModel):
    id: str
    answer: str


class IngestTextRequest(BaseModel):
    text: str
    doc_type: str = "faq"
    source_file: str = "dashboard_text_input"
