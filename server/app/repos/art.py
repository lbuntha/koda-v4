"""The deploy-wide SVG library stored in MongoDB."""

import hashlib
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def list_all(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.art_assets.find({"deletedAt": None}).sort("id", 1)
    return await cursor.to_list(length=5000)


async def get(db: AsyncIOMotorDatabase, asset_id: str) -> dict[str, Any] | None:
    return await db.art_assets.find_one({"id": asset_id, "deletedAt": None})


async def put(
    db: AsyncIOMotorDatabase, asset_id: str, category: str, markup: str, updated_by: str | None
) -> tuple[dict[str, Any], bool, bool]:
    existing = await db.art_assets.find_one({"id": asset_id})
    created = existing is None or existing.get("deletedAt") is not None
    moved = bool(existing and existing.get("category") != category)
    timestamp = now()
    await db.art_assets.update_one(
        {"id": asset_id},
        {
            "$set": {
                "category": category,
                "markup": markup,
                "updatedAt": timestamp,
                "updatedBy": updated_by,
                "deletedAt": None,
            },
            "$setOnInsert": {"id": asset_id, "createdAt": timestamp},
            "$inc": {"rev": 1},
        },
        upsert=True,
    )
    row = await db.art_assets.find_one({"id": asset_id})
    assert row is not None
    return row, created, moved


async def move(
    db: AsyncIOMotorDatabase,
    asset_id: str,
    to_id: str,
    category: str,
    updated_by: str | None,
) -> dict[str, Any] | None:
    existing = await get(db, asset_id)
    if existing is None:
        return None

    timestamp = now()
    if to_id == asset_id:
        await db.art_assets.update_one(
            {"id": asset_id, "deletedAt": None},
            {
                "$set": {"category": category, "updatedAt": timestamp, "updatedBy": updated_by},
                "$inc": {"rev": 1},
            },
        )
        return await get(db, asset_id)

    # Keep a tombstone at the old id so startup seeding never resurrects a
    # renamed bundled asset. The new row carries the same markup and a fresh id.
    await db.art_assets.update_one(
        {"id": asset_id},
        {
            "$set": {"deletedAt": timestamp, "updatedAt": timestamp, "updatedBy": updated_by},
            "$inc": {"rev": 1},
        },
    )
    await db.art_assets.update_one(
        {"id": to_id},
        {
            "$set": {
                "category": category,
                "markup": existing["markup"],
                "updatedAt": timestamp,
                "updatedBy": updated_by,
                "deletedAt": None,
            },
            "$setOnInsert": {"id": to_id, "createdAt": timestamp},
            "$inc": {"rev": 1},
        },
        upsert=True,
    )
    return await get(db, to_id)


async def delete(db: AsyncIOMotorDatabase, asset_id: str, updated_by: str | None) -> bool:
    timestamp = now()
    result = await db.art_assets.update_one(
        {"id": asset_id, "deletedAt": None},
        {
            "$set": {"deletedAt": timestamp, "updatedAt": timestamp, "updatedBy": updated_by},
            "$inc": {"rev": 1},
        },
    )
    return result.modified_count > 0


def seed_digest(asset: dict[str, Any]) -> str:
    """What the bundle says this asset is, as one short string.

    Only the two fields the seeder writes. A digest over the whole document
    would change every time an unrelated field was added and re-write every
    seed-owned row on the next boot for no reason.
    """
    payload = f"{asset.get('category', '')}\n{asset.get('markup', '')}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


async def seed_default(db: AsyncIOMotorDatabase, asset: dict[str, Any]) -> str:
    """Keep a bundled asset in step with the file it came from.

    The library is read before the bundle (`SvgAsset`), so on a deployment that
    has booted once, the row *is* the artwork and the `.svg` in the repo is
    nothing but a first-boot fixture. Editing a file therefore changed nothing
    anybody could see, which is not a rule anyone would choose — it is what
    `$setOnInsert` did, and it made the repo's own art unmaintainable.

    So a row the seed still owns follows its file. `seedHash` records what the
    bundle last said; when the file changes, the row is rewritten to match.

    What that must never touch:

    * **An operator's edit.** `updatedBy` stops being `"seed"` the moment
      somebody saves through the Art page, and from then on the row is theirs.
      A release may ship a different drawing; it does not get to undo their work.
    * **A tombstone.** A deleted asset stays deleted, which is the guarantee
      `test_deleted_seed_asset_does_not_return_on_restart` is about.

    Returns what happened, so startup can say so: a deploy that repaints an icon
    for every family should be legible in the log rather than silent.
    """
    timestamp = now()
    digest = seed_digest(asset)
    existing = await db.art_assets.find_one({"id": asset["id"]})

    if existing is None:
        await db.art_assets.update_one(
            {"id": asset["id"]},
            {
                "$setOnInsert": {
                    **asset,
                    "rev": 1,
                    "createdAt": timestamp,
                    "updatedAt": timestamp,
                    "updatedBy": "seed",
                    "seedHash": digest,
                    "deletedAt": None,
                }
            },
            upsert=True,
        )
        return "created"

    # Theirs now, or gone on purpose. Either way the bundle has no say.
    if existing.get("updatedBy") != "seed" or existing.get("deletedAt") is not None:
        return "kept"

    # A row seeded before this existed carries no hash. It is still seed-owned,
    # so the file is what it should have been all along: update it and stamp it,
    # and every later boot is a no-op.
    if existing.get("seedHash") == digest:
        return "kept"

    await db.art_assets.update_one(
        {"id": asset["id"], "updatedBy": "seed", "deletedAt": None},
        {
            "$set": {
                "category": asset["category"],
                "markup": asset["markup"],
                "updatedAt": timestamp,
                "seedHash": digest,
            },
            "$inc": {"rev": 1},
        },
    )
    return "updated"
