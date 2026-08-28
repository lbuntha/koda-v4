"""Per-concept totals, incremented as events land.

Why a rollup at all: raw events age out (400-day TTL), and "a month of practice
still counts" has to survive that. The client keeps the same shape locally, so
the two can be compared — which is exactly what the P1 acceptance test does.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne


async def apply(db: AsyncIOMotorDatabase, increments: list[dict[str, Any]]) -> None:
    """Apply pre-computed increments. Called only for events that were new."""
    if not increments:
        return

    operations = []
    for item in increments:
        update: dict[str, Any] = {}
        if item.get("inc"):
            update["$inc"] = item["inc"]
        if item.get("set"):
            update["$max"] = item["set"]
        if item.get("add"):
            update["$addToSet"] = {k: {"$each": v} for k, v in item["add"].items()}
        if not update:
            continue
        operations.append(
            UpdateOne(
                {
                    "familyId": item["familyId"],
                    "learnerId": item["learnerId"],
                    "conceptKey": item["conceptKey"],
                },
                update,
                upsert=True,
            )
        )

    if operations:
        await db.concept_totals.bulk_write(operations, ordered=False)


async def for_learner(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str
) -> list[dict[str, Any]]:
    cursor = db.concept_totals.find(
        {"familyId": family_id, "learnerId": learner_id}, {"_id": 0}
    ).sort("conceptKey", 1)
    return await cursor.to_list(length=500)
