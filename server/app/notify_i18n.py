"""Notifications in the family's own language.

English is the source: every kind's words live in `push_defaults.py`, and the
phrases the senders build around a number ("3 days", "12 rounds") are in
`PHRASES` below. Any other language is one file in `notify_locales/`, named by
its code, that says the same things in that language — so adding a language to
notifications is adding a file, the same rule the app's own catalogs follow.

A language file may be partial. Whatever it does not say falls back to English
rather than to nothing, because a notification that half-arrives is still
better than one that does not arrive at all.

Which language a family gets is the family's choice in the app — the
`language` field of their synced `preferences` document — read at the moment a
notification is composed. A choice this server has no file for, or no choice at
all, is English.
"""

import json
import re
from functools import cache
from pathlib import Path
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

BASE = "en"
LOCALES_DIR = Path(__file__).parent / "notify_locales"
_TAG = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$")

#: English for the phrases a sender builds, rather than the words of a kind.
#: A value is either a string, or `{"one": …, "other": …}` chosen by `count`.
PHRASES: dict[str, Any] = {
    "days": {"one": "{count} day", "other": "{count} days"},
    "aDay": "a day",
    "aWhile": "a while",
    "rounds": {"one": "{count} round", "other": "{count} rounds"},
    "minutes": {"one": "{count} minute", "other": "{count} minutes"},
    "underAMinute": "under a minute",
    "and": " and ",
    "yourChild": "Your child",
    "yourChildLower": "your child",
    "somebody": "Somebody",
    "there": "there",
    "yourFamily": "your family",
    "approved": "approved",
    "summaryLine": "• {learner}: practised on {practice} — {rounds}, {time}",
    "digestLine": "• {learner}: {rounds}, {time}",
    "goalMetToday": " — today's goal met",
    "mastered": "mastered {lessons}",
    "tricky": "finding {lessons} tricky",
    "fullTime": "used the full daily time",
    "nextUp": "next up: {lesson}",
    "partSeparator": "; ",
    # Learn's three, counted — Think, Read and Write.
    "lessonsCount": {"one": "{count} lesson", "other": "{count} lessons"},
    "booksCount": {"one": "{count} book", "other": "{count} books"},
    "writingCount": {"one": "{count} writing item", "other": "{count} writing items"},
    "canWrite": "can now write {items}",
    "canDraw": "can now draw {items}",
    "readBooks": "read {books}",
}


@cache
def _catalogs() -> dict[str, dict[str, Any]]:
    """Every language file this build ships, by code. Read once."""
    found: dict[str, dict[str, Any]] = {}
    if LOCALES_DIR.is_dir():
        for path in sorted(LOCALES_DIR.glob("*.json")):
            if _TAG.match(path.stem):
                found[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return found


def languages() -> list[dict[str, str]]:
    """What an operator may edit wording in: English first, then each file."""
    out = [{"code": BASE, "name": "English", "englishName": "English"}]
    for code, catalog in _catalogs().items():
        meta = catalog.get("$meta") or {}
        out.append(
            {
                "code": code,
                "name": meta.get("name", code),
                "englishName": meta.get("englishName", meta.get("name", code)),
            }
        )
    return out


def known(language: str | None) -> str:
    """The language to use for a code: itself if this build speaks it, else English."""
    return language if language and language in _catalogs() else BASE


async def language_of_family(db: AsyncIOMotorDatabase, family_id: str | None) -> str:
    """The language a family chose in the app, or English."""
    if not family_id:
        return BASE
    doc = await db.docs.find_one(
        {"familyId": family_id, "kind": "preferences", "key": "default"}, {"body.language": 1}
    )
    return known(((doc or {}).get("body") or {}).get("language"))


async def language_of_user(db: AsyncIOMotorDatabase, user_id: str | None) -> str:
    """A person's language: their family's. Staff with no family read English."""
    if not user_id:
        return BASE
    membership = await db.memberships.find_one({"userId": user_id}, {"familyId": 1})
    return await language_of_family(db, (membership or {}).get("familyId"))


def _pick(value: Any, count: int | None) -> str | None:
    if isinstance(value, dict):
        if count is not None and count == 1 and "one" in value:
            return value["one"]
        return value.get("other")
    return value if isinstance(value, str) else None


def phrase(language: str, key: str, count: int | None = None, **values: Any) -> str:
    """One of the sender's phrases, in `language`, with its blanks filled."""
    local = (_catalogs().get(language) or {}).get("phrases") or {}
    text = _pick(local.get(key), count) or _pick(PHRASES.get(key), count) or key
    filled = {"count": count, **values}
    return re.sub(
        r"\{(\w+)\}",
        lambda m: str(filled[m.group(1)]) if filled.get(m.group(1)) is not None else m.group(0),
        text,
    )


def kind_text(language: str, kind: str) -> dict[str, Any]:
    """A kind's shipped words in `language` — `{title, body, label, email}` — or {}."""
    if language == BASE:
        return {}
    return ((_catalogs().get(language) or {}).get("kinds") or {}).get(kind) or {}


def frame_text(language: str) -> dict[str, str]:
    """The shipped email frame in `language`, or {}."""
    if language == BASE:
        return {}
    return (_catalogs().get(language) or {}).get("frame") or {}


def samples(language: str) -> dict[str, str]:
    """Preview values in `language`, over the English ones."""
    return (_catalogs().get(language) or {}).get("samples") or {}


def join_names(names: list[str], language: str) -> str:
    """"A", "A and B", "A, B and C" — the conjunction in `language`."""
    unique = list(dict.fromkeys(name for name in names if name))
    if len(unique) <= 1:
        return "".join(unique)
    return f"{', '.join(unique[:-1])}{phrase(language, 'and')}{unique[-1]}"
