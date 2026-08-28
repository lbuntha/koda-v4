"""The sidebar, as data.

Two layers in one collection: rows with `familyId: None` are the defaults every
family starts from, and a row with a `familyId` overrides the default of the
same `itemId` for that family alone. Overriding rather than replacing means a
new menu entry shipped in a release reaches families that have customised
theirs — which a whole-menu document would not.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def defaults(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.menu_items.find({"familyId": None}).sort("order", 1)
    return await cursor.to_list(length=100)


async def for_family(
    db: AsyncIOMotorDatabase, family_id: str | None, include_disabled: bool = False
) -> list[dict[str, Any]]:
    """Defaults with the family's own overrides folded in, in display order."""
    rows = await defaults(db)
    merged = {row["itemId"]: dict(row) for row in rows}

    if family_id:
        cursor = db.menu_items.find({"familyId": family_id})
        for override in await cursor.to_list(length=100):
            base = merged.get(override["itemId"], {})
            merged[override["itemId"]] = {
                **base,
                **{k: v for k, v in override.items() if k not in ("_id", "familyId")},
            }

    return sorted(
        (item for item in merged.values() if include_disabled or item.get("enabled", True)),
        key=lambda item: item.get("order", 100),
    )


async def seed_default(db: AsyncIOMotorDatabase, item: dict[str, Any]) -> bool:
    """Insert a shipped default if it is not there. Returns True if it was new.

    `$setOnInsert`, deliberately: a default somebody has edited must survive the
    next restart, or every deploy silently undoes their change.
    """
    result = await db.menu_items.update_one(
        {"familyId": None, "itemId": item["itemId"]},
        {"$setOnInsert": {**item, "familyId": None, "enabled": True, "updatedAt": now()}},
        upsert=True,
    )
    return result.upserted_id is not None


async def reconcile_visibility(db: AsyncIOMotorDatabase, item: dict[str, Any]) -> bool:
    """Bring one stored default's *visibility* back in line with the code.

    `seed_default` is `$setOnInsert`, which is right for a label somebody has
    improved and wrong for the rule that decides who sees an entry: a row seeded
    before `requires` existed keeps no requirement at all, so tightening a gate
    in `menu_defaults.py` reaches new deployments and silently misses every
    existing one. That is how the Skills entry ended up visible on a child's
    tablet, and how Art stayed on a parent's sidebar after its guard moved.

    Who may see a page is a security decision, so the code owns it — except
    where an operator has deliberately taken it over through the Menu screen,
    which stamps `visibilityPinned` and is left alone here. Presentation
    (label, icon, badge, order) is never touched: that is theirs.
    """
    row = await db.menu_items.find_one({"familyId": None, "itemId": item["itemId"]})
    if not row or row.get("visibilityPinned"):
        return False

    wanted = {"requires": item.get("requires"), "roles": item.get("roles")}
    if all(row.get(key) == value for key, value in wanted.items()):
        return False

    await db.menu_items.update_one(
        {"familyId": None, "itemId": item["itemId"]},
        {"$set": {**wanted, "updatedAt": now()}},
    )
    return True


async def remove_legacy_badge(
    db: AsyncIOMotorDatabase, item_id: str, legacy_badge: str
) -> bool:
    """Remove one obsolete shipped badge without touching customised menus.

    Defaults are deliberately create-only, so changing `menu_defaults.py` does
    not rewrite presentation that a publisher has edited. An exact match lets
    us retire wording the app itself used to ship while preserving every badge
    whose value differs from that legacy default.
    """
    result = await db.menu_items.update_one(
        {"familyId": None, "itemId": item_id, "badge": legacy_badge},
        {"$unset": {"badge": ""}, "$set": {"updatedAt": now()}},
    )
    return result.modified_count > 0


async def replace_legacy_label(
    db: AsyncIOMotorDatabase, item_id: str, legacy_label: str, new_label: str
) -> bool:
    """Rename an unchanged shipped label while preserving customised copies."""
    result = await db.menu_items.update_one(
        {"familyId": None, "itemId": item_id, "label": legacy_label},
        {"$set": {"label": new_label, "updatedAt": now()}},
    )
    return result.modified_count > 0


async def reset_default(db: AsyncIOMotorDatabase, item: dict[str, Any]) -> None:
    """Force a shipped default back to what the code says. Used by the CLI."""
    optional = {"badge", "requires", "roles"}
    unset = {
        **{key: "" for key in optional if key not in item},
        "visibilityPinned": "",
    }
    await db.menu_items.update_one(
        {"familyId": None, "itemId": item["itemId"]},
        {
            "$set": {**item, "familyId": None, "enabled": True, "updatedAt": now()},
            # Back to the shipped default means back to tracking it, so the next
            # tightening in code reaches this row too.
            "$unset": unset,
        },
        upsert=True,
    )


async def prune_orphans(db: AsyncIOMotorDatabase, known_ids: set[str]) -> int:
    """Delete default rows for entries the code no longer ships.

    Safe to do by construction: there is no route that *creates* a menu entry —
    `PATCH /menu/{id}` only edits one that exists — so a `familyId: None` row
    whose id is not in `DEFAULT_MENU` is always a leftover from an older
    release, pointing at a page this client has no route for.

    Leaving them is not harmless. `GET /menu/all` shows every row to an
    operator, dead ones included, so the Menu screen offers a Gemini API entry
    that can be renamed, re-ordered and re-gated — and none of that would make
    it lead anywhere. Any family overrides of a pruned entry go with it.
    """
    orphans = await db.menu_items.find(
        {"familyId": None, "itemId": {"$nin": list(known_ids)}}, {"itemId": 1}
    ).to_list(length=100)
    if not orphans:
        return 0

    dead = [row["itemId"] for row in orphans]
    await db.menu_items.delete_many({"itemId": {"$in": dead}})
    return len(dead)


async def set_for_family(
    db: AsyncIOMotorDatabase, family_id: str, item_id: str, patch: dict[str, Any]
) -> dict[str, Any]:
    await db.menu_items.update_one(
        {"familyId": family_id, "itemId": item_id},
        {"$set": {**patch, "familyId": family_id, "itemId": item_id, "updatedAt": now()}},
        upsert=True,
    )
    return await db.menu_items.find_one({"familyId": family_id, "itemId": item_id}) or {}


async def clear_family_override(db: AsyncIOMotorDatabase, family_id: str, item_id: str) -> bool:
    """Drop a family's override so the shipped default applies again.

    Deleting the override rather than copying the default into it: the entry
    then keeps tracking the default, so a label improved in a later release
    still reaches this family.
    """
    result = await db.menu_items.delete_one({"familyId": family_id, "itemId": item_id})
    return result.deleted_count > 0


async def get_default(db: AsyncIOMotorDatabase, item_id: str) -> dict[str, Any] | None:
    return await db.menu_items.find_one({"familyId": None, "itemId": item_id})


async def set_default(db: AsyncIOMotorDatabase, item_id: str, patch: dict[str, Any]) -> None:
    """Change what every family starts from. An operator's edit, not a parent's."""
    await db.menu_items.update_one(
        {"familyId": None, "itemId": item_id},
        {"$set": {**patch, "updatedAt": now()}},
        upsert=True,
    )
