"""Daily puzzles in MongoDB.

  daily_puzzles          one row per puzzle in any state.
  daily_puzzle_calendar  one row per (line, day): which puzzle that day has.
                         `pinned` rows are the owner's choice; the rest are
                         Koda's own pick, written the first time a day is asked
                         for so every device is told the same thing.

A "line" (slot) is kind + language + level: everyone playing Khmer 3-tile Word
Guess gets the same word each day.

Koda's pick for a day: the published puzzle used least recently on that line —
never used first, then oldest — so the words run through before any repeats.
Days before today are never changed; today is fixed once picked, because
children may already be playing it; later days that Koda picked are cleared
whenever the line changes (a publish, a retirement, a pin) and picked again.
"""

from __future__ import annotations

import re
from datetime import timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne

from app.daily_puzzle_check import clean_word, tiles_of
from app.models.common import now

#: Phnom Penh, UTC+7 all year. The app uses the same day (`src/puzzles/day.ts`).
TZ = timedelta(hours=7)
SYSTEM = "system"

PUBLIC_FIELDS = ("id", "kind", "lang", "level", "data")


def today() -> str:
    return (now() + TZ).date().isoformat()


def add_days(day: str, n: int) -> str:
    from datetime import date

    return (date.fromisoformat(day) + timedelta(days=n)).isoformat()


def slot_key(kind: str, lang: str, level: int) -> str:
    return f"{kind}:{lang}:{level}"


def slot_of(row: dict[str, Any]) -> str:
    return slot_key(row["kind"], row["lang"], int(row["level"]))


def public(row: dict[str, Any]) -> dict[str, Any]:
    return {k: row[k] for k in PUBLIC_FIELDS if k in row}


def out(row: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in row.items() if k != "_id"}


def shape(lang: str, word: str, category: str, clue: dict[str, str], picture: str = "") -> dict[str, Any]:
    """The stored form of a word: cleaned, with its tiles and level worked out here, never sent in."""
    w = clean_word(word, lang)
    tiles = tiles_of(w, lang)
    return {
        "kind": "word-guess",
        "lang": lang,
        "level": len(tiles),
        "data": {
            "word": w,
            "tiles": tiles,
            "category": category,
            "clue": {"km": clue.get("km", ""), "en": clue.get("en", "")},
            "picture": picture,
        },
    }


# ---- puzzles ------------------------------------------------------------------


async def first_admin_id(db: AsyncIOMotorDatabase) -> str | None:
    user = await db.users.find_one({"platformRole": "core", "status": {"$in": [None, "active"]}}, sort=[("createdAt", 1)])
    return str(user["_id"]) if user else None


async def ensure_seed(db: AsyncIOMotorDatabase, rows: list[dict[str, Any]]) -> int:
    """Create the starter puzzles that are not here yet, published. Create-if-absent: edits survive a restart.

    Published rather than drafts (unlike Rebus): the daily puzzle has to work on
    the first day, and these words were chosen for it. The owner can retire any.
    """
    have = {r["id"]: r async for r in db.daily_puzzles.find({"id": {"$in": [r["id"] for r in rows]}}, {"id": 1, "data": 1, "seeded": 1})}
    await _fill_blanks(db, rows, have)
    author = await first_admin_id(db) or SYSTEM
    stamp = now()
    fresh = []
    for r in rows:
        if r["id"] in have:
            continue
        d = r["data"]
        fresh.append(
            {
                "id": r["id"],
                **shape(r["lang"], d["word"], d["category"], d.get("clue", {}), d.get("picture", "")),
                "status": "published",
                "owner": "koda",
                "createdBy": author,
                "seeded": True,
                "createdAt": stamp,
                "updatedAt": stamp,
                "publishedAt": stamp,
            }
        )
    if fresh:
        await db.daily_puzzles.insert_many(fresh)
    return len(fresh)


async def _fill_blanks(db: AsyncIOMotorDatabase, rows: list[dict[str, Any]], have: dict[str, dict[str, Any]]) -> None:
    """Starter words already here gain a Khmer clue or a picture the seed has and they lack. Only blanks: an edit is never undone."""
    for r in rows:
        old = have.get(r["id"])
        if not old or not old.get("seeded"):
            continue
        d, od = r["data"], old.get("data", {})
        sets: dict[str, Any] = {}
        if d.get("clue", {}).get("km") and not od.get("clue", {}).get("km"):
            sets["data.clue.km"] = d["clue"]["km"]
        if d.get("picture") and "picture" not in od:
            sets["data.picture"] = d["picture"]
        if sets:
            await db.daily_puzzles.update_one({"id": r["id"]}, {"$set": sets})


async def get(db: AsyncIOMotorDatabase, puzzle_id: str) -> dict[str, Any] | None:
    return await db.daily_puzzles.find_one({"id": puzzle_id})


async def find_word(db: AsyncIOMotorDatabase, lang: str, word: str) -> dict[str, Any] | None:
    return await db.daily_puzzles.find_one({"lang": lang, "data.word": clean_word(word, lang), "status": {"$ne": "retired"}})


async def unique_id(db: AsyncIOMotorDatabase, lang: str) -> str:
    n = await db.daily_puzzles.count_documents({"lang": lang})
    while True:
        n += 1
        candidate = f"wg-{lang}-{n:03d}"
        if not await db.daily_puzzles.find_one({"id": candidate}, {"_id": 1}):
            return candidate


async def insert(db: AsyncIOMotorDatabase, doc: dict[str, Any]) -> dict[str, Any]:
    stamp = now()
    doc = {**doc, "createdAt": stamp, "updatedAt": stamp}
    await db.daily_puzzles.insert_one(doc)
    return out(doc)


async def update(db: AsyncIOMotorDatabase, puzzle_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    row = await db.daily_puzzles.find_one_and_update(
        {"id": puzzle_id}, {"$set": {**fields, "updatedAt": now()}}, return_document=True
    )
    return out(row) if row else None


async def delete(db: AsyncIOMotorDatabase, puzzle_id: str) -> None:
    await db.daily_puzzles.delete_one({"id": puzzle_id})
    await db.daily_puzzle_calendar.delete_many({"puzzleId": puzzle_id, "day": {"$gt": today()}})


async def listing(
    db: AsyncIOMotorDatabase,
    *,
    lang: str | None,
    level: int | None,
    status: str | None,
    query: str | None,
    created_by: str | None,
    skip: int,
    limit: int,
) -> tuple[list[dict[str, Any]], int]:
    flt: dict[str, Any] = {}
    if lang:
        flt["lang"] = lang
    if level:
        flt["level"] = level
    if status:
        flt["status"] = status
    if created_by:
        flt["createdBy"] = created_by
    if query:
        rx = {"$regex": re.escape(query.strip()), "$options": "i"}
        flt["$or"] = [{"data.word": rx}, {"data.clue.en": rx}, {"data.clue.km": rx}]
    total = await db.daily_puzzles.count_documents(flt)
    rows = [out(r) async for r in db.daily_puzzles.find(flt).sort([("updatedAt", -1), ("id", 1)]).skip(skip).limit(limit)]
    return rows, total


async def names(db: AsyncIOMotorDatabase, ids: set[str]) -> dict[str, str]:
    """Account ids as people read them: a display name, else the email."""
    cursor = db.users.find({"_id": {"$in": list(ids - {SYSTEM})}}, {"displayName": 1, "email": 1})
    return {u["_id"]: u.get("displayName") or u.get("email") or u["_id"] async for u in cursor}


async def published_on(db: AsyncIOMotorDatabase, slot: str) -> list[dict[str, Any]]:
    kind, lang, level = slot.split(":")
    cursor = db.daily_puzzles.find({"kind": kind, "lang": lang, "level": int(level), "status": "published"})
    return sorted([r async for r in cursor], key=lambda r: (r.get("publishedAt") or r["createdAt"], r["id"]))


async def live_slots(db: AsyncIOMotorDatabase) -> list[str]:
    rows = await db.daily_puzzles.aggregate(
        [{"$match": {"status": "published"}}, {"$group": {"_id": {"k": "$kind", "l": "$lang", "v": "$level"}}}]
    ).to_list(None)
    return sorted(slot_key(r["_id"]["k"], r["_id"]["l"], int(r["_id"]["v"])) for r in rows)


# ---- the calendar -------------------------------------------------------------


async def forget_future(db: AsyncIOMotorDatabase, slot: str) -> None:
    """Clear Koda's own picks after today on a line, so they are made again from what is published now."""
    await db.daily_puzzle_calendar.delete_many({"slot": slot, "day": {"$gt": today()}, "pinned": {"$ne": True}})


async def pin(db: AsyncIOMotorDatabase, slot: str, day: str, puzzle_id: str | None, by: str) -> None:
    key = f"{slot}:{day}"
    if puzzle_id is None:
        await db.daily_puzzle_calendar.delete_one({"_id": key})
    else:
        await db.daily_puzzle_calendar.update_one(
            {"_id": key}, {"$set": {"slot": slot, "day": day, "puzzleId": puzzle_id, "pinned": True, "by": by, "at": now()}}, upsert=True
        )
    await forget_future(db, slot)


async def schedule(db: AsyncIOMotorDatabase, slot: str, start: str, days: int) -> list[dict[str, Any]]:
    """The puzzle for each day from `start`, picking (and remembering) any day from today on that has none."""
    first_open = today()
    end = add_days(start, days - 1)
    rows = [r async for r in db.daily_puzzle_calendar.find({"slot": slot})]
    by_day = {r["day"]: r for r in rows}
    published = await published_on(db, slot)
    live = {p["id"] for p in published}
    last_used: dict[str, str] = {}
    for r in rows:
        if r["day"] < start or r["day"] < first_open:
            last_used[r["puzzleId"]] = max(last_used.get(r["puzzleId"], ""), r["day"])
    pinned_ahead = {r["puzzleId"] for r in rows if r.get("pinned") and start <= r["day"] <= end}

    out_days: list[dict[str, Any]] = []
    writes: list[UpdateOne] = []
    day = start
    while day <= end:
        have = by_day.get(day)
        keep = have and (have.get("pinned") or have["puzzleId"] in live or day <= first_open)
        if keep or day < first_open:
            if have:
                out_days.append({"day": day, "puzzleId": have["puzzleId"], "pinned": bool(have.get("pinned"))})
                last_used[have["puzzleId"]] = day
        elif published:
            choices = [p for p in published if p["id"] not in pinned_ahead] or published
            pick = min(choices, key=lambda p: (last_used.get(p["id"], ""), p.get("publishedAt") or p["createdAt"], p["id"]))
            last_used[pick["id"]] = day
            out_days.append({"day": day, "puzzleId": pick["id"], "pinned": False})
            writes.append(
                UpdateOne(
                    {"_id": f"{slot}:{day}", "pinned": {"$ne": True}},
                    {"$set": {"slot": slot, "day": day, "puzzleId": pick["id"], "pinned": False}},
                    upsert=True,
                )
            )
        day = add_days(day, 1)
    if writes:
        try:
            await db.daily_puzzle_calendar.bulk_write(writes, ordered=False)
        except Exception:  # noqa: BLE001 — a pin landed meanwhile; its row wins and is read next time.
            pass
    return out_days


async def new_days_left(db: AsyncIOMotorDatabase, slot: str) -> int:
    """Published puzzles on a line that no day has had yet: how long until words repeat."""
    used = set(await db.daily_puzzle_calendar.distinct("puzzleId", {"slot": slot, "day": {"$lte": today()}}))
    return sum(1 for p in await published_on(db, slot) if p["id"] not in used)


async def overview(db: AsyncIOMotorDatabase, created_by: str | None) -> dict[str, Any]:
    match: dict[str, Any] = {"createdBy": created_by} if created_by else {}
    rows = await db.daily_puzzles.aggregate(
        [{"$match": match}, {"$group": {"_id": {"l": "$lang", "v": "$level", "s": "$status"}, "n": {"$sum": 1}}}]
    ).to_list(None)
    lines: dict[str, dict[str, Any]] = {}
    for r in rows:
        key = slot_key("word-guess", r["_id"]["l"], int(r["_id"]["v"]))
        line = lines.setdefault(key, {"slot": key, "lang": r["_id"]["l"], "level": int(r["_id"]["v"]), "byStatus": {}})
        line["byStatus"][r["_id"]["s"]] = r["n"]
    for key, line in lines.items():
        line["newDaysLeft"] = await new_days_left(db, key)
    return {"lines": sorted(lines.values(), key=lambda line: (line["lang"], line["level"])), "today": today()}
