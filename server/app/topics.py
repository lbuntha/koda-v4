"""What content is about — the shared topic list, the Python side of `src/lib/topics.ts`.

Books and trace collections may carry topics from this list and no other, so
the client and the server can never file the same book under two spellings of
one idea. Optional: units (the letters and numbers content uses) are worked out
from the content itself, so a book with no topics is still linked.
"""

from __future__ import annotations

from typing import Any

from app.errors import AppError

TOPICS: tuple[str, ...] = (
    "numbers",
    "counting",
    "addition",
    "subtraction",
    "multiplication",
    "division",
    "fractions",
    "money",
    "time",
    "measurement",
    "shapes",
    "colours",
    "patterns",
    "logic",
    "letters",
    "words",
    "reading",
    "writing",
    "drawing",
    "animals",
    "food",
    "family",
    "nature",
    "school",
    "places",
    "feelings",
    "health",
    "culture",
)

_KNOWN = frozenset(TOPICS)


def clean_topics(value: Any) -> list[str] | None:
    """Known topics, once each, in the list's order. Anything else is refused, not dropped."""
    if value is None:
        return None
    if not isinstance(value, list) or len(value) > len(TOPICS) or any(not isinstance(t, str) or t not in _KNOWN for t in value):
        raise AppError(400, "invalid_topics", "Topics come from Koda's shared list.")
    return [t for t in TOPICS if t in value]
