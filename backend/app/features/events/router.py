"""Learning-event ingest (student writes its own) + read-back (guardian reads their kid's)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from ...models.student import Student
from ...models.user import User
from ...models.event import LearningEvent
from ...models.content import CurriculumRelease
from ...models.recommendation import RecommendationRun, StudentSession
from ...models.assignment import Assignment, ProgressionState
from ...core.runtime_settings import get_system_settings
from ..learning.progression import advance_frontier
from ..learning.skips import record_recommendation_skip
from ..progression.service import recompute_touched_mastery
from ...core.deps import get_current_student, get_current_user
from ...core.permissions import authorize_guardian_read
from .contract import (
    EventContractError,
    FIELD_MAP,
    QUESTION_EVENTS,
    normalize_event,
    validate_release_binding,
)
from .schemas import EventsIn, RecommendationSkipEventIn

# camelCase source keys consumed into canonical columns — removed from the
# diagnostic bag so they aren't stored twice (and can't collide as kwargs).
_CONSUMED_SOURCE_KEYS = frozenset(FIELD_MAP) | {"difficulty"}

router = APIRouter(tags=["events"])


async def _complete_recommendation_runs(student_id: str, docs: list[LearningEvent]) -> None:
    completed_run_ids = {
        doc.recommendation_run_id
        for doc in docs
        if doc.event_type == "lesson_complete" and doc.recommendation_run_id
    }
    for run_id in completed_run_ids:
        run = await RecommendationRun.find_one(
            RecommendationRun.run_id == run_id,
            RecommendationRun.student_id == student_id,
        )
        if not run:
            continue
        if not any(decision.get("action") == "completed" for decision in run.decisions):
            run.decisions.append({"action": "completed", "occurred_at": docs[-1].received_at.isoformat()})
        run.invalidated_at = docs[-1].received_at
        await run.save()


async def _apply_rapid_confirmation(student_id: str, docs: list[LearningEvent]) -> None:
    touched = {
        (doc.assignment_id, doc.release_id, doc.curriculum_skill_id)
        for doc in docs
        if doc.verified
        and doc.event_type == "attempt"
        and doc.outcome == "correct"
        and doc.attempt_number == 1
        and doc.assignment_id
        and doc.release_id
        and doc.curriculum_skill_id
    }
    if not touched:
        return
    settings_doc = await get_system_settings()
    threshold = int(((settings_doc.scoring or {}).get("placement") or {}).get("rapid_confirmation_plays", 2))
    for assignment_id, release_id, skill_id in touched:
        correct_first_try = await LearningEvent.find(
            LearningEvent.student_id == student_id,
            LearningEvent.assignment_id == assignment_id,
            LearningEvent.release_id == release_id,
            LearningEvent.curriculum_skill_id == skill_id,
            LearningEvent.event_type == "attempt",
            LearningEvent.outcome == "correct",
            LearningEvent.attempt_number == 1,
            LearningEvent.verified == True,
        ).count()
        if correct_first_try < threshold:
            continue
        try:
            assignment = await Assignment.get(PydanticObjectId(assignment_id))
        except Exception:
            assignment = None
        state = await ProgressionState.find_one(
            ProgressionState.student_id == student_id,
            ProgressionState.assignment_id == assignment_id,
        )
        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == release_id)
        if not assignment or not state or not release:
            continue
        result = advance_frontier(
            tree=release.tree,
            scope=assignment.scope,
            frontier_skill_id=state.frontier_skill_id,
            eligible_skill_ids=state.eligible_skill_ids,
            confirmed_skill_id=skill_id,
        )
        if result["changed"]:
            state.frontier_skill_id = result["frontier_skill_id"]
            state.eligible_skill_ids = result["eligible_skill_ids"]
            state.updated_at = docs[-1].received_at
            await state.save()


@router.post("/events")
async def ingest_events(body: EventsIn, student: Student = Depends(get_current_student)):
    """A student pushes a batch of its own events. student_id is forced from the
    token — the client's value is never trusted."""
    student_id = str(student.id)
    client_ids = [str(raw.get("id")) for raw in body.events if raw.get("id")]
    existing = set()
    if client_ids:
        rows = await LearningEvent.find(
            LearningEvent.student_id == student_id,
            {"client_id": {"$in": client_ids}},
        ).to_list()
        existing = {row.client_id for row in rows if row.client_id}
    docs: list[LearningEvent] = []
    unverified = 0
    release_cache: dict[str, CurriculumRelease | None] = {}
    for raw in body.events:
        data = dict(raw)
        data.pop("_id", None)
        client_id = data.pop("id", None)
        if client_id and client_id in existing:
            continue
        canonical = normalize_event(raw)
        has_curriculum_context = any(
            canonical.get(field)
            for field in ("curriculum_skill_id", "curriculum_id", "release_id", "assignment_id")
        )
        if (
            canonical["verified"]
            and canonical.get("event_type") in QUESTION_EVENTS
            and has_curriculum_context
        ):
            try:
                if not canonical.get("release_id"):
                    raise EventContractError("curriculum question events require releaseId")
                release_id = canonical["release_id"]
                if release_id not in release_cache:
                    release_cache[release_id] = await CurriculumRelease.find_one(
                        CurriculumRelease.release_id == release_id
                    )
                release = release_cache[release_id]
                if release is None:
                    raise EventContractError("releaseId does not exist")
                validate_release_binding(
                    canonical,
                    release_id=release.release_id,
                    curriculum_id=release.curriculum_id,
                    revision=release.revision,
                    question_manifest=release.question_manifest,
                )
            except EventContractError as exc:
                canonical["verified"] = False
                canonical["verification_error"] = str(exc)
        if not canonical["verified"]:
            unverified += 1
        # Everything not folded into a canonical column stays as a diagnostic extra.
        diagnostics = {k: v for k, v in data.items() if k not in _CONSUMED_SOURCE_KEYS}
        docs.append(
            LearningEvent(
                student_id=student_id,
                client_id=client_id,
                **canonical,
                **diagnostics,
            )
        )
    if docs:
        await LearningEvent.insert_many(docs)
        by_session: dict[str, int] = {}
        for doc in docs:
            if doc.session_id:
                by_session[doc.session_id] = by_session.get(doc.session_id, 0) + 1
        for session_id, count in by_session.items():
            session = await StudentSession.find_one(
                StudentSession.session_id == session_id,
                StudentSession.student_id == student_id,
            )
            if session:
                session.events_count += count
                session.last_seen_at = docs[-1].received_at
                await session.save()
        await _apply_rapid_confirmation(student_id, docs)
        await _complete_recommendation_runs(student_id, docs)
        mastery_updates = await recompute_touched_mastery(student_id, docs)
    else:
        mastery_updates = []
    return {
        "inserted": len(docs),
        "duplicates": len(body.events) - len(docs),
        "unverified": unverified,
        "masteryUpdates": mastery_updates,
    }


@router.post("/events/skip")
async def skip_event(
    body: RecommendationSkipEventIn,
    student: Student = Depends(get_current_student),
):
    return await record_recommendation_skip(
        student_id=str(student.id),
        run_id=body.recommendation_run_id,
        skill_id=body.skill_id,
    )


@router.get("/events")
async def read_events(
    student_id: str,
    limit: int = 500,
    user: User = Depends(get_current_user),
):
    await authorize_guardian_read(student_id, user)
    events = (
        await LearningEvent.find(LearningEvent.student_id == student_id)
        .sort(-LearningEvent.client_timestamp_ms)
        .limit(min(limit, 2000))
        .to_list()
    )
    return {"events": [e.model_dump(mode="json") for e in events]}
