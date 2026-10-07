"""Who a piece of content is for, in years — one shape for all of Learn.

Lessons, books and trace collections each describe their audience as
`[min, max]` in whole years, so one recommender can read all three. Required to
publish: content with no age cannot be put in front of the right child. The
client's `src/lib/ages.ts` holds the same rules for the Studio; this is what
actually refuses.
"""

from __future__ import annotations

from typing import Any

from app.errors import AppError

# Pre-school to Grade 12.
AGE_MIN = 4
AGE_MAX = 18


def is_age_range(value: Any) -> bool:
    return (
        isinstance(value, list | tuple)
        and len(value) == 2
        and all(isinstance(n, int) and not isinstance(n, bool) and AGE_MIN <= n <= AGE_MAX for n in value)
        and value[0] <= value[1]
    )


def clean_ages(value: Any) -> list[int] | None:
    """A draft may have no age yet; one it does have must be a real range."""
    if value is None:
        return None
    if not is_age_range(value):
        raise AppError(400, "invalid_ages", f"Ages are two whole years from {AGE_MIN} to {AGE_MAX}, youngest first.")
    return [int(value[0]), int(value[1])]


def require_ages(value: Any) -> None:
    """The publish gate: nothing goes out without saying who it is for."""
    if not is_age_range(value):
        raise AppError(422, "missing_ages", "Choose the grades this is for before publishing.")
