"""Request models for the events feature."""

from typing import Any

from pydantic import BaseModel


class EventsIn(BaseModel):
    events: list[dict[str, Any]]
