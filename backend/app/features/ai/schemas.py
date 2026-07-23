from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user"]
    content: str = Field(min_length=1, max_length=30_000)


class AiGenerateIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=8)
    temperature: float = Field(default=0.7, ge=0, le=1)
    max_tokens: int = Field(default=1000, ge=100, le=4000)
    response_format: dict[str, Literal["json_object"]] = Field(
        default_factory=lambda: {"type": "json_object"}
    )
