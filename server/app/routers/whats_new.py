"""What's new: the skills, books and Rebus puzzles published lately.

The app shows a learner a "New on Koda" card when something here is newer than
what that device has already shown them. The server only lists what is live and
when it went live; *seen* is a fact about one device and one child, so the
device keeps it, and the card still works offline from the last copy fetched.

Read by anyone signed in, children included: every title here is already on
their shelf. Nothing is listed that a child could not open.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import Field

from app.deps import CurrentPrincipal, Db
from app.models.common import Model, now

router = APIRouter(prefix="/whats-new", tags=["whats-new"])

#: How far back the list reaches. Long enough that a family who opens Koda once
#: a fortnight still hears about last week; short enough that the card is news.
WINDOW = timedelta(days=30)
#: Per kind. A card shows a handful; more than this is a catalogue, not news.
LIMIT = 20


class NewItem(Model):
    kind: Literal["skill", "book", "rebus"]
    id: str
    title: str
    #: Milliseconds since the epoch, like the skill catalog's `publishedAt`.
    published_at: int = Field(alias="publishedAt")
    ages: list[int] | None = None
    language: str | None = None
    picture: str | None = None
    #: Rebus only: how many puzzles the release added.
    count: int | None = None


class WhatsNew(Model):
    items: list[NewItem]


def _ms(value: Any) -> int | None:
    return int(value.timestamp() * 1000) if isinstance(value, datetime) else None


def _ages(value: Any) -> list[int] | None:
    if isinstance(value, list) and len(value) == 2 and all(isinstance(v, int) for v in value):
        return value
    return None


async def _skills(db: Any, since: datetime) -> list[NewItem]:
    rows = db.skill_registry.find(
        {"status": "published", "deletedAt": None, "isEnabled": {"$ne": False}, "publishedAt": {"$gte": since}},
        {"id": 1, "title": 1, "name": 1, "publishedAt": 1, "audience": 1},
    ).sort("publishedAt", -1).limit(LIMIT)
    out = []
    async for row in rows:
        at = _ms(row.get("publishedAt"))
        if at is None:
            continue
        out.append(
            NewItem(
                kind="skill",
                id=row["id"],
                title=row.get("title") or row.get("name") or row["id"],
                publishedAt=at,
                ages=_ages((row.get("audience") or {}).get("ages")),
            )
        )
    return out


async def _books(db: Any, since: datetime) -> list[NewItem]:
    rows = db.library_books.find(
        {"deletedAt": None, "published": {"$ne": None}, "publishedAt": {"$gte": since}},
        {"id": 1, "publishedAt": 1, "published.title": 1, "published.ages": 1,
         "published.language": 1, "published.picture": 1},
    ).sort("publishedAt", -1).limit(LIMIT)
    out = []
    async for row in rows:
        at = _ms(row.get("publishedAt"))
        book = row.get("published") or {}
        if at is None or not book.get("title"):
            continue
        out.append(
            NewItem(
                kind="book",
                id=row["id"],
                title=book["title"],
                publishedAt=at,
                ages=_ages(book.get("ages")),
                language=book.get("language"),
                picture=book.get("picture"),
            )
        )
    return out


async def _rebus(db: Any, since: datetime) -> list[NewItem]:
    """One item per release, not per puzzle: "12 new puzzles" is the news."""
    rows = db.rebus_releases.find(
        {"rolledBack": False, "at": {"$gte": since}}, {"number": 1, "at": 1, "puzzleIds": 1}
    ).sort("number", -1).limit(LIMIT)
    out = []
    async for row in rows:
        at = _ms(row.get("at"))
        count = len(row.get("puzzleIds") or [])
        if at is None or count == 0:
            continue
        out.append(NewItem(kind="rebus", id=f"release-{row['number']}", title="Rebus Rush", publishedAt=at, count=count))
    return out


@router.get("", response_model_exclude_none=True)
async def whats_new(db: Db, _: CurrentPrincipal) -> WhatsNew:
    since = now() - WINDOW
    items = [*await _skills(db, since), *await _books(db, since), *await _rebus(db, since)]
    items.sort(key=lambda item: item.published_at, reverse=True)
    return WhatsNew(items=items)
