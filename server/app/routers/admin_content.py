"""Who owns which Studio content, and moving it between people.

Content belongs to whoever made it (security.ownership). This is the admin's
view across every Studio: how much each person owns, and handing it over —
one item, or everything someone made — when a creator leaves or a book changes
hands. Only `content:all` reaches it.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, Db, require
from app.errors import AppError, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.security.policy import PLATFORM_PERMISSIONS, platform_can

router = APIRouter(prefix="/admin/content", tags=["admin content"], dependencies=[AUTHENTICATED])

CanSeeAll = Annotated[Principal, Depends(require("content:all"))]

Kind = Literal["book", "puzzle", "traceItem", "traceCollection", "art"]

#: Where each kind lives, the field naming its owner, and the field naming the item.
KINDS: dict[str, tuple[str, str, str]] = {
    "book": ("library_books", "ownerId", "id"),
    "puzzle": ("rebus_puzzles", "createdBy", "id"),
    "traceItem": ("trace_items", "ownerId", "id"),
    "traceCollection": ("trace_collections", "ownerId", "id"),
    "art": ("art_assets", "ownerId", "id"),
}
#: Content with no owner recorded (from before owners existed).
UNOWNED = "none"


def _live(collection: str) -> dict[str, Any]:
    # Rebus has no soft delete; the others keep tombstones.
    return {} if collection == "rebus_puzzles" else {"deletedAt": None}


def _owner_match(field: str, owner: str) -> dict[str, Any]:
    return {field: {"$in": [None, ""]}} if owner == UNOWNED else {field: owner}


async def _counts(db: Any) -> dict[str, dict[str, int]]:
    """{ownerId or "none": {kind: n}}."""
    out: dict[str, dict[str, int]] = {}
    for kind, (collection, field, _) in KINDS.items():
        pipeline = [{"$match": _live(collection)}, {"$group": {"_id": f"${field}", "n": {"$sum": 1}}}]
        async for row in db[collection].aggregate(pipeline):
            out.setdefault(row["_id"] or UNOWNED, {})[kind] = row["n"]
    return out


def _makers() -> list[str]:
    """Platform roles that can make Studio content: the people content can be moved to."""
    return [role for role in PLATFORM_PERMISSIONS if platform_can(role, "content:write")]


@router.get("/owners")
async def owners(db: Db, _: CanSeeAll) -> dict[str, Any]:
    """Everyone who owns content or can make it, with how much of each kind they own."""
    counts = await _counts(db)
    people: dict[str, dict[str, Any]] = {}
    async for user in db.users.find(
        {"$or": [{"_id": {"$in": [k for k in counts if k != UNOWNED]}}, {"platformRole": {"$in": _makers()}}]},
        {"email": 1, "displayName": 1, "platformRole": 1},
    ):
        people[user["_id"]] = {
            "id": user["_id"],
            "email": user["email"],
            "name": user.get("displayName") or user["email"],
            "role": user.get("platformRole", "none"),
            "counts": counts.get(user["_id"], {}),
        }
    rows = sorted(people.values(), key=lambda r: (-sum(r["counts"].values()), r["email"]))
    gone = {k: v for k, v in counts.items() if k != UNOWNED and k not in people}
    return {
        "owners": rows,
        "unowned": counts.get(UNOWNED, {}),
        # Owned by accounts that no longer exist: reassign them to someone who does.
        "orphaned": {kind: sum(c.get(kind, 0) for c in gone.values()) for kind in KINDS if any(kind in c for c in gone.values())},
        "orphanOwners": sorted(gone),
    }


class ReassignIn(Model):
    kind: Kind | Literal["all"]
    #: These items; or, with none given, everything `from` owns of that kind.
    ids: list[str] | None = Field(default=None, max_length=500)
    from_owner: str | None = Field(default=None, alias="from", max_length=64)
    to: str = Field(max_length=64)


@router.post("/reassign")
async def reassign(body: ReassignIn, db: Db, _: CanSeeAll) -> dict[str, Any]:
    target = await db.users.find_one({"_id": body.to}, {"_id": 1})
    if target is None:
        raise NotFound("No such account to give the content to.", "owner_not_found")
    if body.ids is None and body.from_owner is None:
        raise AppError(400, "nothing_chosen", "Name the items, or whose items, to move.")
    if body.ids is not None and body.kind == "all":
        raise AppError(400, "kind_needed", "Name the kind of the items being moved.")
    moved: dict[str, int] = {}
    for kind in KINDS if body.kind == "all" else [body.kind]:
        collection, field, key = KINDS[kind]
        match = {**_live(collection)}
        if body.ids is not None:
            match[key] = {"$in": body.ids}
        if body.from_owner is not None:
            match.update(_owner_match(field, body.from_owner))
        result = await db[collection].update_many(match, {"$set": {field: body.to}})
        if result.modified_count:
            moved[kind] = result.modified_count
    return {"moved": moved}
