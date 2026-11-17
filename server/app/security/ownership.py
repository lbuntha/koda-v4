"""Whose Studio content a person may see and change.

Every item a Studio keeps — a book, a quiz, a Trace item, an art asset — names
its owner in `ownerId`. Someone holding `content:all` (the admin role) works on
everything; anyone else who can author sees and changes only what they own.

Content from before owners existed has no `ownerId`: it belongs to the people
who see everything, so a new creator starts with an empty Studio rather than
everybody else's work. Learners are untouched by all of this — what is
published reaches every family, whoever made it.
"""

from typing import Any

from app.errors import NotFound
from app.models.auth import Principal
from app.security import principal_can


def sees_all(p: Principal) -> bool:
    return principal_can(p, "content:all")


def scope(p: Principal) -> dict[str, Any]:
    """The Mongo filter for what this person may list: nothing extra, or their own."""
    return {} if sees_all(p) else {"ownerId": p.subject_id}


def may_touch(p: Principal, row: dict[str, Any] | None) -> bool:
    return row is not None and (sees_all(p) or row.get("ownerId") == p.subject_id)


def check(p: Principal, row: dict[str, Any] | None, what: str = "item") -> dict[str, Any]:
    """The row, if this person may work on it; otherwise the same 404 as a missing one.

    Not a 403: someone else's item is not something a creator should be able to
    confirm exists.
    """
    if not may_touch(p, row):
        raise NotFound(f"No such {what}.", "not_found")
    assert row is not None
    return row


def owner_for_new(p: Principal) -> str:
    return p.subject_id
