"""Koda Trace: trace items, the collections they are played in, and publishing.

Reading published collections is `settings:read`, which every signed-in device
has (a child's tablet draws its shelves) — every published collection is public.
Making items and collections is `trace:create`, a platform grant a Koda admin
gives to chosen adults (teachers, parents who make worksheets) and that no
family role — and so no child — can hold.

A draft may be anything, including half-finished: an author has to be able to
save their work. Publishing a collection is where the rules apply — every item
in it must pass `trace_verify` — and what is published is a frozen bundle: the
collection with its items inside, so a device downloads one thing per
collection and plays it offline.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
import secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import Field

from app import painting_store
from app.ages import clean_ages, is_age_range
from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import learners as learners_repo
from app.repos import paintings as paintings_repo
from app.repos import trace as trace_repo
from app.routers.library import AudioSaved, AudioWrite, ImageWrite, store_audio, store_image
from app.security import principal_can
from app.services.entitlements import entitlements
from app.topics import clean_topics
from app.trace_verify import for_children, item_problems

router = APIRouter(prefix="/trace", tags=["trace"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]


def _may_author(p: CurrentPrincipal) -> Principal:
    if not principal_can(p, "trace:create"):
        raise Forbidden("Making trace collections needs the Trace Studio permission. Ask a Koda admin.", "not_a_trace_creator")
    return p


CanWrite = Annotated[Principal, Depends(_may_author)]
CanReadChild = Annotated[Principal, Depends(require("learner:read"))]


def _is_admin(p: Principal) -> bool:
    """An operator: sees and edits every creator's work, publishes without review."""
    return principal_can(p, "content:write")


def _mine(row: dict[str, Any] | None, p: Principal) -> None:
    """A creator changes only what they made; an admin changes anything."""
    if row is not None and not _is_admin(p) and row.get("ownerId") != p.subject_id:
        raise Forbidden("Someone else made this. Only they or a Koda admin can change it.", "not_your_trace_work")


async def _room_for(db: Any, collection: str, p: Principal, limit: int) -> None:
    if not _is_admin(p) and await trace_repo.count_owned(db, collection, p.subject_id) >= limit:
        raise AppError(429, "trace_quota", f"You have reached the limit of {limit}. Delete some you no longer need, or ask a Koda admin.")


ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_ID = 64
# A draft can carry its guide picture (the Studio shrinks it to ~900px JPEG).
MAX_ITEM_BYTES = 1_500_000
MAX_ITEMS_PER_COLLECTION = 500
MAX_TITLE = 80
MAX_DESCRIPTION = 400
# How much one creator may make. Admins (who hold `content:write`) are not limited.
MAX_ITEMS_PER_CREATOR = 1500
MAX_COLLECTIONS_PER_CREATOR = 60


def _id(raw: str) -> str:
    if len(raw) > MAX_ID or not ID_PATTERN.fullmatch(raw):
        raise AppError(422, "bad_id", "An id is lowercase letters, numbers and dashes, at most 64 characters.")
    return raw


# ------------------------------------------------------------------ shapes


class ItemWrite(Model):
    item: dict[str, Any]
    plan: dict[str, Any]
    tests: dict[str, Any] = Field(default_factory=dict)


class ItemOut(Model):
    id: str
    item: dict[str, Any]
    plan: dict[str, Any]
    tests: dict[str, Any]
    updatedAt: str


class ReportWrite(Model):
    item_id: str = Field(alias="itemId", max_length=MAX_ID)
    collection_id: str | None = Field(default=None, alias="collectionId", max_length=MAX_ID)
    rev: int | None = Field(default=None, ge=0)
    reason: str
    note: str = Field(default="", max_length=400)


class CollectionWrite(Model):
    title: str = Field(max_length=MAX_TITLE)
    description: str = Field(default="", max_length=MAX_DESCRIPTION)
    language: str = Field(default="km", max_length=10)
    item_ids: list[str] = Field(default_factory=list, alias="itemIds", max_length=MAX_ITEMS_PER_COLLECTION)
    order: int = Field(default=100, ge=0, le=100_000)
    # Which item draws the collection's cover; the first item when absent.
    cover: str | None = Field(default=None, max_length=MAX_ID)
    # A cover picture made for the collection: an art-library name or a `photo-<hash>` key. The cover item draws it when absent.
    picture: str | None = Field(default=None, max_length=100, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    # What passing one writing step pays at three stars; the deployment's XP per level when absent.
    xp_per_step: int | None = Field(default=None, alias="xpPerStep", ge=0, le=500)
    # Who it is for, in years: [min, max]. Optional on a draft, required to publish.
    ages: list[int] | None = Field(default=None, min_length=2, max_length=2)
    # What it is about, from the shared list (app/topics.py). Optional.
    topics: list[str] | None = Field(default=None, max_length=40)


class CollectionOut(Model):
    id: str
    title: str
    description: str
    language: str
    itemIds: list[str]
    order: int
    cover: str | None
    picture: str | None = None
    xpPerStep: int | None = None
    ages: list[int] | None = None
    topics: list[str] | None = None
    rev: int
    ownerId: str | None = None
    # "pending" — waiting for an admin to approve it; "rejected" — sent back, with a note.
    reviewState: str | None = None
    reviewNote: str = ""
    publishedRev: int | None
    publishedAt: str | None
    updatedAt: str
    # Saved since it was published: children still play the older revision.
    changed: bool


class Problem(Model):
    item: str
    title: str
    problems: list[str]


def _item_out(row: dict[str, Any]) -> ItemOut:
    d = row.get("draft") or {}
    return ItemOut(
        id=row["id"], item=d.get("item") or {}, plan=d.get("plan") or {}, tests=d.get("tests") or {}, updatedAt=row["updatedAt"].isoformat()
    )


def _collection_out(row: dict[str, Any]) -> CollectionOut:
    d = row.get("draft") or {}
    pub = row.get("published")
    published_at = row.get("publishedAt")
    return CollectionOut(
        id=row["id"],
        title=d.get("title", ""),
        description=d.get("description", ""),
        language=d.get("language", "km"),
        itemIds=d.get("itemIds", []),
        order=d.get("order", 100),
        cover=d.get("cover"),
        picture=d.get("picture"),
        xpPerStep=d.get("xpPerStep"),
        ages=d.get("ages"),
        topics=d.get("topics"),
        rev=int(row.get("rev") or 0),
        ownerId=row.get("ownerId"),
        reviewState=(row.get("review") or {}).get("state"),
        reviewNote=(row.get("review") or {}).get("note", ""),
        publishedRev=pub["rev"] if pub else None,
        publishedAt=published_at.isoformat() if pub and published_at else None,
        updatedAt=row["updatedAt"].isoformat(),
        changed=bool(pub and published_at and row["updatedAt"] > published_at),
    )


# ------------------------------------------------------------------ readers


@router.get("/collections")
async def published_collections(db: Db, _: CanRead) -> dict[str, list[dict[str, Any]]]:
    """A device's shelves: each published collection's summary. Items come with the bundle."""
    out = []
    for b in await trace_repo.list_published(db):
        items = b.get("items", [])
        out.append(
            {
                "id": b["id"],
                "rev": b["rev"],
                "title": b.get("title", ""),
                "description": b.get("description", ""),
                "language": b.get("language", "km"),
                "count": len(items),
                # The chosen item's strokes are the cover (else the first); small, drawn without images.
                "cover": next((x["item"] for x in items if x["item"].get("id") == b.get("cover")), items[0]["item"] if items else None),
                "picture": b.get("picture"),
                "ages": b.get("ages"),
                "topics": b.get("topics"),
            }
        )
    return {"collections": out}


@router.get("/collections/{collection_id}")
async def published_bundle(collection_id: str, db: Db, _: CanRead) -> dict[str, Any]:
    """One collection to download and play offline: its live revision with every item inside."""
    row = await trace_repo.get_collection(db, _id(collection_id))
    if row is None or not row.get("published"):
        raise NotFound(f'No published collection "{collection_id}".', "collection_not_found")
    return row["published"]


# ------------------------------------------------------------------ studio: items


@router.get("/studio/items")
async def list_items(db: Db, p: CanWrite) -> dict[str, list[ItemOut]]:
    """A creator's own items; every item for an admin."""
    return {"items": [_item_out(r) for r in await trace_repo.list_items(db, None if _is_admin(p) else p.subject_id)]}


@router.put("/studio/items/{item_id}")
async def save_item(item_id: str, body: ItemWrite, db: Db, p: CanWrite) -> ItemOut:
    item_id = _id(item_id)
    draft = {"item": {**body.item, "id": item_id}, "plan": body.plan, "tests": body.tests}
    if len(json.dumps(draft, ensure_ascii=False).encode()) > MAX_ITEM_BYTES:
        raise AppError(413, "item_too_large", "This item is too large to save. Use a smaller guide picture.")
    existing = await trace_repo.get_item(db, item_id)
    _mine(existing, p)
    if existing is None:
        await _room_for(db, "trace_items", p, MAX_ITEMS_PER_CREATOR)
    return _item_out(await trace_repo.save_item(db, item_id, draft, p.subject_id))


@router.post("/studio/audio")
async def upload_audio(body: AudioWrite, p: CanWrite) -> AudioSaved:
    """A recording of an item said aloud. Kept with the library's clips, so it plays through `/library/audio/{id}`."""
    return await store_audio(body)


@router.post("/studio/images")
async def upload_image(body: ImageWrite, db: Db, p: CanWrite) -> AudioSaved:
    """A photo for a collection's cover. Kept with the library's photos, so it shows through `/library/images/{id}`."""
    return await store_image(body, db, p.subject_id)


@router.delete("/studio/items/{item_id}", status_code=204)
async def delete_item(item_id: str, db: Db, p: CanWrite) -> None:
    _mine(await trace_repo.get_item(db, _id(item_id)), p)
    if not await trace_repo.delete_item(db, _id(item_id), p.subject_id):
        raise NotFound(f'No item "{item_id}".', "item_not_found")


# ------------------------------------------------------------------ studio: collections


@router.get("/studio/collections")
async def list_collections(db: Db, p: CanWrite) -> dict[str, list[CollectionOut]]:
    return {"collections": [_collection_out(r) for r in await trace_repo.list_collections(db, None if _is_admin(p) else p.subject_id)]}


@router.put("/studio/collections/{collection_id}")
async def save_collection(collection_id: str, body: CollectionWrite, db: Db, p: CanWrite) -> CollectionOut:
    collection_id = _id(collection_id)
    ids = [_id(i) for i in body.item_ids]
    if len(set(ids)) != len(ids):
        raise AppError(422, "duplicate_item", "An item can be in a collection only once.")
    existing = await trace_repo.get_collection(db, collection_id)
    _mine(existing, p)
    if existing is None:
        await _room_for(db, "trace_collections", p, MAX_COLLECTIONS_PER_CREATOR)
    cover = body.cover if body.cover in ids else None
    draft = {
        "title": body.title,
        "description": body.description,
        "language": body.language,
        "itemIds": ids,
        "order": body.order,
        "cover": cover,
        "picture": body.picture,
        "xpPerStep": body.xp_per_step,
        "ages": clean_ages(body.ages),
        "topics": clean_topics(body.topics),
    }
    return _collection_out(await trace_repo.save_collection(db, collection_id, draft, p.subject_id))


@router.post("/studio/collections/{collection_id}/check")
async def check_collection(collection_id: str, db: Db, p: CanWrite) -> dict[str, list[Problem]]:
    """What would stop this collection publishing, item by item — the same rules publish applies."""
    row = await trace_repo.get_collection(db, _id(collection_id))
    if row is None:
        raise NotFound(f'No collection "{collection_id}".', "collection_not_found")
    _mine(row, p)
    return {"problems": await _problems(db, row)}


async def _problems(db: Any, row: dict[str, Any]) -> list[Problem]:
    d = row.get("draft") or {}
    ids = d.get("itemIds", [])
    out: list[Problem] = []
    if not str(d.get("title", "")).strip():
        out.append(Problem(item="", title="", problems=["the collection has no title"]))
    if not ids:
        out.append(Problem(item="", title="", problems=["the collection has no items"]))
    if not is_age_range(d.get("ages")):
        out.append(Problem(item="", title="", problems=["choose the grades this collection is for"]))
    found = await trace_repo.get_items(db, ids)
    for i in ids:
        r = found.get(i)
        if r is None:
            out.append(Problem(item=i, title=i, problems=["this item was deleted"]))
            continue
        dr = r.get("draft") or {}
        problems = item_problems(dr.get("item"), dr.get("plan"), dr.get("tests"))
        if problems:
            out.append(Problem(item=i, title=str((dr.get("item") or {}).get("title", i)), problems=problems))
    return out


@router.post("/studio/collections/{collection_id}/publish")
async def publish(collection_id: str, db: Db, p: CanWrite) -> CollectionOut:
    collection_id = _id(collection_id)
    row = await trace_repo.get_collection(db, collection_id)
    if row is None:
        raise NotFound(f'No collection "{collection_id}".', "collection_not_found")
    _mine(row, p)
    problems = await _problems(db, row)
    if problems:
        first = problems[:3]
        raise AppError(
            422,
            "not_publishable",
            "; ".join(f"{pr.title or 'collection'}: {pr.problems[0]}" for pr in first) + (" …" if len(problems) > 3 else ""),
        )
    d = row["draft"]
    found = await trace_repo.get_items(db, d["itemIds"])
    items = []
    for i in d["itemIds"]:
        dr = found[i]["draft"]
        items.append({"item": for_children(dr["item"]), "plan": dr["plan"]})
    bundle = {
        "title": d["title"],
        "description": d.get("description", ""),
        "language": d.get("language", "km"),
        "order": d.get("order", 100),
        "cover": d.get("cover"),
        "picture": d.get("picture"),
        "xpPerStep": d.get("xpPerStep"),
        "ages": d.get("ages"),
        "topics": d.get("topics"),
        "items": items,
    }
    if not _is_admin(p):
        # Public to every learner: a creator's collection waits for an admin.
        return _collection_out(await trace_repo.set_pending(db, collection_id, bundle, p.subject_id))
    return _collection_out(await trace_repo.publish(db, collection_id, bundle, p.subject_id))


@router.post("/studio/collections/{collection_id}/unpublish")
async def unpublish(collection_id: str, db: Db, p: CanWrite) -> CollectionOut:
    _mine(await trace_repo.get_collection(db, _id(collection_id)), p)
    row = await trace_repo.unpublish(db, _id(collection_id), p.subject_id)
    if row is None:
        raise NotFound(f'No collection "{collection_id}".', "collection_not_found")
    return _collection_out(row)


@router.delete("/studio/collections/{collection_id}", status_code=204)
async def delete_collection(collection_id: str, db: Db, p: CanWrite) -> None:
    _mine(await trace_repo.get_collection(db, _id(collection_id)), p)
    if not await trace_repo.delete_collection(db, _id(collection_id), p.subject_id):
        raise NotFound(f'No collection "{collection_id}".', "collection_not_found")


# ------------------------------------------------------------------ reports


@router.post("/reports", status_code=201)
async def report_item(body: ReportWrite, db: Db, p: CanRead) -> dict[str, str]:
    """A learner or parent flags an item: the strokes look wrong, it is too hard, or not for children."""
    if body.reason not in trace_repo.REPORT_REASONS:
        raise AppError(422, "bad_reason", "Choose one of the reasons offered.")
    report_id = secrets.token_hex(8)
    await trace_repo.add_report(
        db,
        {
            "id": report_id,
            "itemId": _id(body.item_id),
            "collectionId": _id(body.collection_id) if body.collection_id else None,
            "rev": body.rev,
            "reason": body.reason,
            "note": body.note.strip(),
            "reportedBy": p.subject_id,
        },
    )
    return {"id": report_id}


@router.get("/studio/reports")
async def list_reports(db: Db, _: CanWrite) -> dict[str, list[dict[str, Any]]]:
    rows = await trace_repo.open_reports(db)
    return {
        "reports": [
            {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in r.items() if k not in ("reportedBy", "resolvedAt")}
            for r in rows
        ]
    }


@router.post("/studio/reports/{report_id}/resolve", status_code=204)
async def resolve_report(report_id: str, db: Db, p: CanWrite) -> None:
    if not await trace_repo.resolve_report(db, report_id[:32], p.subject_id):
        raise NotFound("That report is already resolved or does not exist.", "report_not_found")


# ------------------------------------------------------------------ review (admins)


class ReviewDecision(Model):
    note: str = Field(default="", max_length=400)


def _admin(p: Principal) -> None:
    if not _is_admin(p):
        raise Forbidden("Only a Koda admin reviews collections.", "not_an_operator")


@router.get("/studio/review")
async def review_queue(db: Db, p: CanWrite) -> dict[str, list[dict[str, Any]]]:
    """Collections creators asked to publish, oldest first, with the items they would publish."""
    _admin(p)
    out = []
    for row in await trace_repo.list_pending(db):
        out.append({**_collection_out(row).model_dump(), "pending": row["pending"]})
    return {"collections": out}


@router.post("/studio/review/{collection_id}/approve")
async def approve(collection_id: str, db: Db, p: CanWrite) -> CollectionOut:
    _admin(p)
    row = await trace_repo.get_collection(db, _id(collection_id))
    if row is None or not row.get("pending"):
        raise NotFound("Nothing is waiting for review on this collection.", "nothing_pending")
    await trace_repo.publish(db, row["id"], row["pending"], p.subject_id)
    out = await trace_repo.close_review(db, row["id"], "approved", "", p.subject_id)
    assert out is not None
    return _collection_out(out)


@router.post("/studio/review/{collection_id}/reject")
async def reject(collection_id: str, body: ReviewDecision, db: Db, p: CanWrite) -> CollectionOut:
    _admin(p)
    row = await trace_repo.get_collection(db, _id(collection_id))
    if row is None or not row.get("pending"):
        raise NotFound("Nothing is waiting for review on this collection.", "nothing_pending")
    out = await trace_repo.close_review(db, row["id"], "rejected", body.note.strip(), p.subject_id)
    assert out is not None
    return _collection_out(out)


# ------------------------------------------------------------------ progress


def _top_fault(faults: Any) -> str | None:
    if not isinstance(faults, dict) or not faults:
        return None
    best = max(faults.items(), key=lambda kv: kv[1] if isinstance(kv[1], (int, float)) else 0)
    return best[0] if isinstance(best[1], (int, float)) and best[1] > 0 else None


@router.get("/learners/{learner_id}")
async def learner_progress(learner_id: str, db: Db, p: CanReadChild) -> dict[str, list[dict[str, Any]]]:
    """One child's writing and drawing, for the parent report: where they are on each item they have tried."""
    if p.family_id is None:
        raise Forbidden("This account is not part of a family.", "no_family")
    if p.learner_id and learner_id != p.learner_id:
        raise Forbidden("That is not this device's learner.", "not_your_learner")
    body = await trace_repo.learner_progress(db, p.family_id, learner_id)
    names = await trace_repo.titles(db)
    rows = []
    for item_id, rec in body.items():
        if not isinstance(rec, dict):
            continue
        name = names.get(item_id, {})
        rows.append(
            {
                "itemId": item_id,
                "title": name.get("title") or rec.get("title") or item_id,
                "collection": name.get("collection", ""),
                "kind": name.get("kind") or rec.get("kind", ""),
                "status": rec.get("status", "learning"),
                "step": rec.get("step", "watch"),
                "dueAt": rec.get("dueAt"),
                "attempts": rec.get("attempts", 0),
                "topFault": _top_fault(rec.get("faults")),
                "updatedAt": rec.get("updatedAt", 0),
            }
        )
    rows.sort(key=lambda r: r["updatedAt"] or 0, reverse=True)
    return {"items": rows}


@router.get("/studio/stats")
async def item_stats(db: Db, p: CanWrite) -> dict[str, dict[str, Any]]:
    """For each item: how many learners tried it, how many can write it, and their most common mistake.

    A creator sees numbers only for their own items. An item most children
    fail the same way usually has a stroke drawn wrongly — this is how to find it.
    """
    mine = None if _is_admin(p) else {r["id"] for r in await trace_repo.list_items(db, p.subject_id)}
    out: dict[str, dict[str, Any]] = {}
    for body in await trace_repo.all_progress(db):
        for item_id, rec in body.items():
            if not isinstance(rec, dict) or (mine is not None and item_id not in mine):
                continue
            s = out.setdefault(item_id, {"learners": 0, "canDo": 0, "attempts": 0, "faults": {}})
            s["learners"] += 1
            s["canDo"] += 1 if rec.get("status") in ("canDo", "learned") else 0
            s["attempts"] += int(rec.get("attempts") or 0)
            for fault, n in (rec.get("faults") or {}).items():
                if isinstance(n, (int, float)):
                    s["faults"][fault] = s["faults"].get(fault, 0) + n
    for s in out.values():
        s["topFault"] = _top_fault(s.pop("faults"))
    return out


# ------------------------------------------------------------------ AI starter strokes


@router.get("/studio/ai")
async def ai_allowed(db: Db, p: CanWrite) -> dict[str, Any]:
    """May this creator ask the AI to order strokes? A paid feature (`trace.ai`); Koda admins always may.

    The Studio asks to decide what to offer, and the AI route asks before it
    spends anything — one rule, answered here.
    """
    if _is_admin(p) or principal_can(p, "system:write"):
        return {"allowed": True}
    state = await entitlements(db, p.family_id, staff=False)
    if "trace.ai" in (state.get("features") or []):
        return {"allowed": True}
    return {"allowed": False, "reason": "plan_required"}


# ------------------------------------------------------------------ paintings
#
# A child's finished colouring picture. The device keeps it first and sends it
# here when it can (see src/trace/paint/gallery.ts); the parent report and the
# child's other tablets read it back. One per child per picture: a newer
# painting replaces the older one, and an older one arriving late (a tablet
# that was offline) never replaces a newer one.

CanAppendChild = Annotated[Principal, Depends(require("learner_data:append"))]
MAX_PAINTING_BYTES = 2 * 1024 * 1024
ITEM_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")


class PaintingWrite(Model):
    image: str  # base64 PNG
    title: str = Field(default="", max_length=120)
    collection_id: str | None = Field(default=None, alias="collectionId", max_length=MAX_ID)
    accuracy: int = Field(ge=0, le=100)
    stars: int = Field(ge=0, le=3)
    own_colours: bool = Field(default=False, alias="ownColours")
    painted_at: int = Field(alias="paintedAt", ge=0)


async def _child_of(db: Any, p: Principal, learner_id: str) -> str:
    """The family whose child this is — the caller's own, and only a learner in it."""
    if p.family_id is None:
        raise Forbidden("This account is not part of a family.", "no_family")
    if p.learner_id and learner_id != p.learner_id:
        raise Forbidden("That is not this device's learner.", "not_your_learner")
    if await learners_repo.by_id(db, learner_id, p.family_id) is None:
        raise NotFound("No such learner in this family.", "learner_not_found")
    return p.family_id


def _painting_out(row: dict[str, Any]) -> dict[str, Any]:
    return {k: row.get(k) for k in ("itemId", "title", "collectionId", "accuracy", "stars", "ownColours", "paintedAt", "imageId")}


@router.put("/paintings/{learner_id}/{item_id}")
async def save_painting(learner_id: str, item_id: str, body: PaintingWrite, db: Db, p: CanAppendChild) -> dict[str, Any]:
    """Keep a child's finished painting (a newer one of the same picture wins)."""
    if not ITEM_ID.fullmatch(item_id):
        raise AppError(422, "bad_id", "That is not a picture id.")
    family_id = await _child_of(db, p, learner_id)
    try:
        data = base64.b64decode(body.image, validate=True)
    except (binascii.Error, ValueError):
        raise AppError(400, "invalid_image", "The painting is not valid base64.") from None
    if not data.startswith(painting_store.PNG_MAGIC):
        raise AppError(415, "unsupported_image", "A painting must be a PNG.")
    if len(data) > MAX_PAINTING_BYTES:
        raise AppError(413, "image_too_large", "A painting may be at most 2 MB.")
    existing = await paintings_repo.get(db, family_id, learner_id, item_id)
    if existing and (existing.get("paintedAt") or 0) > body.painted_at:
        return _painting_out(existing)
    image_id = await painting_store.put(data)
    row, replaced = await paintings_repo.save(
        db,
        family_id,
        learner_id,
        item_id,
        {
            "imageId": image_id,
            "bytes": len(data),
            "title": body.title,
            "collectionId": body.collection_id,
            "accuracy": body.accuracy,
            "stars": body.stars,
            "ownColours": body.own_colours,
            "paintedAt": body.painted_at,
        },
    )
    if replaced and not await paintings_repo.image_in_use(db, replaced):
        await painting_store.delete(replaced)
    return _painting_out(row)


@router.get("/paintings/{learner_id}")
async def list_paintings(learner_id: str, db: Db, p: CanReadChild) -> dict[str, list[dict[str, Any]]]:
    """A child's paintings, newest first: their gallery, and the parent report's."""
    family_id = await _child_of(db, p, learner_id)
    return {"paintings": [_painting_out(r) for r in await paintings_repo.for_learner(db, family_id, learner_id)]}


@router.get("/paintings/{learner_id}/{item_id}/image")
async def painting_image(learner_id: str, item_id: str, db: Db, p: CanReadChild) -> Response:
    """The painting itself. Only for the child's own family."""
    family_id = await _child_of(db, p, learner_id)
    row = await paintings_repo.get(db, family_id, learner_id, item_id)
    data = await painting_store.get(row["imageId"]) if row else None
    if data is None:
        raise NotFound("No such painting.", "painting_not_found")
    return Response(
        content=data,
        media_type=painting_store.CONTENT_TYPE,
        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/paintings/{learner_id}/{item_id}", status_code=204)
async def delete_painting(learner_id: str, item_id: str, db: Db, p: CanAppendChild) -> None:
    family_id = await _child_of(db, p, learner_id)
    orphan = await paintings_repo.remove(db, family_id, learner_id, item_id)
    if orphan:
        await painting_store.delete(orphan)
