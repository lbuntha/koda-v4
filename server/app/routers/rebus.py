"""Rebus Rush: the puzzles children play, and the Studio that manages them.

Reading follows the library's rule: `settings:read`, which every signed-in
device has, because every device needs the puzzles to play. A device asks "what
is current?" with the version it last saw and usually hears "nothing new".

Writing is `content:write`, the single gate the art library and the Library
Studio use, so the menu entry and the API can never disagree about who may
author. A draft may be anything, including wrong, so an author can save their
work; what may be *approved* or *live* is decided here by `rebus_verify`,
whatever the editor said.

The first puzzles are seed data (`rebus_seed.json`), created at boot as drafts
authored by the admin account. They go through the same flow as any puzzle:
review, approve, publish in a release. Children only ever see published puzzles.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.rebus_puzzle import ApproveAllIn, PromptIn, PublishIn, PuzzleIn, PuzzlePatch, StatusIn
from app.rebus_verify import describe, validate_puzzle
from app.repos import rebus as repo
from app.security import principal_can

router = APIRouter(prefix="/rebus", tags=["rebus"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]


def _may_author(p: CurrentPrincipal) -> Principal:
    if not principal_can(p, "content:write"):
        raise Forbidden("Only an operator can manage Rebus Rush puzzles.", "not_an_operator")
    return p


CanWrite = Annotated[Principal, Depends(_may_author)]


def _out(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key != "_id"}


async def _problems(db, row: dict[str, Any]) -> list[str]:
    """Every reason this puzzle may not be approved or live, as codes."""
    codes = validate_puzzle(row, known_icons=await repo.known_icons(db))
    if await repo.is_duplicate(db, row):
        codes.append("duplicate")
    return codes


def _refuse(codes: list[str]) -> AppError:
    return AppError(422, "puzzle_not_ready", describe(codes))


# ---- what a device plays ------------------------------------------------------


@router.get("/puzzles")
async def puzzles(db: Db, p: CanRead, since: Annotated[int | None, Query(ge=0)] = None) -> dict[str, Any]:
    """The published puzzles, or "unchanged" when the device already has this version."""
    current = await repo.version(db)
    if since is not None and since == current:
        return {"version": current, "unchanged": True, "puzzles": []}
    return {"version": current, "unchanged": False, "puzzles": await repo.published(db)}


# ---- the Studio ---------------------------------------------------------------


@router.get("/studio/overview")
async def overview(db: Db, p: CanWrite) -> dict[str, Any]:
    # The first admin to open the Studio becomes the author of any seed puzzle
    # created before there was an admin to author it.
    if p.platform_role == "admin":
        await repo.adopt_seed(db, p.subject_id)
    return await repo.overview(db)


@router.get("/studio/puzzles")
async def studio_list(
    db: Db,
    p: CanWrite,
    status: str | None = None,
    category: str | None = None,
    source: str | None = None,
    icon: Annotated[str | None, Query(max_length=64)] = None,
    q: Annotated[str | None, Query(max_length=60)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict[str, Any]:
    rows, total = await repo.listing(db, status=status, category=category, source=source, icon=icon, query=q, skip=skip, limit=limit)
    who = await repo.names(db, {r["createdBy"] for r in rows if r.get("createdBy")})
    out = []
    for row in rows:
        out.append({**_out(row), "issues": await _problems(db, row), "createdByName": who.get(row.get("createdBy", ""))})
    return {"puzzles": out, "total": total}


@router.get("/studio/puzzles/{puzzle_id}")
async def studio_get(puzzle_id: str, db: Db, p: CanWrite) -> dict[str, Any]:
    row = await repo.get(db, puzzle_id)
    if not row:
        raise NotFound("There is no such puzzle.")
    who = await repo.names(db, {row["createdBy"]} if row.get("createdBy") else set())
    return {**_out(row), "issues": await _problems(db, row), "createdByName": who.get(row.get("createdBy", ""))}


@router.post("/studio/puzzles", status_code=201)
async def studio_create(body: PuzzleIn, db: Db, p: CanWrite) -> dict[str, Any]:
    """A new puzzle, by hand or from a model. It may be wrong: it is saved as a draft either way.

    With `approve`, one that passes every check goes straight to approved (ready to
    publish); one that does not stays a draft and the response lists what to fix.
    """
    doc = body.model_dump(mode="json", exclude_none=True, exclude={"approve"})
    doc.update(id=await repo.unique_id(db, doc["category"], doc["answer"]), createdBy=p.subject_id)
    row = await repo.insert(db, doc)
    issues = await _problems(db, row)
    if body.approve and not issues:
        row = await repo.update(db, row["id"], {"status": "approved", "statusBy": p.subject_id}) or row
    return {**_out(row), "issues": issues}


@router.patch("/studio/puzzles/{puzzle_id}")
async def studio_edit(puzzle_id: str, body: PuzzlePatch, db: Db, p: CanWrite) -> dict[str, Any]:
    row = await repo.get(db, puzzle_id)
    if not row:
        raise NotFound("There is no such puzzle.")
    changes = body.model_dump(mode="json", exclude_none=True)
    merged = {**row, **changes}
    live = row["status"] == "published"
    if live:
        # A live puzzle is in front of children right now: a fix must leave it valid.
        codes = await _problems(db, merged)
        if codes:
            raise _refuse(codes)
    elif row["status"] == "approved":
        # Changed after approval: it has to be looked at again.
        changes["status"] = "draft"
    updated = await repo.update(db, puzzle_id, {**changes, "editedBy": p.subject_id})
    if live:
        await repo.bump(db)
    assert updated is not None
    return {**_out(updated), "issues": await _problems(db, updated)}


@router.post("/studio/puzzles/{puzzle_id}/status")
async def studio_status(puzzle_id: str, body: StatusIn, db: Db, p: CanWrite) -> dict[str, Any]:
    """Draft → approved (checked) → published (with the next release); live ↔ unpublished; rejected."""
    row = await repo.get(db, puzzle_id)
    if not row:
        raise NotFound("There is no such puzzle.")
    current, wanted = row["status"], body.status
    allowed = {
        "draft": {"approved", "rejected"},
        "approved": {"draft", "rejected"},
        "rejected": {"draft"},
        "published": {"retired"},
        "retired": {"published"},
    }
    if wanted not in allowed.get(current, set()):
        raise AppError(409, "bad_transition", f"A {current} puzzle cannot become {wanted}.")
    if wanted in ("approved", "published"):
        codes = await _problems(db, row)
        if codes:
            raise _refuse(codes)
    fields: dict[str, Any] = {"status": wanted, "note": body.note, "statusBy": p.subject_id}
    if wanted == "published":
        fields["publishedAt"] = row.get("publishedAt")
    updated = await repo.update(db, puzzle_id, fields)
    if "published" in (current, wanted):
        await repo.bump(db)
    assert updated is not None
    return {**_out(updated), "issues": await _problems(db, updated)}


@router.post("/studio/approve-all")
async def studio_approve_all(body: ApproveAllIn, db: Db, p: CanWrite) -> dict[str, Any]:
    """Approve every draft in view that passes every check; leave the rest for a person.

    For when the admin trusts a batch (their own seed puzzles, a clean AI run)
    and does not want to click each one. Nothing that fails a check is approved,
    so the checks stay the gate whoever presses the button.
    """
    approved, skipped = 0, 0
    for row in await repo.drafts_in_scope(db, body.category):
        if await _problems(db, row):
            skipped += 1
            continue
        await repo.update(db, row["id"], {"status": "approved", "statusBy": p.subject_id})
        approved += 1
    return {"approved": approved, "skipped": skipped}


@router.delete("/studio/puzzles/{puzzle_id}", status_code=204)
async def studio_delete(puzzle_id: str, db: Db, p: CanWrite) -> None:
    """Only a draft or a rejected one that is not seed data: anything else is unpublished or rejected, so it can come back."""
    row = await repo.get(db, puzzle_id)
    if not row:
        raise NotFound("There is no such puzzle.")
    if row["status"] not in ("draft", "rejected") or row.get("seeded"):
        raise AppError(409, "not_deletable", "Unpublish a live puzzle, or reject a seed puzzle, instead; it can be brought back.")
    await repo.delete(db, puzzle_id)


@router.post("/studio/publish")
async def studio_publish(body: PublishIn, db: Db, p: CanWrite) -> dict[str, Any]:
    """Make every approved puzzle live, as one release that can be taken back."""
    release = await repo.publish_approved(db, by=p.subject_id, note=body.note)
    if not release:
        raise AppError(409, "nothing_approved", "Approve some puzzles first.")
    return {**_out(release), "version": await repo.version(db)}


@router.get("/studio/releases")
async def studio_releases(db: Db, p: CanWrite) -> dict[str, Any]:
    rows = await repo.releases(db)
    who = await repo.names(db, {r["by"] for r in rows if r.get("by")})
    return {"releases": [{**_out(r), "byName": who.get(r.get("by", ""))} for r in rows]}


@router.post("/studio/releases/{number}/rollback")
async def studio_rollback(number: int, db: Db, p: CanWrite) -> dict[str, Any]:
    release = await repo.rollback(db, number)
    if not release:
        raise NotFound("That release is not live, or does not exist.")
    return {**_out(release), "rolledBack": True, "version": await repo.version(db)}


# ---- what the AI generator reads and writes -------------------------------------


@router.get("/studio/answers")
async def studio_answers(db: Db, p: CanWrite) -> dict[str, Any]:
    """Every answer in play, so a batch of new puzzles does not repeat one."""
    return {"answers": await repo.answers(db)}


@router.get("/studio/prompt")
async def studio_prompt(db: Db, p: CanWrite) -> dict[str, Any]:
    """The saved generation prompts, newest first. None saved means the built-in one is in use."""
    versions = await repo.prompts(db)
    return {"versions": [{**v, "at": v["at"]} for v in versions], "latest": versions[0] if versions else None}


@router.post("/studio/prompt", status_code=201)
async def studio_save_prompt(body: PromptIn, db: Db, p: CanWrite) -> dict[str, Any]:
    return await repo.save_prompt(db, text=body.text.strip(), by=p.subject_id)


@router.get("/studio/icon-usage")
async def studio_icon_usage(db: Db, p: CanWrite) -> dict[str, Any]:
    """For each drawing, how many puzzles use it: what a change to it would touch."""
    return {"usage": await repo.icon_usage(db)}
