"""Daily puzzles: what a device plays each day, and the Puzzle Studio that manages them.

Reading is `settings:read`, which every signed-in device has. Writing is
`content:write` — the Koda owner, and anyone given the Content creator role
(a teacher, say). A creator works on their own words and sends them for
review; putting a word in front of every child, or choosing a day's word, is
the owner's (`content:all`). The same split as Rebus Studio.
"""

from __future__ import annotations

import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.daily_puzzle_check import PROBLEM_TEXT, word_problem
from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.daily_puzzle import CalendarIn, StatusIn, WordGuessIn, WordGuessPatch
from app.repos import daily_puzzles as repo
from app.routers.library import AudioSaved, ImageWrite, store_image
from app.security import ownership, principal_can

router = APIRouter(prefix="/daily-puzzles", tags=["daily-puzzles"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]

DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLOT = re.compile(r"^word-guess:(km|en):[2-6]$")


def _may_author(p: CurrentPrincipal) -> Principal:
    if not principal_can(p, "content:write"):
        raise Forbidden("Only Koda's content team can manage daily puzzles.", "not_an_operator")
    return p


CanWrite = Annotated[Principal, Depends(_may_author)]


def _may_run(p: CanWrite) -> Principal:
    if not ownership.sees_all(p):
        raise Forbidden("Only the Koda owner can change what every child plays.", "not_an_operator")
    return p


CanRun = Annotated[Principal, Depends(_may_run)]


def _mine_only(p: Principal) -> str | None:
    return None if ownership.sees_all(p) else p.subject_id


async def _owned(db: Any, p: Principal, puzzle_id: str) -> dict[str, Any]:
    row = await repo.get(db, puzzle_id)
    if not row or not (ownership.sees_all(p) or row.get("createdBy") == p.subject_id):
        raise NotFound("There is no such puzzle.")
    return row


async def _check(db: Any, lang: str, word: str, category: str, clue: dict[str, str], *, not_id: str | None = None) -> list[str]:
    """Every reason this word may not go live, as codes; a draft may be saved with them."""
    codes = []
    problem = word_problem(word, lang)
    if problem:
        codes.append(problem)
    else:
        twin = await repo.find_word(db, lang, word)
        if twin and twin["id"] != not_id:
            codes.append("duplicate")
    return codes


def _refuse(codes: list[str]) -> AppError:
    return AppError(422, "puzzle_not_ready", " ".join(PROBLEM_TEXT.get(c, c) for c in codes))


async def _issues(db: Any, row: dict[str, Any]) -> list[str]:
    d = row["data"]
    return await _check(db, row["lang"], d["word"], d["category"], d["clue"], not_id=row["id"])


# ---- what a device plays ------------------------------------------------------


@router.get("")
async def daily(db: Db, p: CanRead, days: Annotated[int, Query(ge=1, le=45)] = 30) -> dict[str, Any]:
    """The next `days` days on every line, and every published puzzle (practice draws from them all).

    A device keeps this and plays offline from it; the day turns over at
    midnight in Phnom Penh on every device.
    """
    start = repo.today()
    lines = {}
    for slot in await repo.live_slots(db):
        lines[slot] = [{"day": d["day"], "puzzleId": d["puzzleId"]} for d in await repo.schedule(db, slot, start, days)]
    wanted = {d["puzzleId"] for line in lines.values() for d in line}
    rows = [r async for r in db.daily_puzzles.find({"$or": [{"status": "published"}, {"id": {"$in": list(wanted)}}]})]
    return {"today": start, "lines": lines, "puzzles": [repo.public(r) for r in rows]}


# ---- the Studio ---------------------------------------------------------------


@router.get("/studio/overview")
async def overview(db: Db, p: CanWrite) -> dict[str, Any]:
    return {**await repo.overview(db, _mine_only(p)), "canRun": ownership.sees_all(p)}


@router.get("/studio/puzzles")
async def studio_list(
    db: Db,
    p: CanWrite,
    lang: Annotated[str | None, Query(pattern="^(km|en)$")] = None,
    level: Annotated[int | None, Query(ge=2, le=6)] = None,
    status: Annotated[str | None, Query(pattern="^(draft|review|published|retired)$")] = None,
    q: Annotated[str | None, Query(max_length=40)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> dict[str, Any]:
    rows, total = await repo.listing(db, lang=lang, level=level, status=status, query=q, created_by=_mine_only(p), skip=skip, limit=limit)
    who = await repo.names(db, {r["createdBy"] for r in rows if r.get("createdBy")})
    out = [{**r, "issues": await _issues(db, r), "createdByName": who.get(r.get("createdBy", ""), "")} for r in rows]
    return {"puzzles": out, "total": total}


@router.post("/studio/images")
async def upload_image(body: ImageWrite, db: Db, p: CanWrite) -> AudioSaved:
    """A photo from the author's computer for a word's picture. Kept with the library's photos, so children see it
    through `/library/images/{id}`, which every signed-in player can read."""
    return await store_image(body, db, p.subject_id)


@router.post("/studio/puzzles", status_code=201)
async def studio_create(body: WordGuessIn, db: Db, p: CanWrite) -> dict[str, Any]:
    """A new word, saved as a draft even with problems so nothing typed is lost; the response lists them."""
    clue = body.clue.model_dump()
    codes = await _check(db, body.lang, body.word, body.category, clue)
    if "duplicate" in codes:
        raise _refuse(["duplicate"])
    doc = {
        "id": await repo.unique_id(db, body.lang),
        **repo.shape(body.lang, body.word, body.category, clue, body.picture),
        "status": "draft",
        "owner": "koda" if ownership.sees_all(p) else "creator",
        "createdBy": p.subject_id,
    }
    row = await repo.insert(db, doc)
    return {**row, "issues": codes}


@router.patch("/studio/puzzles/{puzzle_id}")
async def studio_edit(puzzle_id: str, body: WordGuessPatch, db: Db, p: CanWrite) -> dict[str, Any]:
    row = await _owned(db, p, puzzle_id)
    if row["status"] in ("published", "retired") and not ownership.sees_all(p):
        raise Forbidden("Only the Koda owner can change a word children have played.", "not_an_operator")
    d = row["data"]
    word = body.word if body.word is not None else d["word"]
    category = body.category or d["category"]
    clue = body.clue.model_dump() if body.clue else d["clue"]
    picture = body.picture if body.picture is not None else d.get("picture", "")
    shaped = repo.shape(row["lang"], word, category, clue, picture)
    if row["status"] == "published":
        # In front of children now: a fix must leave it playable, and the same length on its line.
        codes = await _check(db, row["lang"], word, category, clue, not_id=row["id"])
        if codes:
            raise _refuse(codes)
        if shaped["level"] != row["level"]:
            raise AppError(409, "level_change", "A live word must keep its number of tiles. Retire it and add the new word instead.")
    updated = await repo.update(db, puzzle_id, {**shaped, "editedBy": p.subject_id})
    if row["status"] == "published":
        await repo.forget_future(db, repo.slot_of(row))
    assert updated is not None
    return {**updated, "issues": await _issues(db, updated)}


ALLOWED = {
    "draft": {"review", "published"},
    "review": {"draft", "published"},
    "published": {"retired"},
    "retired": {"published", "draft"},
}


@router.post("/studio/puzzles/{puzzle_id}/status")
async def studio_status(puzzle_id: str, body: StatusIn, db: Db, p: CanWrite) -> dict[str, Any]:
    """draft → review (a creator asks) → published (the owner); published ↔ retired."""
    row = await _owned(db, p, puzzle_id)
    current, wanted = row["status"], body.status
    if wanted not in ALLOWED.get(current, set()):
        raise AppError(409, "bad_transition", f"A {current} word cannot become {wanted}.")
    if "published" in (current, wanted) or current == "retired":
        if not ownership.sees_all(p):
            raise Forbidden("Only the Koda owner can put a word live or take it off.", "not_an_operator")
    if wanted in ("review", "published"):
        codes = await _issues(db, row)
        if codes:
            raise _refuse(codes)
    fields: dict[str, Any] = {"status": wanted, "note": body.note, "statusBy": p.subject_id}
    if wanted == "published":
        fields["publishedAt"] = repo.now()
    updated = await repo.update(db, puzzle_id, fields)
    if "published" in (current, wanted):
        await repo.forget_future(db, repo.slot_of(row))
    assert updated is not None
    return {**updated, "issues": await _issues(db, updated)}


@router.delete("/studio/puzzles/{puzzle_id}", status_code=204)
async def studio_delete(puzzle_id: str, db: Db, p: CanWrite) -> None:
    """Only a draft or one waiting for review. A word children have played is retired instead."""
    row = await _owned(db, p, puzzle_id)
    if row["status"] not in ("draft", "review"):
        raise AppError(409, "not_deletable", "Retire a word children have played instead; it can be brought back.")
    await repo.delete(db, puzzle_id)


@router.get("/studio/calendar")
async def studio_calendar(
    db: Db,
    p: CanWrite,
    slot: Annotated[str, Query(pattern=SLOT.pattern)],
    start: Annotated[str | None, Query(pattern=DAY.pattern)] = None,
    days: Annotated[int, Query(ge=1, le=62)] = 28,
) -> dict[str, Any]:
    first = start or repo.today()
    entries = await repo.schedule(db, slot, first, days)
    ids = {e["puzzleId"] for e in entries}
    rows = {r["id"]: repo.out(r) async for r in db.daily_puzzles.find({"id": {"$in": list(ids)}})}
    return {
        "slot": slot,
        "today": repo.today(),
        "days": [{**e, "puzzle": rows.get(e["puzzleId"])} for e in entries],
        "newDaysLeft": await repo.new_days_left(db, slot),
    }


@router.put("/studio/calendar/{slot}/{day}")
async def studio_pin(slot: str, day: str, body: CalendarIn, db: Db, p: CanRun) -> dict[str, Any]:
    """Choose the word for a day after today, or (puzzleId null) hand the day back to Koda's pick."""
    if not SLOT.match(slot) or not DAY.match(day):
        raise NotFound("There is no such day.")
    if day <= repo.today():
        raise AppError(409, "day_started", "Today's word is already being played. Choose a day from tomorrow on.")
    if body.puzzle_id is not None:
        row = await repo.get(db, body.puzzle_id)
        if not row or row["status"] != "published" or repo.slot_of(row) != slot:
            raise AppError(422, "not_on_line", "Choose a live word with this language and number of tiles.")
    await repo.pin(db, slot, day, body.puzzle_id, p.subject_id)
    return {"ok": True}
