"""Learning-event ingest (student writes its own) + read-back (guardian reads their kid's)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from ...models.student import Student
from ...models.user import User
from ...models.event import LearningEvent
from ...models.content import CurriculumRelease
from ...models.recommendation import RecommendationRun, StudentSession
from ...models.assignment import Assignment, ProgressionState
from ...core.logging import get_logger
from ...core.runtime_settings import get_system_settings
from ..learning.progression import advance_frontier
from ..learning.skips import record_recommendation_skip
from ..progression.service import recompute_touched_mastery
from ...core.deps import get_current_student, get_current_user
from ...core.permissions import authorize_guardian_read
from ..content.grading import GradingError, grade
from .contract import (
    EventContractError,
    FIELD_MAP,
    QUESTION_EVENTS,
    normalize_event,
    validate_release_binding,
)
from .schemas import EventsIn, RecommendationSkipEventIn

logger = get_logger("events")

# camelCase source keys consumed into canonical columns — removed from the
# diagnostic bag so they aren't stored twice (and can't collide as kwargs).
_CONSUMED_SOURCE_KEYS = frozenset(FIELD_MAP) | {"difficulty"}

router = APIRouter(tags=["events"])


def _manifest_entry(release: CurriculumRelease, question_id: str | None) -> dict | None:
    return next(
        (item for item in release.question_manifest if item.get("question_id") == question_id),
        None,
    )


async def _verify_lesson_completions(
    student_id: str,
    docs: list[LearningEvent],
    release_cache: dict[str, CurriculumRelease | None],
) -> None:
    """Only verify completion after every released question was solved.

    Correct attempts can already exist in Mongo because the browser outbox
    flushes in small batches, or can be in the same not-yet-inserted batch as
    the completion event.
    """
    completions = [doc for doc in docs if doc.event_type == "lesson_complete" and doc.verified]
    for completion in completions:
        try:
            assignment = await Assignment.get(PydanticObjectId(completion.assignment_id))
        except Exception:
            assignment = None
        if (
            not assignment
            or assignment.student_id != student_id
            or assignment.release_id != completion.release_id
            or assignment.curriculum_id != completion.curriculum_id
        ):
            completion.verified = False
            completion.verification_error = "lesson completion does not match the student's assignment"
            continue
        release = release_cache.get(completion.release_id or "")
        if release is None and completion.release_id:
            release = await CurriculumRelease.find_one(
                CurriculumRelease.release_id == completion.release_id
            )
            release_cache[completion.release_id] = release
        required_ids = {
            item.get("question_id")
            for item in (release.question_manifest if release else [])
            if item.get("skill_id") == completion.curriculum_skill_id
        }
        required_ids.discard(None)
        if not required_ids:
            completion.verified = False
            completion.verification_error = "lesson skill has no released questions"
            continue

        stored = await LearningEvent.find(
            LearningEvent.student_id == student_id,
            LearningEvent.session_id == completion.session_id,
            LearningEvent.assignment_id == completion.assignment_id,
            LearningEvent.release_id == completion.release_id,
            LearningEvent.curriculum_skill_id == completion.curriculum_skill_id,
            LearningEvent.event_type == "attempt",
            LearningEvent.outcome == "correct",
            LearningEvent.verified == True,
        ).to_list()
        correct_ids = {row.question_id for row in stored}
        correct_ids.update(
            row.question_id
            for row in docs
            if row is not completion
            and row.verified
            and row.event_type == "attempt"
            and row.outcome == "correct"
            and row.session_id == completion.session_id
            and row.assignment_id == completion.assignment_id
            and row.release_id == completion.release_id
            and row.curriculum_skill_id == completion.curriculum_skill_id
        )
        missing = sorted(required_ids - correct_ids)
        if missing:
            completion.verified = False
            completion.verification_error = (
                "lesson completion is missing verified correct attempts for: "
                + ", ".join(missing)
            )


async def _complete_recommendation_runs(student_id: str, docs: list[LearningEvent]) -> None:
    completions = {
        (
            doc.recommendation_run_id,
            doc.assignment_id,
            doc.release_id,
            doc.curriculum_id,
            doc.curriculum_skill_id,
        )
        for doc in docs
        if doc.verified and doc.event_type == "lesson_complete" and doc.recommendation_run_id
    }
    for run_id, assignment_id, release_id, curriculum_id, skill_id in completions:
        run = await RecommendationRun.find_one(
            RecommendationRun.run_id == run_id,
            RecommendationRun.student_id == student_id,
        )
        if not run:
            continue
        if not any(
            decision.get("action") == "completed"
            and decision.get("assignment_id") == assignment_id
            and decision.get("skill_id") == skill_id
            for decision in run.decisions
        ):
            run.decisions.append({
                "action": "completed",
                "assignment_id": assignment_id,
                "release_id": release_id,
                "curriculum_id": curriculum_id,
                "skill_id": skill_id,
                "occurred_at": docs[-1].received_at.isoformat(),
            })
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
                if canonical.get("event_type") == "attempt":
                    entry = _manifest_entry(release, canonical.get("question_id"))
                    client_outcome = canonical.get("outcome")
                    selection = data.get("selected")
                    if selection is None:
                        selection = (data.get("details") or {}).get("selection")
                    if entry is None:
                        raise EventContractError("questionId is not present in the published release")
                    try:
                        canonical["outcome"] = grade(entry, selection)
                    except GradingError as exc:
                        raise EventContractError(f"server grading failed: {exc}") from exc
                    data["clientOutcome"] = client_outcome
                    data["gradingSource"] = "server"
                    if client_outcome != canonical["outcome"]:
                        data["outcomeOverridden"] = True
            except EventContractError as exc:
                canonical["verified"] = False
                canonical["verification_error"] = str(exc)
        elif canonical["event_type"] == "lesson_complete" and has_curriculum_context:
            release_id = canonical.get("release_id")
            if release_id and release_id not in release_cache:
                release_cache[release_id] = await CurriculumRelease.find_one(
                    CurriculumRelease.release_id == release_id
                )
            release = release_cache.get(release_id or "")
            skill_ids = {
                item.get("skill_id")
                for item in (release.question_manifest if release else [])
            }
            if release is None:
                canonical["verified"] = False
                canonical["verification_error"] = "releaseId does not exist"
            elif canonical.get("curriculum_id") != release.curriculum_id:
                canonical["verified"] = False
                canonical["verification_error"] = "curriculumId does not match the published release"
            elif canonical.get("curriculum_revision") != release.revision:
                canonical["verified"] = False
                canonical["verification_error"] = "curriculumRevision does not match the published release"
            elif not canonical.get("assignment_id"):
                canonical["verified"] = False
                canonical["verification_error"] = "lesson completion requires assignmentId"
            elif canonical.get("curriculum_skill_id") not in skill_ids:
                canonical["verified"] = False
                canonical["verification_error"] = "lesson completion skill is not present in the release"
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
    await _verify_lesson_completions(student_id, docs, release_cache)
    unverified = sum(not doc.verified for doc in docs)
    if unverified:
        # A rejected event is kept but excluded from mastery, so a client sending malformed
        # events fails silently from the learner's side: they play, and nothing counts. The
        # reasons are the diagnostic — a sudden run of one reason means a client regression.
        reasons = sorted({doc.verification_error for doc in docs if not doc.verified and doc.verification_error})
        logger.warning(
            "events rejected student_id=%s rejected=%s of=%s reasons=%s",
            student_id, unverified, len(docs), reasons,
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
