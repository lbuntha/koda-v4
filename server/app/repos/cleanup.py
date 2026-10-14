"""Hard deletes for the operator's Data cleanup page.

Everything else in the service soft-deletes (`deletedAt`) so a mistake can be
walked back. These do not: they are for clearing test accounts, test progress
and test content out of a deployment, and a row left behind is the thing the
operator came here to be rid of.

Per-family learning resets carry a generation, like the global one in
`maintenance.py`: a tablet holding an old outbox would otherwise upload it on
its next connection and put the erased XP straight back.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app import painting_store
from app.models.common import now
from app.repos import notify_prefs, notify_schedule, paintings, push_tokens

LEARNING_DOC_KINDS = ["progress", "levels"]


async def _ids(cursor, field: str = "_id") -> list[Any]:
    return [row[field] for row in await cursor.to_list(length=None)]


# ------------------------------------------------------------------ learning


async def clear_family_learning(
    db: AsyncIOMotorDatabase, family_ids: list[str], actor_id: str
) -> dict[str, int]:
    """XP, levels, mastery and the events behind them, for these families only."""
    if not family_ids:
        return {}
    # Generation first, for the same reason as the global reset: a device that
    # reconnects mid-delete discards its queue instead of re-uploading it.
    await db.families.update_many(
        {"_id": {"$in": family_ids}},
        {"$inc": {"learningResetVersion": 1}, "$set": {"learningResetAt": now(), "learningResetBy": actor_id}},
    )
    in_family = {"familyId": {"$in": family_ids}}
    learner_ids = await _ids(db.learners.find(in_family, {"_id": 1}))
    member_ids = await _ids(db.memberships.find(in_family, {"userId": 1}), "userId")
    events = await db.events.delete_many(in_family)
    concepts = await db.concept_totals.delete_many(in_family)
    documents = await db.docs.delete_many({**in_family, "kind": {"$in": LEARNING_DOC_KINDS}})
    marks = await db.progress_marks.delete_many(in_family)
    profiles = await db.profile_stats.delete_many({"_id": {"$in": learner_ids + member_ids}})
    return {
        "events": events.deleted_count,
        "conceptTotals": concepts.deleted_count,
        "progressDocuments": documents.deleted_count,
        "progressMarks": marks.deleted_count,
        "profileStats": profiles.deleted_count,
    }


async def family_learning_version(db: AsyncIOMotorDatabase, family_id: str) -> int:
    row = await db.families.find_one({"_id": family_id}, {"learningResetVersion": 1}) or {}
    return int(row.get("learningResetVersion", 0))


# ------------------------------------------------------------------ families and users


async def _forget_paintings(db: AsyncIOMotorDatabase, query: dict[str, Any]) -> int:
    rows = await db.trace_paintings.find(query, {"imageId": 1}).to_list(length=None)
    if not rows:
        return 0
    await db.trace_paintings.delete_many(query)
    for image_id in {row.get("imageId") for row in rows if row.get("imageId")}:
        if not await paintings.image_in_use(db, image_id):
            await painting_store.delete(image_id)
    return len(rows)


async def purge_family(db: AsyncIOMotorDatabase, family_id: str) -> dict[str, int]:
    """The family and everything recorded under it. Member *accounts* survive."""
    in_family = {"familyId": family_id}
    learner_ids = await _ids(db.learners.find(in_family, {"_id": 1}))
    counts = {
        "paintings": await _forget_paintings(db, in_family),
        "events": (await db.events.delete_many(in_family)).deleted_count,
        "conceptTotals": (await db.concept_totals.delete_many(in_family)).deleted_count,
        "documents": (await db.docs.delete_many(in_family)).deleted_count,
        "progressMarks": (await db.progress_marks.delete_many(in_family)).deleted_count,
        "learners": (await db.learners.delete_many(in_family)).deleted_count,
        "memberships": (await db.memberships.delete_many(in_family)).deleted_count,
        "devices": (await db.devices.delete_many(in_family)).deleted_count,
    }
    await db.invites.delete_many(in_family)
    await db.push_tokens.delete_many(in_family)
    await db.leaderboard_privacy.delete_many(in_family)
    await db.menu_items.delete_many(in_family)
    await db.subscriptions.delete_one({"_id": family_id})
    await db.upgrade_requests.delete_one({"_id": family_id})
    if learner_ids:
        await db.skill_registrations.delete_many({"ownerType": "learner", "ownerId": {"$in": learner_ids}})
        await db.profile_stats.delete_many({"_id": {"$in": learner_ids}})
        await db.buddy_invites.delete_many({"learnerId": {"$in": learner_ids}})
        await db.buddy_relationships.delete_many({"participants.learnerId": {"$in": learner_ids}})
    counts["families"] = (await db.families.delete_one({"_id": family_id})).deleted_count
    return counts


async def purge_user(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, int]:
    """The account, the families it owns, and its seat in any other family.

    Guards (yourself, the last admin) are the router's; this only deletes.
    """
    totals: dict[str, int] = {}
    for membership in await db.memberships.find({"userId": user_id}).to_list(length=None):
        if membership.get("role") == "owner":
            for key, value in (await purge_family(db, membership["familyId"])).items():
                totals[key] = totals.get(key, 0) + value
        else:
            await db.memberships.delete_one({"_id": membership["_id"]})
            totals["memberships"] = totals.get("memberships", 0) + 1
    await db.devices.delete_many({"userId": user_id})
    await db.skill_registrations.delete_many({"ownerType": "user", "ownerId": user_id})
    await db.profile_stats.delete_one({"_id": user_id})
    await db.notifications.delete_many({"userId": user_id})
    await push_tokens.delete_for_user(db, user_id)
    await notify_prefs.forget_user(db, user_id)
    await notify_schedule.forget_user(db, user_id)
    totals["users"] = (await db.users.delete_one({"_id": user_id})).deleted_count
    return totals


async def user_impact(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any]:
    """What `purge_user` would remove, for the confirmation an operator reads first."""
    owned: list[dict[str, Any]] = []
    joined: list[dict[str, Any]] = []
    for membership in await db.memberships.find({"userId": user_id}).to_list(length=None):
        family_id = membership["familyId"]
        family = await db.families.find_one({"_id": family_id}, {"name": 1}) or {}
        entry: dict[str, Any] = {"familyId": family_id, "familyName": family.get("name", ""), "role": membership.get("role")}
        if membership.get("role") == "owner":
            entry["learners"] = await db.learners.count_documents({"familyId": family_id})
            others = await db.memberships.find(
                {"familyId": family_id, "userId": {"$ne": user_id}}, {"userId": 1}
            ).to_list(length=None)
            other_ids = [row["userId"] for row in others]
            other_users = await db.users.find({"_id": {"$in": other_ids}}, {"email": 1}).to_list(length=None)
            entry["otherMembers"] = sorted(row["email"] for row in other_users)
            owned.append(entry)
        else:
            joined.append(entry)
    return {"ownedFamilies": owned, "otherFamilies": joined}


# ------------------------------------------------------------------ Trace Studio


async def trace_listing(db: AsyncIOMotorDatabase) -> dict[str, list[dict[str, Any]]]:
    """Every item and collection, soft-deleted ones included."""
    items = await db.trace_items.find(
        {}, {"_id": 0, "id": 1, "draft.item.title": 1, "ownerId": 1, "updatedAt": 1, "deletedAt": 1}
    ).sort("updatedAt", -1).to_list(length=None)
    collections = await db.trace_collections.find(
        {}, {"_id": 0, "id": 1, "draft.title": 1, "ownerId": 1, "updatedAt": 1, "deletedAt": 1, "published.id": 1, "rev": 1}
    ).sort("updatedAt", -1).to_list(length=None)
    painted = {
        row["_id"]: row["n"]
        for row in await db.trace_paintings.aggregate([{"$group": {"_id": "$itemId", "n": {"$sum": 1}}}]).to_list(length=None)
    }
    return {
        "items": [
            {
                "id": row["id"],
                "title": str(((row.get("draft") or {}).get("item") or {}).get("title") or row["id"]),
                "ownerId": row.get("ownerId"),
                "updatedAt": row.get("updatedAt"),
                "deleted": row.get("deletedAt") is not None,
                "paintings": painted.get(row["id"], 0),
            }
            for row in items
        ],
        "collections": [
            {
                "id": row["id"],
                "title": str((row.get("draft") or {}).get("title") or row["id"]),
                "ownerId": row.get("ownerId"),
                "updatedAt": row.get("updatedAt"),
                "deleted": row.get("deletedAt") is not None,
                "published": bool(row.get("published")),
                "rev": int(row.get("rev") or 0),
            }
            for row in collections
        ],
    }


async def delete_trace(
    db: AsyncIOMotorDatabase,
    item_ids: list[str],
    collection_ids: list[str],
) -> dict[str, int]:
    counts = {"items": 0, "collections": 0, "revisions": 0, "reports": 0, "paintings": 0}
    if collection_ids:
        counts["revisions"] += (await db.trace_revisions.delete_many({"collectionId": {"$in": collection_ids}})).deleted_count
        counts["reports"] += (await db.trace_reports.delete_many({"collectionId": {"$in": collection_ids}})).deleted_count
        counts["collections"] = (await db.trace_collections.delete_many({"id": {"$in": collection_ids}})).deleted_count
    if item_ids:
        counts["reports"] += (await db.trace_reports.delete_many({"itemId": {"$in": item_ids}})).deleted_count
        # A painting of a picture that no longer exists cannot be opened again.
        counts["paintings"] = await _forget_paintings(db, {"itemId": {"$in": item_ids}})
        counts["items"] = (await db.trace_items.delete_many({"id": {"$in": item_ids}})).deleted_count
        # Drafts that still list them would fail their next publish check.
        await db.trace_collections.update_many(
            {"draft.itemIds": {"$in": item_ids}},
            {"$pull": {"draft.itemIds": {"$in": item_ids}}, "$set": {"updatedAt": now()}},
        )
    return counts


async def delete_all_trace(db: AsyncIOMotorDatabase) -> dict[str, int]:
    return {
        "paintings": await _forget_paintings(db, {}),
        "items": (await db.trace_items.delete_many({})).deleted_count,
        "collections": (await db.trace_collections.delete_many({})).deleted_count,
        "revisions": (await db.trace_revisions.delete_many({})).deleted_count,
        "reports": (await db.trace_reports.delete_many({})).deleted_count,
    }


# ------------------------------------------------------------------ Library


async def library_listing(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    rows = await db.library_books.find(
        {},
        {"_id": 0, "id": 1, "draft.title": 1, "published.title": 1, "updatedAt": 1, "deletedAt": 1, "rev": 1, "updatedBy": 1},
    ).sort("updatedAt", -1).to_list(length=None)
    reports = {
        row["_id"]: row["n"]
        for row in await db.library_reports.aggregate([{"$group": {"_id": "$bookId", "n": {"$sum": 1}}}]).to_list(length=None)
    }
    return [
        {
            "id": row["id"],
            "title": str(
                (row.get("draft") or {}).get("title") or (row.get("published") or {}).get("title") or row["id"]
            ),
            "updatedAt": row.get("updatedAt"),
            "updatedBy": row.get("updatedBy"),
            "deleted": row.get("deletedAt") is not None,
            "published": bool(row.get("published")),
            "rev": int(row.get("rev") or 0),
            "reports": reports.get(row["id"], 0),
        }
        for row in rows
    ]


async def delete_books(db: AsyncIOMotorDatabase, book_ids: list[str]) -> dict[str, int]:
    if not book_ids:
        return {"books": 0, "revisions": 0, "reports": 0}
    return {
        "revisions": (await db.library_revisions.delete_many({"bookId": {"$in": book_ids}})).deleted_count,
        "reports": (await db.library_reports.delete_many({"bookId": {"$in": book_ids}})).deleted_count,
        "books": (await db.library_books.delete_many({"id": {"$in": book_ids}})).deleted_count,
    }


async def delete_all_library(db: AsyncIOMotorDatabase, include_unit_voices: bool) -> dict[str, int]:
    counts = {
        "books": (await db.library_books.delete_many({})).deleted_count,
        "revisions": (await db.library_revisions.delete_many({})).deleted_count,
        "reports": (await db.library_reports.delete_many({})).deleted_count,
        # Photos are only ever placed in books, so with no books none is used.
        "images": (await db.library_images.delete_many({})).deleted_count,
    }
    if include_unit_voices:
        counts["unitVoices"] = (await db.library_unit_voices.delete_many({})).deleted_count
    return counts


# ------------------------------------------------------------------ summary


async def summary(db: AsyncIOMotorDatabase) -> dict[str, int]:
    async def count(collection: str, query: dict[str, Any] | None = None) -> int:
        return await db[collection].count_documents(query or {})

    return {
        "users": await count("users"),
        "families": await count("families"),
        "learners": await count("learners"),
        "events": await count("events"),
        "profileStats": await count("profile_stats"),
        "traceItems": await count("trace_items"),
        "traceCollections": await count("trace_collections"),
        "tracePaintings": await count("trace_paintings"),
        "libraryBooks": await count("library_books"),
        "libraryImages": await count("library_images"),
        "libraryUnitVoices": await count("library_unit_voices"),
    }
