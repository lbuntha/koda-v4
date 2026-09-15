"""What changed about a child's learning, and on which of their days.

A row each time a lesson became secure, a lesson was flagged as stuck, or the
daily time limit was spent. The notifications read nothing here — they are sent
as the change is noticed — but the weekly summary and the daily digest do: "this
week Mia mastered Count On" is a fact about a moment, and the rollup only knows
the state now.
"""

from datetime import timedelta
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

#: Long enough for a weekly summary delayed by quiet hours, and a margin.
KEEP_DAYS = 60


async def record(
    db: AsyncIOMotorDatabase,
    *,
    family_id: str,
    learner_id: str,
    kind: str,
    local_day: str,
    concept_key: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    """Write one mark down. Never raises: a summary line is not worth a failed sync."""
    try:
        await db.progress_marks.insert_one(
            {
                "_id": f"pm_{uuid4().hex[:20]}",
                "familyId": family_id,
                "learnerId": learner_id,
                "kind": kind,
                "conceptKey": concept_key,
                "localDay": local_day,
                "detail": detail or {},
                "at": now(),
            }
        )
    except Exception:  # noqa: BLE001
        pass


async def for_days(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, days: list[str]
) -> list[dict[str, Any]]:
    if not days:
        return []
    return await (
        db.progress_marks.find({"familyId": family_id, "learnerId": learner_id, "localDay": {"$in": days}})
        .sort("at", 1)
        .to_list(length=200)
    )


async def sweep(db: AsyncIOMotorDatabase) -> int:
    result = await db.progress_marks.delete_many({"at": {"$lt": now() - timedelta(days=KEEP_DAYS)}})
    return result.deleted_count
