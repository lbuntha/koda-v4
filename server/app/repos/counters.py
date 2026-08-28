"""The sync cursor: one monotonic integer per family.

Not a timestamp. Device clocks are wrong — children's tablets are the worst
offenders — and a cursor that can go backwards silently loses changes.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase


async def next_seq(db: AsyncIOMotorDatabase, family_id: str, count: int = 1) -> int:
    """Reserve `count` values and return the last one. Atomic in one round trip."""
    doc = await db.counters.find_one_and_update(
        {"_id": family_id},
        {"$inc": {"seq": count}},
        upsert=True,
        return_document=True,
    )
    return int(doc["seq"])


async def current(db: AsyncIOMotorDatabase, family_id: str) -> int:
    doc = await db.counters.find_one({"_id": family_id})
    return int(doc["seq"]) if doc else 0
