"""The operator's Data cleanup page: permanent deletes of accounts, XP and content.

Gated on *both* `user:manage` and `system:write`, which only the built-in admin
role holds together: a developer can author Trace and Library content but must
not be able to wipe it for everyone, and support can see accounts but never
delete one.

Every write here is a hard delete — see `repos/cleanup.py` — so the page shows
a preview first, and the "everything" routes take a typed confirmation the
server checks too, because a button is a hint and not a rule.
"""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, Db, require
from app.errors import AppError, Conflict
from app.models.auth import Principal
from app.models.common import Model
from app.repos import cleanup as cleanup_repo
from app.repos import maintenance as maintenance_repo
from app.repos import users as users_repo

router = APIRouter(prefix="/admin/cleanup", tags=["admin cleanup"], dependencies=[AUTHENTICATED])

CanClean = Annotated[Principal, Depends(require("user:manage", "system:write"))]

#: What an "everything" request must carry, typed by the operator.
CONFIRM_WORD = "DELETE"
MAX_IDS = 500

Ids = Annotated[list[str], Field(default_factory=list, max_length=MAX_IDS)]


class UserIdsIn(Model):
    user_ids: Ids = Field(alias="userIds")


class XpIn(Model):
    scope: Literal["users", "all"]
    user_ids: Ids = Field(alias="userIds")
    confirm: str = ""


class TraceDeleteIn(Model):
    item_ids: Ids = Field(alias="itemIds")
    collection_ids: Ids = Field(alias="collectionIds")
    #: Every row already in the bin (soft-deleted from the studio), on top of the ids.
    purge_deleted: bool = Field(default=False, alias="purgeDeleted")
    all: bool = False
    confirm: str = ""


class LibraryDeleteIn(Model):
    book_ids: Ids = Field(alias="bookIds")
    purge_deleted: bool = Field(default=False, alias="purgeDeleted")
    all: bool = False
    include_unit_voices: bool = Field(default=False, alias="includeUnitVoices")
    confirm: str = ""


class UserResult(Model):
    id: str
    email: str | None = None
    deleted: bool
    error: str | None = None
    code: str | None = None


class UsersDeleteOut(Model):
    results: list[UserResult]
    deleted: dict[str, int]


class CleanupOut(Model):
    deleted: dict[str, int]


def _add(totals: dict[str, int], more: dict[str, int]) -> None:
    for key, value in more.items():
        totals[key] = totals.get(key, 0) + value


def _confirmed(confirm: str) -> None:
    if confirm.strip() != CONFIRM_WORD:
        raise AppError(422, "confirmation_required", f'Type {CONFIRM_WORD} to confirm.')


def _iso(value) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else value


async def _family_ids_of(db: Db, user_ids: list[str]) -> list[str]:
    rows = await db.memberships.find({"userId": {"$in": user_ids}}, {"familyId": 1}).to_list(length=None)
    return sorted({row["familyId"] for row in rows})


@router.get("/summary")
async def summary(db: Db, p: CanClean) -> dict[str, int]:
    return await cleanup_repo.summary(db)


# ------------------------------------------------------------------ users


@router.post("/users/preview")
async def preview_users(body: UserIdsIn, db: Db, p: CanClean) -> dict[str, list[dict[str, Any]]]:
    out = []
    for user_id in body.user_ids:
        row = await users_repo.by_id(db, user_id)
        if not row:
            continue
        out.append({
            "id": user_id,
            "email": row["email"],
            "isYou": user_id == p.subject_id,
            **await cleanup_repo.user_impact(db, user_id),
        })
    return {"users": out}


@router.post("/users/delete")
async def delete_users(body: UserIdsIn, db: Db, p: CanClean) -> UsersDeleteOut:
    """Each account on its own: one refusal does not stop the rest."""
    results: list[UserResult] = []
    totals: dict[str, int] = {}
    for user_id in dict.fromkeys(body.user_ids):
        target = await users_repo.by_id(db, user_id)
        if not target:
            results.append(UserResult(id=user_id, deleted=False, error="No such user account.", code="not_found"))
            continue
        if user_id == p.subject_id:
            results.append(UserResult(
                id=user_id, email=target["email"], deleted=False,
                error="You cannot delete the account you are using.", code="cannot_delete_self",
            ))
            continue
        if (
            target.get("platformRole") == "admin"
            and target.get("status", "active") == "active"
            and await users_repo.active_admin_count(db) <= 1
        ):
            results.append(UserResult(
                id=user_id, email=target["email"], deleted=False,
                error="At least one active administrator must remain.", code="last_active_admin",
            ))
            continue
        _add(totals, await cleanup_repo.purge_user(db, user_id))
        results.append(UserResult(id=user_id, email=target["email"], deleted=True))
    return UsersDeleteOut(results=results, deleted=totals)


# ------------------------------------------------------------------ XP


@router.post("/xp")
async def clear_xp(body: XpIn, db: Db, p: CanClean) -> CleanupOut:
    """XP, levels, stars and mastery — for some accounts' families, or everyone."""
    if body.scope == "all":
        _confirmed(body.confirm)
        _versions, deleted = await maintenance_repo.reset_learning(db, p.subject_id)
        return CleanupOut(deleted=deleted)
    if not body.user_ids:
        raise Conflict("Choose at least one account.", "nothing_selected")
    family_ids = await _family_ids_of(db, body.user_ids)
    deleted = await cleanup_repo.clear_family_learning(db, family_ids, p.subject_id)
    # Staff and other family-less accounts still carry their own profile figures.
    deleted["profileStats"] = deleted.get("profileStats", 0) + (
        await db.profile_stats.delete_many({"_id": {"$in": body.user_ids}})
    ).deleted_count
    deleted["families"] = len(family_ids)
    return CleanupOut(deleted=deleted)


# ------------------------------------------------------------------ Trace Studio


@router.get("/trace")
async def trace_listing(db: Db, p: CanClean) -> dict[str, list[dict[str, Any]]]:
    listing = await cleanup_repo.trace_listing(db)
    for group in listing.values():
        for row in group:
            row["updatedAt"] = _iso(row.get("updatedAt"))
    return listing


@router.post("/trace/delete")
async def delete_trace(body: TraceDeleteIn, db: Db, p: CanClean) -> CleanupOut:
    if body.all:
        _confirmed(body.confirm)
        return CleanupOut(deleted=await cleanup_repo.delete_all_trace(db))
    item_ids = list(body.item_ids)
    collection_ids = list(body.collection_ids)
    if body.purge_deleted:
        item_ids += [r["id"] for r in await db.trace_items.find({"deletedAt": {"$ne": None}}, {"id": 1}).to_list(length=None)]
        collection_ids += [
            r["id"] for r in await db.trace_collections.find({"deletedAt": {"$ne": None}}, {"id": 1}).to_list(length=None)
        ]
    if not item_ids and not collection_ids:
        raise Conflict("Choose something to delete.", "nothing_selected")
    deleted = await cleanup_repo.delete_trace(db, sorted(set(item_ids)), sorted(set(collection_ids)))
    return CleanupOut(deleted=deleted)


# ------------------------------------------------------------------ Library


@router.get("/library")
async def library_listing(db: Db, p: CanClean) -> dict[str, list[dict[str, Any]]]:
    books = await cleanup_repo.library_listing(db)
    for row in books:
        row["updatedAt"] = _iso(row.get("updatedAt"))
    return {"books": books}


@router.post("/library/delete")
async def delete_library(body: LibraryDeleteIn, db: Db, p: CanClean) -> CleanupOut:
    if body.all:
        _confirmed(body.confirm)
        return CleanupOut(deleted=await cleanup_repo.delete_all_library(db, body.include_unit_voices))
    book_ids = list(body.book_ids)
    if body.purge_deleted:
        book_ids += [r["id"] for r in await db.library_books.find({"deletedAt": {"$ne": None}}, {"id": 1}).to_list(length=None)]
    if not book_ids:
        raise Conflict("Choose something to delete.", "nothing_selected")
    return CleanupOut(deleted=await cleanup_repo.delete_books(db, sorted(set(book_ids))))
