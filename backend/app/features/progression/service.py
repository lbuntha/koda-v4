"""Live mastery projection services used by event ingest and progress APIs.

The append-only ``learning_events`` collection remains the source of truth.
These helpers serialize each student/skill recompute, replay the complete
verified event slice through the authoritative scoring engine, and upsert the
cached ``mastery_states`` row idempotently.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Iterable

from ...core.runtime_settings import get_system_settings
from ...models.assignment import Assignment
from ...models.content import CurriculumRelease
from ...models.event import LearningEvent
from ...models.mastery import MasteryState, ProjectionJob
from ..content.placement import ordered_skills
from ..learning.rewards import achievement_profile
from .projection import build_mastery_states
from .scoring import ENGINE_REVISION, MASTERY_ORDER


_locks: dict[tuple[str, str | None, str], asyncio.Lock] = {}
_locks_guard = asyncio.Lock()

RANK_BOUNDARIES = [
    ("master", "Grand Master", 1.0),
    ("gold", "Gold Explorer", 0.66),
    ("silver", "Silver Explorer", 0.34),
    ("bronze", "Bronze Explorer", 0.0001),
    ("rookie", "Rookie", 0.0),
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _level_index(level: str) -> int:
    try:
        return MASTERY_ORDER.index(level)
    except ValueError:
        return 0


def _higher_level(a: str, b: str) -> str:
    return a if _level_index(a) >= _level_index(b) else b


async def _lock_for(key: tuple[str, str | None, str]) -> asyncio.Lock:
    async with _locks_guard:
        return _locks.setdefault(key, asyncio.Lock())


def _next_review(value: int | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc)


async def _upsert_state(state: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Upsert one computed state and return promotion metadata."""
    key = (state["student_id"], state["curriculum_id"], state["skill_id"])
    lock = await _lock_for(key)
    async with lock:
        existing = await MasteryState.find_one(
            MasteryState.student_id == state["student_id"],
            MasteryState.curriculum_id == state["curriculum_id"],
            MasteryState.skill_id == state["skill_id"],
        )
        previous_level = existing.level if existing else "not_started"
        highest = _higher_level(
            existing.highest_earned_level if existing else "not_started",
            state["level"],
        )
        promoted = _level_index(state["level"]) > _level_index(previous_level)
        payload = {key: value for key, value in state.items() if key != "next_review_at_ms"}
        payload.update({
            "highest_earned_level": highest,
            "next_review_at": _next_review(state["next_review_at_ms"]),
            "promoted_at": now if promoted else (existing.promoted_at if existing else None),
            "updated_at": now,
        })
        if existing:
            for field, value in payload.items():
                setattr(existing, field, value)
            await existing.save()
            row = existing
        else:
            row = MasteryState(**payload)
            await row.insert()
        return {
            "skillId": row.skill_id,
            "curriculumId": row.curriculum_id,
            "previousLevel": previous_level,
            "level": row.level,
            "promoted": promoted,
        }


async def recompute_mastery_keys(
    student_id: str,
    keys: Iterable[tuple[str | None, str]],
) -> list[dict[str, Any]]:
    """Recompute explicit ``(curriculum_id, skill_id)`` keys from all events."""
    unique_keys = sorted(set(keys), key=lambda item: ((item[0] or ""), item[1]))
    if not unique_keys:
        return []
    settings = await get_system_settings()
    now = _now()
    now_ms = round(now.timestamp() * 1000)
    updates: list[dict[str, Any]] = []
    for curriculum_id, skill_id in unique_keys:
        events = await LearningEvent.find(
            LearningEvent.student_id == student_id,
            LearningEvent.curriculum_id == curriculum_id,
            LearningEvent.curriculum_skill_id == skill_id,
            LearningEvent.verified == True,
        ).sort("client_timestamp_ms").to_list()
        states = build_mastery_states(
            student_id,
            [event.model_dump() for event in events],
            config=settings.scoring,
            now_ms=now_ms,
            scoring_revision=settings.scoring_revision,
        )
        if states:
            updates.append(await _upsert_state(states[0], now))
    return updates


async def recompute_touched_mastery(
    student_id: str,
    events: Iterable[LearningEvent],
) -> list[dict[str, Any]]:
    keys = {
        (event.curriculum_id, event.curriculum_skill_id)
        for event in events
        if event.verified and event.curriculum_skill_id
    }
    return await recompute_mastery_keys(
        student_id,
        {(curriculum_id, skill_id) for curriculum_id, skill_id in keys if skill_id},
    )


async def recompute_student_mastery(student_id: str) -> int:
    keys = await LearningEvent.get_motor_collection().distinct(
        "curriculum_skill_id",
        {"student_id": student_id, "verified": True, "curriculum_skill_id": {"$type": "string"}},
    )
    # A skill id may exist in more than one curriculum; resolve the real pairs.
    pairs = await LearningEvent.get_motor_collection().aggregate([
        {
            "$match": {
                "student_id": student_id,
                "verified": True,
                "curriculum_skill_id": {"$type": "string"},
            }
        },
        {"$group": {"_id": {"curriculum": "$curriculum_id", "skill": "$curriculum_skill_id"}}},
    ]).to_list(length=None)
    if not pairs and keys:
        pairs = [{"_id": {"curriculum": None, "skill": skill_id}} for skill_id in keys]
    return len(await recompute_mastery_keys(
        student_id,
        {(row["_id"].get("curriculum"), row["_id"]["skill"]) for row in pairs},
    ))


async def run_rescore_job(job_id: str) -> None:
    job = await ProjectionJob.find_one(ProjectionJob.job_id == job_id)
    if not job:
        return
    job.status = "running"
    job.started_at = _now()
    await job.save()
    try:
        student_ids = await LearningEvent.get_motor_collection().distinct(
            "student_id",
            {"verified": True, "curriculum_skill_id": {"$type": "string"}},
        )
        job.students_total = len(student_ids)
        await job.save()
        states_written = 0
        for student_id in student_ids:
            states_written += await recompute_student_mastery(student_id)
            job.students_processed += 1
            job.states_written = states_written
            await job.save()
        job.status = "completed"
        job.completed_at = _now()
        await job.save()
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)[:1000]
        job.completed_at = _now()
        await job.save()


async def create_rescore_job(scoring_revision: int) -> ProjectionJob:
    from uuid import uuid4

    job = ProjectionJob(
        job_id=uuid4().hex,
        kind="rescore",
        target_scoring_revision=scoring_revision,
    )
    await job.insert()
    return job


def state_out(
    state: MasteryState | None,
    *,
    curriculum_id: str,
    skill_id: str,
    label: str,
    unit_id: str | None,
    subject_id: str | None,
    current_revision: int,
    unit_label: str | None = None,
    config: dict[str, Any],
    grade_id: str | None = None,
    assignment_id: str | None = None,
) -> dict[str, Any]:
    level = state.level if state else "not_started"
    plays = state.plays if state else 0
    sessions = state.sessions if state else 0
    days = state.distinct_days if state else 0
    hard = state.hard_plays if state else 0
    score = state.score if state else 0.0
    next_level = None
    next_steps: list[str] = []
    index = _level_index(level)
    if index < len(MASTERY_ORDER) - 1:
        next_level = MASTERY_ORDER[index + 1]
        gate = (config.get("gates") or {}).get(next_level) or {}
        requirements = (
            ("strong tries", plays, int(gate.get("minPlays", 1))),
            ("practice sessions", sessions, int(gate.get("minSessions", 0))),
            ("practice days", days, int(gate.get("minDistinctDays", 0))),
            ("hard questions", hard, int(gate.get("minHardPlays", 0))),
        )
        for label_text, actual, required in requirements:
            if required > actual:
                next_steps.append(f"{required - actual} more {label_text}")
        threshold = float(config.get(f"{next_level}Score", 0))
        if score < threshold:
            next_steps.append(f"reach {round(threshold * 100)}% skill score")

    next_review = state.next_review_at if state else None
    if next_review and next_review.tzinfo is None:
        next_review = next_review.replace(tzinfo=timezone.utc)
    now = _now()
    is_due = bool(next_review and next_review <= now)
    return {
        "curriculumId": curriculum_id,
        "skillId": skill_id,
        "skillLabel": label,
        "unitId": unit_id,
        "unitLabel": unit_label,
        "subjectId": subject_id,
        "gradeId": grade_id,
        "assignmentId": assignment_id,
        "level": level,
        "highestEarnedLevel": state.highest_earned_level if state else "not_started",
        "score": score,
        "components": state.components if state else {},
        "plays": plays,
        "sessions": sessions,
        "distinctDays": days,
        "hardPlays": hard,
        "recentScore": state.recent_score if state else 0.0,
        "lastPracticedAt": state.last_practiced_at if state else None,
        "nextReviewAt": next_review,
        "isDue": is_due,
        "nextLevel": next_level,
        "toNextLevel": next_steps,
        "promotedAt": state.promoted_at if state else None,
        "projectionStatus": (
            "current"
            if state and state.scoring_revision == current_revision and state.engine_revision == ENGINE_REVISION
            else "stale" if state else "not_started"
        ),
    }


def rank_out(skills: list[dict[str, Any]]) -> dict[str, Any]:
    active = [skill for skill in skills if skill["level"] != "not_started"]
    proficient = sum(skill["level"] in {"proficient", "master"} for skill in active)
    mastered = sum(skill["level"] == "master" for skill in active)
    ratio = proficient / len(active) if active else 0.0
    tier, tier_label, current_min = next(
        (tier, label, boundary)
        for tier, label, boundary in RANK_BOUNDARIES
        if ratio >= boundary
    )
    ascending = sorted(RANK_BOUNDARIES, key=lambda item: item[2])
    current_index = next(index for index, item in enumerate(ascending) if item[0] == tier)
    next_boundary = ascending[current_index + 1][2] if current_index + 1 < len(ascending) else None
    progress = 1.0 if next_boundary is None else max(
        0.0,
        min(1.0, (ratio - current_min) / (next_boundary - current_min or 1)),
    )
    return {
        "tier": tier,
        "tierLabel": tier_label,
        "mastered": mastered,
        "proficientPlus": proficient,
        "totalSkills": len(active),
        "assignedSkills": len(skills),
        "progressToNext": progress,
    }


async def build_progress(student_id: str) -> dict[str, Any]:
    settings = await get_system_settings()
    assignments = await Assignment.find(
        Assignment.student_id == student_id,
        Assignment.status == "active",
    ).sort("priority", "created_at").to_list()
    mastery_rows = await MasteryState.find(MasteryState.student_id == student_id).to_list()
    mastery = {
        (row.curriculum_id, row.skill_id): row
        for row in mastery_rows
    }
    skills: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    active_curricula: list[tuple[str, dict[str, Any]]] = []
    release_trees: dict[str, dict[str, Any]] = {}
    for assignment in assignments:
        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == assignment.release_id)
        if not release:
            continue
        release_trees[release.release_id] = release.tree
        if not any(curriculum_id == assignment.curriculum_id for curriculum_id, _ in active_curricula):
            active_curricula.append((assignment.curriculum_id, release.tree))
        units = {unit.get("id"): unit for unit in release.tree.get("units", [])}
        for skill in ordered_skills(release.tree, assignment.scope):
            skill_id = skill.get("id")
            if not skill_id:
                continue
            key = (assignment.curriculum_id, skill_id)
            if key in seen:
                continue
            seen.add(key)
            unit = units.get(skill.get("unitId"), {})
            skills.append(state_out(
                mastery.get(key),
                curriculum_id=assignment.curriculum_id,
                skill_id=skill_id,
                label=skill.get("label") or skill.get("name") or skill_id,
                unit_id=skill.get("unitId"),
                unit_label=unit.get("label"),
                subject_id=unit.get("subjectId"),
                grade_id=assignment.grade_id,
                assignment_id=str(assignment.id),
                current_revision=settings.scoring_revision,
                config=settings.scoring,
            ))
    # Preserve scored historical skills even if an assignment was later paused.
    for key, row in mastery.items():
        if key in seen or not row.curriculum_id:
            continue
        skills.append(state_out(
            row,
            curriculum_id=row.curriculum_id,
            skill_id=row.skill_id,
            label=row.skill_id,
            unit_id=None,
            subject_id=None,
            current_revision=settings.scoring_revision,
            config=settings.scoring,
        ))
    events = await LearningEvent.find(
        LearningEvent.student_id == student_id,
        LearningEvent.verified == True,
    ).sort("client_timestamp_ms").to_list()
    event_release_ids = {
        event.release_id for event in events
        if event.release_id and event.release_id not in release_trees
    }
    if event_release_ids:
        historical_releases = await CurriculumRelease.find(
            {"release_id": {"$in": list(event_release_ids)}}
        ).to_list()
        release_trees.update({
            release.release_id: release.tree
            for release in historical_releases
        })
    return {
        "studentId": student_id,
        "scoringRevision": settings.scoring_revision,
        "engineRevision": ENGINE_REVISION,
        "rank": rank_out(skills),
        "rewardProfile": achievement_profile(
            events,
            release_trees,
            active_curricula,
            mastery_rows,
        ),
        "skills": skills,
    }
