"""Phase 4 analytics aggregation and child-data lifecycle helpers."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from ...core.logging import get_logger
from ...core.runtime_settings import get_system_settings
from ...models.assignment import Assignment, Placement, ProgressionState
from ...models.classroom import ClassEnrollment, Classroom
from ...models.event import LearningEvent
from ...models.content import CurriculumRelease
from ...models.mastery import MasteryState
from ...models.recommendation import RecommendationRun, StudentSession
from ...models.student import Student
from ...models.user import Role, User
from ..learning.rewards import calculate_xp, skill_metadata
from ..learning.streak import DEFAULT_STREAK, current_run, longest_run, reference_today, streak_days

logger = get_logger("analytics")

#: Ceiling on events loaded for one activity snapshot. Chosen to be unreachable in normal use
#: while still bounding the worst case; crossing it is logged rather than silently truncating.
MAX_SNAPSHOT_EVENTS = 25_000


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


async def authorized_students(user: User) -> list[Student]:
    role = _role(user)
    if role == Role.admin.value:
        return await Student.find_all().sort("name").to_list()
    if role == Role.parent.value:
        return await Student.find(Student.guardian_parent_ids == str(user.id)).sort("name").to_list()
    if role == Role.teacher.value:
        classrooms = await Classroom.find(
            Classroom.owner_teacher_id == str(user.id),
            Classroom.archived_at == None,
        ).to_list()
        if not classrooms:
            return []
        enrollments = await ClassEnrollment.find(
            {"classroom_id": {"$in": [str(row.id) for row in classrooms]}},
            ClassEnrollment.status == "active",
        ).to_list()
        student_ids = list({row.student_id for row in enrollments})
        if not student_ids:
            return []
        from beanie import PydanticObjectId

        object_ids = []
        for student_id in student_ids:
            try:
                object_ids.append(PydanticObjectId(student_id))
            except Exception:
                continue
        return await Student.find({"_id": {"$in": object_ids}}).sort("name").to_list()
    return []


def _event_out(event: LearningEvent) -> dict[str, Any]:
    return {
        "id": event.client_id or str(event.id),
        "occurredAt": event.occurred_at or event.received_at.isoformat(),
        "eventType": event.event_type,
        "outcome": event.outcome,
        "questionId": event.question_id,
        "skillId": event.curriculum_skill_id,
        "curriculumId": event.curriculum_id,
        "assignmentId": event.assignment_id,
        "technique": event.technique,
        "attemptNumber": event.attempt_number,
        "hintUsed": event.hint_used_before_attempt,
        "timeOnTaskMs": event.time_on_task_ms,
        "verified": event.verified,
        "summary": getattr(event, "actionSummary", None),
    }


def _weekly_activity(events: list[Any], today: date | None = None) -> list[dict[str, Any]]:
    """Return a compact seven-day activity series without exposing event detail."""
    end = today or datetime.now(timezone.utc).date()
    start = end - timedelta(days=6)
    counts = {start + timedelta(days=offset): 0 for offset in range(7)}
    for event in events:
        raw = getattr(event, "occurred_at", None)
        if not raw:
            continue
        try:
            event_day = datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            continue
        if event_day in counts:
            counts[event_day] += 1
    return [
        {
            "date": day.isoformat(),
            "day": day.strftime("%a")[0],
            "count": counts[day],
        }
        for day in counts
    ]


async def activity_snapshot(
    student_id: str,
    *,
    limit: int = 100,
    assignment_id: str | None = None,
) -> dict[str, Any]:
    query: dict[str, Any] = {"student_id": student_id}
    if assignment_id:
        query["assignment_id"] = assignment_id
    # Every figure below — XP, lifetime totals, longest streak — is defined over the learner's
    # whole history, so this cannot be narrowed to a recent window without changing what those
    # numbers mean. What it can have is a ceiling, so one learner's history can never load the
    # whole collection into memory on a page view. The cap is far above a real learner (a busy
    # one produces a few thousand events a year) and is served by the
    # (student_id, client_timestamp_ms) index, so the newest events are the ones kept.
    events = await (
        LearningEvent.find(query).sort("-client_timestamp_ms").limit(MAX_SNAPSHOT_EVENTS).to_list()
    )
    if len(events) == MAX_SNAPSHOT_EVENTS:
        # Reaching this means totals are now understated. Better a log line than silence.
        logger.warning(
            "activity snapshot truncated at cap student_id=%s cap=%s",
            student_id, MAX_SNAPSHOT_EVENTS,
        )
    attempts = [event for event in events if event.event_type == "attempt" and event.verified]
    correct = sum(event.outcome == "correct" for event in attempts)
    first_attempts = [event for event in attempts if event.attempt_number == 1]
    settings_doc = await get_system_settings()
    streak_config = {**DEFAULT_STREAK, **dict((settings_doc.scoring or {}).get("streak") or {})}
    days = streak_days(events, streak_config)
    current_streak = current_run(
        days, reference_today(events), int(streak_config["grace_days"]),
    )
    longest_streak = longest_run(days)
    sessions = await StudentSession.find(
        StudentSession.student_id == student_id,
    ).sort("-started_at").limit(50).to_list()
    release_ids = list({event.release_id for event in events if event.release_id})
    release_rows = await CurriculumRelease.find(
        {"release_id": {"$in": release_ids}}
    ).to_list() if release_ids else []
    release_trees = {row.release_id: row.tree for row in release_rows}
    xp = calculate_xp(events, release_trees)
    xp_breakdown = []
    for row in xp["breakdown"]:
        presentation = skill_metadata(
            release_trees.get(row["releaseId"], {}),
            row["skillId"],
        )
        xp_breakdown.append({
            **row,
            "skillLabel": presentation["title"],
        })
    return {
        "studentId": student_id,
        "summary": {
            "totalEvents": len(events),
            "totalAttempts": len(attempts),
            "correct": correct,
            "incorrect": sum(event.outcome == "incorrect" for event in attempts),
            "accuracy": round(correct / len(attempts), 3) if attempts else None,
            "firstTryAccuracy": (
                round(sum(event.outcome == "correct" for event in first_attempts) / len(first_attempts), 3)
                if first_attempts else None
            ),
            "independenceRate": (
                round(sum(not event.hint_used_before_attempt for event in attempts) / len(attempts), 3)
                if attempts else None
            ),
            "hints": sum(event.event_type == "hint_requested" for event in events),
            "lessonsCompleted": sum(
                event.event_type == "lesson_complete" and event.verified
                for event in events
            ),
            "xpEarned": xp["totalXp"],
            "timeOnTaskMs": sum(event.time_on_task_ms or 0 for event in attempts),
            "currentStreakDays": current_streak,
            "longestStreakDays": longest_streak,
            "activeDays": len(days),
            "weeklyActivity": _weekly_activity(events),
        },
        "xpBreakdown": xp_breakdown,
        "sessions": [
            {
                "sessionId": row.session_id,
                "source": row.source,
                "startedAt": row.started_at,
                "endedAt": row.ended_at,
                "eventsCount": row.events_count,
            }
            for row in sessions
        ],
        "events": [_event_out(event) for event in events[:min(max(limit, 1), 500)]],
    }


async def recommendation_snapshot(student_id: str, limit: int = 20) -> dict[str, Any]:
    rows = await RecommendationRun.find(
        RecommendationRun.student_id == student_id,
    ).sort("-created_at").limit(min(max(limit, 1), 100)).to_list()
    return {
        "studentId": student_id,
        "runs": [
            {
                "runId": row.run_id,
                "sessionId": row.session_id,
                "sequence": row.sequence,
                "createdAt": row.created_at,
                "invalidatedAt": row.invalidated_at,
                "scoringRevision": row.scoring_revision,
                "engineRevision": row.engine_revision,
                "served": [
                    {
                        "assignmentId": item.get("assignment_id"),
                        "curriculumId": item.get("curriculum_id"),
                        "skillId": item.get("skill_id"),
                        "skillLabel": item.get("skill_label"),
                        "kind": item.get("kind"),
                        "reason": item.get("reason"),
                    }
                    for item in row.served_items
                ],
                "decisions": row.decisions,
                "excluded": [
                    {
                        "skillId": item.get("skill_id"),
                        "skillLabel": item.get("skill_label"),
                        "reason": item.get("excluded"),
                    }
                    for item in row.candidates
                    if item.get("excluded")
                ],
            }
            for row in rows
        ],
    }


async def export_student_data(student: Student) -> dict[str, Any]:
    student_id = str(student.id)
    events = await LearningEvent.find(LearningEvent.student_id == student_id).sort("client_timestamp_ms").to_list()
    mastery = await MasteryState.find(MasteryState.student_id == student_id).to_list()
    sessions = await StudentSession.find(StudentSession.student_id == student_id).sort("started_at").to_list()
    recommendations = await RecommendationRun.find(RecommendationRun.student_id == student_id).sort("created_at").to_list()
    assignments = await Assignment.find(Assignment.student_id == student_id).to_list()
    placements = await Placement.find(Placement.student_id == student_id).to_list()
    progressions = await ProgressionState.find(ProgressionState.student_id == student_id).to_list()
    return {
        "schemaVersion": 1,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "student": {"id": student_id, "name": student.name, "avatar": student.avatar},
        "learningEvents": [event.model_dump(mode="json") for event in events],
        "masteryStates": [row.model_dump(mode="json") for row in mastery],
        "sessions": [row.model_dump(mode="json") for row in sessions],
        "recommendations": [row.model_dump(mode="json") for row in recommendations],
        "assignments": [row.model_dump(mode="json") for row in assignments],
        "placements": [row.model_dump(mode="json") for row in placements],
        "progressions": [row.model_dump(mode="json") for row in progressions],
    }


async def purge_learning_data(student_id: str, *, include_student: bool = False) -> dict[str, int]:
    models = [
        ("learningEvents", LearningEvent),
        ("masteryStates", MasteryState),
        ("sessions", StudentSession),
        ("recommendations", RecommendationRun),
        ("assignments", Assignment),
        ("placements", Placement),
        ("progressions", ProgressionState),
    ]
    counts: dict[str, int] = {}
    for label, model in models:
        count = await model.find(model.student_id == student_id).count()
        if count:
            await model.find(model.student_id == student_id).delete()
        counts[label] = count
    if include_student:
        enrollment_count = await ClassEnrollment.find(ClassEnrollment.student_id == student_id).count()
        if enrollment_count:
            await ClassEnrollment.find(ClassEnrollment.student_id == student_id).delete()
        counts["enrollments"] = enrollment_count
        try:
            from beanie import PydanticObjectId

            student = await Student.get(PydanticObjectId(student_id))
        except Exception:
            student = None
        if student:
            await student.delete()
            counts["students"] = 1
        else:
            counts["students"] = 0
    return counts
