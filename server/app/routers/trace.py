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

import json
import re
import secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import trace as trace_repo
from app.security import principal_can
from app.trace_verify import for_children, item_problems

router = APIRouter(prefix="/trace", tags=["trace"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]


def _may_author(p: CurrentPrincipal) -> Principal:
    if not principal_can(p, "trace:create"):
        raise Forbidden("Making trace collections needs the Trace Studio permission. Ask a Koda admin.", "not_a_trace_creator")
    return p


CanWrite = Annotated[Principal, Depends(_may_author)]

ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_ID = 64
# A draft can carry its guide picture (the Studio shrinks it to ~900px JPEG).
MAX_ITEM_BYTES = 1_500_000
MAX_ITEMS_PER_COLLECTION = 500
MAX_TITLE = 80
MAX_DESCRIPTION = 400


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


class CollectionOut(Model):
    id: str
    title: str
    description: str
    language: str
    itemIds: list[str]
    order: int
    cover: str | None
    rev: int
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
        rev=int(row.get("rev") or 0),
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
async def list_items(db: Db, _: CanWrite) -> dict[str, list[ItemOut]]:
    return {"items": [_item_out(r) for r in await trace_repo.list_items(db)]}


@router.put("/studio/items/{item_id}")
async def save_item(item_id: str, body: ItemWrite, db: Db, p: CanWrite) -> ItemOut:
    item_id = _id(item_id)
    draft = {"item": {**body.item, "id": item_id}, "plan": body.plan, "tests": body.tests}
    if len(json.dumps(draft, ensure_ascii=False).encode()) > MAX_ITEM_BYTES:
        raise AppError(413, "item_too_large", "This item is too large to save. Use a smaller guide picture.")
    return _item_out(await trace_repo.save_item(db, item_id, draft, p.subject_id))


@router.delete("/studio/items/{item_id}", status_code=204)
async def delete_item(item_id: str, db: Db, p: CanWrite) -> None:
    if not await trace_repo.delete_item(db, _id(item_id), p.subject_id):
        raise NotFound(f'No item "{item_id}".', "item_not_found")


# ------------------------------------------------------------------ studio: collections


@router.get("/studio/collections")
async def list_collections(db: Db, _: CanWrite) -> dict[str, list[CollectionOut]]:
    return {"collections": [_collection_out(r) for r in await trace_repo.list_collections(db)]}


@router.put("/studio/collections/{collection_id}")
async def save_collection(collection_id: str, body: CollectionWrite, db: Db, p: CanWrite) -> CollectionOut:
    collection_id = _id(collection_id)
    ids = [_id(i) for i in body.item_ids]
    if len(set(ids)) != len(ids):
        raise AppError(422, "duplicate_item", "An item can be in a collection only once.")
    cover = body.cover if body.cover in ids else None
    draft = {
        "title": body.title,
        "description": body.description,
        "language": body.language,
        "itemIds": ids,
        "order": body.order,
        "cover": cover,
    }
    return _collection_out(await trace_repo.save_collection(db, collection_id, draft, p.subject_id))


@router.post("/studio/collections/{collection_id}/check")
async def check_collection(collection_id: str, db: Db, _: CanWrite) -> dict[str, list[Problem]]:
    """What would stop this collection publishing, item by item — the same rules publish applies."""
    row = await trace_repo.get_collection(db, _id(collection_id))
    if row is None:
        raise NotFound(f'No collection "{collection_id}".', "collection_not_found")
    return {"problems": await _problems(db, row)}


async def _problems(db: Any, row: dict[str, Any]) -> list[Problem]:
    d = row.get("draft") or {}
    ids = d.get("itemIds", [])
    out: list[Problem] = []
    if not str(d.get("title", "")).strip():
        out.append(Problem(item="", title="", problems=["the collection has no title"]))
    if not ids:
        out.append(Problem(item="", title="", problems=["the collection has no items"]))
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
        "items": items,
    }
    return _collection_out(await trace_repo.publish(db, collection_id, bundle, p.subject_id))


@router.post("/studio/collections/{collection_id}/unpublish")
async def unpublish(collection_id: str, db: Db, p: CanWrite) -> CollectionOut:
    row = await trace_repo.unpublish(db, _id(collection_id), p.subject_id)
    if row is None:
        raise NotFound(f'No collection "{collection_id}".', "collection_not_found")
    return _collection_out(row)


@router.delete("/studio/collections/{collection_id}", status_code=204)
async def delete_collection(collection_id: str, db: Db, p: CanWrite) -> None:
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
