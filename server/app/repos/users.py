import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now
from app.services.entitlements import is_live


async def by_email(db: AsyncIOMotorDatabase, email: str) -> dict[str, Any] | None:
    return await db.users.find_one({"email": email.lower()})


async def by_id(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any] | None:
    return await db.users.find_one({"_id": user_id})


async def create(
    db: AsyncIOMotorDatabase,
    email: str,
    password_hash: str,
    platform_role: str = "none",
    display_name: str | None = None,
) -> dict[str, Any]:
    timestamp = now()
    doc = {
        "_id": f"u_{uuid4().hex[:20]}",
        "email": email.lower(),
        "displayName": display_name.strip() if display_name else None,
        "avatarSeed": f"a_{uuid4().hex[:20]}",
        "passwordHash": password_hash,
        "platformRole": platform_role,
        "status": "active",
        "totpSecret": None,
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "lastLoginAt": None,
    }
    await db.users.insert_one(doc)
    return doc


async def ensure_avatar_seed(db: AsyncIOMotorDatabase, user_id: str) -> str:
    """Backfill one stable, opaque DiceBear seed for older accounts."""
    seed = f"a_{uuid4().hex[:20]}"
    row = await db.users.find_one_and_update(
        {
            "_id": user_id,
            "$or": [
                {"avatarSeed": {"$exists": False}},
                {"avatarSeed": None},
                {"avatarSeed": ""},
            ],
        },
        {"$set": {"avatarSeed": seed, "updatedAt": now()}},
        return_document=ReturnDocument.AFTER,
    )
    if row:
        return row["avatarSeed"]
    existing = await by_id(db, user_id)
    return existing.get("avatarSeed", seed) if existing else seed


async def touch_login(db: AsyncIOMotorDatabase, user_id: str, at: datetime | None = None) -> None:
    await db.users.update_one({"_id": user_id}, {"$set": {"lastLoginAt": at or now()}})


async def list_for_admin(
    db: AsyncIOMotorDatabase,
    *,
    query: str = "",
    status: str | None = None,
    role: str | None = None,
    onboarding: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict[str, Any]], int]:
    """A paged cross-family account view, used only by the admin router."""
    filters: list[dict[str, Any]] = []
    if query.strip():
        pattern = re.escape(query.strip())
        filters.append(
            {"$or": [
                {"email": {"$regex": pattern, "$options": "i"}},
                {"displayName": {"$regex": pattern, "$options": "i"}},
            ]}
        )
    if status == "active":
        filters.append({"$or": [{"status": "active"}, {"status": {"$exists": False}}]})
    elif status == "suspended":
        filters.append({"status": "suspended"})

    if onboarding == "pending":
        filters.append({"lastLoginAt": None})
        filters.append({"$or": [{"status": "active"}, {"status": {"$exists": False}}]})
    elif onboarding == "completed":
        filters.append({"lastLoginAt": {"$ne": None}})
        filters.append({"$or": [{"status": "active"}, {"status": {"$exists": False}}]})
    elif onboarding == "blocked":
        filters.append({"status": "suspended"})

    family_roles = {"owner", "parent", "caregiver", "child", "student", "learner"}
    if role in family_roles:
        member_ids = await db.memberships.distinct("userId", {"role": role})
        filters.append({"_id": {"$in": member_ids}})
    elif role:
        if role == "none":
            filters.append(
                {"$or": [{"platformRole": "none"}, {"platformRole": {"$exists": False}}]}
            )
        else:
            filters.append({"platformRole": role})

    mongo_filter: dict[str, Any] = {"$and": filters} if filters else {}
    total = await db.users.count_documents(mongo_filter)
    rows = await (
        db.users.find(mongo_filter, {"passwordHash": 0, "totpSecret": 0})
        .sort("createdAt", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list(length=page_size)
    )
    if not rows:
        return [], total

    user_ids = [row["_id"] for row in rows]
    member_rows = await db.memberships.find({"userId": {"$in": user_ids}}).to_list(length=500)
    family_ids = list({row["familyId"] for row in member_rows})
    family_rows = (
        await db.families.find({"_id": {"$in": family_ids}}).to_list(length=500)
        if family_ids else []
    )
    family_names = {row["_id"]: row.get("name", "") for row in family_rows}

    # What each family is actually on, so the operator running this page can see
    # who is paying without opening Billing and searching for them by name.
    # Batched: one query for the page, then the shared lapse rule per row —
    # `is_live` rather than a second copy of it, because a page that disagreed
    # with the tutor proxy about who has Koda is worse than a page with no plan
    # on it at all.
    sub_rows = (
        await db.subscriptions.find({"familyId": {"$in": family_ids}}).to_list(length=500)
        if family_ids else []
    )
    plan_names = {
        row["_id"]: row.get("name", row["_id"])
        for row in await db.plans.find({}).to_list(length=50)
    }
    plan_of: dict[str, dict[str, Any]] = {}
    for sub in sub_rows:
        live = is_live(sub)
        plan_id = sub.get("planId", "free") if live else "free"
        plan_of[sub["familyId"]] = {
            "planId": plan_id,
            "planName": plan_names.get(plan_id, "Free"),
            "live": live and plan_id != "free",
        }

    memberships_by_user: dict[str, list[dict[str, Any]]] = {user_id: [] for user_id in user_ids}
    for member in member_rows:
        family_id = member["familyId"]
        plan = plan_of.get(family_id, {"planId": "free", "planName": "Free", "live": False})
        memberships_by_user.setdefault(member["userId"], []).append(
            {
                "familyId": family_id,
                "familyName": family_names.get(family_id, ""),
                "role": member.get("role", "parent"),
                **plan,
            }
        )

    sessions = await db.devices.aggregate([
        {
            "$match": {
                "userId": {"$in": user_ids},
                "revokedAt": None,
                "refreshHash": {"$type": "string"},
            }
        },
        {"$group": {"_id": "$userId", "count": {"$sum": 1}}},
    ]).to_list(length=len(user_ids))
    active_sessions = {row["_id"]: row["count"] for row in sessions}

    for row in rows:
        row["memberships"] = memberships_by_user.get(row["_id"], [])
        row["activeSessionCount"] = active_sessions.get(row["_id"], 0)
    return rows, total


async def admin_stats(db: AsyncIOMotorDatabase) -> dict[str, int]:
    active_filter = {"$or": [{"status": "active"}, {"status": {"$exists": False}}]}
    return {
        "total": await db.users.count_documents({}),
        "active": await db.users.count_documents(active_filter),
        "suspended": await db.users.count_documents({"status": "suspended"}),
        "staff": await db.users.count_documents(
            {"platformRole": {"$nin": ["none", None]}}
        ),
        "pendingOnboarding": await db.users.count_documents(
            {"$and": [active_filter, {"lastLoginAt": None}]}
        ),
        "completedOnboarding": await db.users.count_documents(
            {"$and": [active_filter, {"lastLoginAt": {"$ne": None}}]}
        ),
        "blockedOnboarding": await db.users.count_documents({"status": "suspended"}),
    }


async def update_account(
    db: AsyncIOMotorDatabase, user_id: str, patch: dict[str, Any]
) -> dict[str, Any] | None:
    patch = {**patch, "updatedAt": now()}
    return await db.users.find_one_and_update(
        {"_id": user_id}, {"$set": patch}, return_document=ReturnDocument.AFTER,
    )


async def set_password(db: AsyncIOMotorDatabase, user_id: str, password_hash: str) -> bool:
    result = await db.users.update_one(
        {"_id": user_id},
        {"$set": {"passwordHash": password_hash, "updatedAt": now()}},
    )
    return result.matched_count == 1


async def active_admin_count(db: AsyncIOMotorDatabase) -> int:
    return await db.users.count_documents({
        "platformRole": "admin",
        "$or": [{"status": "active"}, {"status": {"$exists": False}}],
    })


async def delete_account(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    result = await db.users.delete_one({"_id": user_id})
    if result.deleted_count:
        await db.devices.delete_many({"userId": user_id})
        await db.skill_registrations.delete_many(
            {"ownerType": "user", "ownerId": user_id}
        )
    return result.deleted_count == 1


async def set_reset_token(
    db: AsyncIOMotorDatabase, user_id: str, token_hash: str, expires_at: datetime
) -> None:
    """Store a reset token's hash, replacing any outstanding one.

    Replacing rather than accumulating: asking twice should not leave two live
    doors, and the most recent request is the one the person is looking at.
    """
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"resetTokenHash": token_hash, "resetExpiresAt": expires_at}},
    )


async def by_reset_token(
    db: AsyncIOMotorDatabase, token_hash: str, at: datetime
) -> dict[str, Any] | None:
    """The account a live token belongs to. Expiry is part of the query, so an
    aged token is simply not found rather than found-and-then-checked."""
    return await db.users.find_one(
        {"resetTokenHash": token_hash, "resetExpiresAt": {"$gt": at}}
    )


async def clear_reset_token(db: AsyncIOMotorDatabase, user_id: str) -> None:
    """Single use. Spending the token is what removes it."""
    await db.users.update_one(
        {"_id": user_id}, {"$unset": {"resetTokenHash": "", "resetExpiresAt": ""}}
    )
