"""Single server-side write path for recommendation skips."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from ...models.event import LearningEvent
from ...models.recommendation import RecommendationRun, StudentSession


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def record_recommendation_skip(
    *,
    student_id: str,
    run_id: str,
    skill_id: str,
    assignment_id: str | None = None,
) -> dict:
    run = await RecommendationRun.find_one(
        RecommendationRun.run_id == run_id,
        RecommendationRun.student_id == student_id,
    )
    if not run:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recommendation run not found")
    served = next(
        (
            item for item in run.served_items
            if item.get("skill_id") == skill_id
            and (assignment_id is None or item.get("assignment_id") == assignment_id)
        ),
        None,
    )
    if not served:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Skill was not served by this recommendation run",
        )

    existing = await LearningEvent.find_one(
        LearningEvent.student_id == student_id,
        LearningEvent.recommendation_run_id == run_id,
        LearningEvent.curriculum_skill_id == skill_id,
        LearningEvent.event_type == "recommendation_skipped",
    )
    now = _now()
    if not existing:
        client_id = f"skip_{run_id}_{served['assignment_id']}_{skill_id}"
        event = LearningEvent(
            student_id=student_id,
            client_id=client_id,
            schema_version=1,
            session_id=run.session_id,
            occurred_at=now.isoformat(),
            client_timestamp_ms=round(now.timestamp() * 1000),
            event_type="recommendation_skipped",
            curriculum_skill_id=skill_id,
            curriculum_id=served.get("curriculum_id"),
            release_id=served.get("release_id"),
            assignment_id=served.get("assignment_id"),
            recommendation_run_id=run_id,
            verified=True,
            verification_error=None,
            actionSummary=f"Skipped recommended skill {served.get('skill_label') or skill_id}",
            details={"from": "recommendation"},
        )
        # The deterministic client id makes a retry idempotent at the DB index too.
        try:
            await event.insert()
            existing = event
            session = await StudentSession.find_one(
                StudentSession.student_id == student_id,
                StudentSession.session_id == run.session_id,
            )
            if session:
                session.events_count += 1
                session.last_seen_at = now
                await session.save()
        except DuplicateKeyError:
            existing = await LearningEvent.find_one(
                LearningEvent.student_id == student_id,
                LearningEvent.client_id == client_id,
            )

    if not any(
        decision.get("action") == "skipped"
        and decision.get("assignment_id") == served.get("assignment_id")
        and decision.get("skill_id") == skill_id
        for decision in run.decisions
    ):
        run.decisions.append({
            "action": "skipped",
            "assignment_id": served.get("assignment_id"),
            "skill_id": skill_id,
            "occurred_at": now.isoformat(),
            "event_id": existing.client_id if existing else uuid4().hex,
        })
    run.invalidated_at = now
    await run.save()
    return {
        "ok": True,
        "eventId": existing.client_id if existing else None,
        "requeuedAfter": "1 session",
    }
