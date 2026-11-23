"""Deployment-wide registry for bundled learning skills."""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def list_all(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.skill_registry.find({"deletedAt": None}).sort("id", 1)
    return await cursor.to_list(length=1000)


async def get(db: AsyncIOMotorDatabase, skill_id: str) -> dict[str, Any] | None:
    return await db.skill_registry.find_one({"id": skill_id, "deletedAt": None})


async def seed_default(db: AsyncIOMotorDatabase, manifest: dict[str, Any]) -> bool:
    """Register a bundled skill while preserving an operator's release choice.

    Code-owned metadata follows the deployed manifest. Publication is omitted
    from updates after the first insert, so a restart cannot silently publish a
    skill an operator moved back to draft.
    """
    timestamp = now()
    skill_id = manifest["id"]
    status = manifest.get("status", "draft")
    # `title` sits with the editable set, not with the metadata: it is an
    # operator's rename, and a deploy that re-set it would undo their edit on
    # every restart. The manifest's own `name` still follows the code.
    editable = {
        key: manifest.get(key)
        for key in ("title", "tagline", "thumbnail", "features", "settings")
    }
    metadata = {
        key: value
        for key, value in manifest.items()
        if key not in {"id", "status", "title", "tagline", "thumbnail", "features", "settings"}
    }
    result = await db.skill_registry.update_one(
        {"id": skill_id},
        {
            "$set": {
                **metadata,
                "updatedAt": timestamp,
                "updatedBy": "deploy",
                "deletedAt": None,
            },
            "$setOnInsert": {
                "id": skill_id,
                "status": status,
                **editable,
                "isEnabled": True,
                "lessonContent": {},
                "rev": 1,
                "createdAt": timestamp,
                **(
                    {
                        "publishedBy": {"id": "deploy", "displayName": "Deployment manifest"},
                        "publishedAt": timestamp,
                    }
                    if status == "published"
                    else {}
                ),
            },
        },
        upsert=True,
    )
    if result.upserted_id is None:
        await _add_new_features(db, skill_id, manifest.get("features") or [])
    return result.upserted_id is not None


async def _add_new_features(db: AsyncIOMotorDatabase, skill_id: str, declared: list[dict[str, Any]]) -> None:
    """Give an existing row the features a later release declared, as the manifest sets them.

    Features are the operator's after the first insert, so a restart never
    touches one already there: switched off stays off. But a feature the row
    has never heard of would otherwise never reach the Skill Manager at all —
    nobody could see it, let alone switch it.
    """
    row = await db.skill_registry.find_one({"id": skill_id}, {"features.id": 1})
    known = {f.get("id") for f in (row or {}).get("features") or []}
    missing = [f for f in declared if f.get("id") not in known]
    if missing:
        await db.skill_registry.update_one({"id": skill_id}, {"$push": {"features": {"$each": missing}}})


async def set_status(
    db: AsyncIOMotorDatabase,
    skill_id: str,
    status: str,
    actor: dict[str, str],
) -> dict[str, Any] | None:
    timestamp = now()
    changed = {
        "status": status,
        "updatedAt": timestamp,
        "updatedBy": actor["id"],
        "statusChangedBy": actor,
        "statusChangedAt": timestamp,
    }
    # Keep this attribution when a skill returns to draft: it answers who last
    # published the release, while statusChangedBy answers who withdrew it.
    if status == "published":
        changed.update({"publishedBy": actor, "publishedAt": timestamp})
    result = await db.skill_registry.update_one(
        {"id": skill_id, "deletedAt": None},
        {
            "$set": changed,
            "$inc": {"rev": 1},
        },
    )
    if result.matched_count == 0:
        return None
    return await get(db, skill_id)


async def set_configuration(
    db: AsyncIOMotorDatabase,
    skill_id: str,
    configuration: dict[str, Any],
    actor: dict[str, str],
) -> dict[str, Any] | None:
    """Replace the complete editable Skills-page configuration.

    One snapshot makes offline coalescing safe: ten slider movements become one
    queued write, and the last complete state is what another device receives.
    Identity, version and publication are deliberately not accepted here.
    """
    timestamp = now()
    result = await db.skill_registry.update_one(
        {"id": skill_id, "deletedAt": None},
        {
            "$set": {
                **configuration,
                "updatedAt": timestamp,
                "updatedBy": actor["id"],
                "configurationChangedBy": actor,
                "configurationChangedAt": timestamp,
            },
            "$inc": {"rev": 1},
        },
    )
    if result.matched_count == 0:
        return None
    return await get(db, skill_id)
