"""Phase 2 student sessions and assignment-balanced course recommendations."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError

from ...core.deps import get_current_student, get_current_user
from ...core.logging import get_logger
from ...core.permissions import authorize_guardian_read
from ...core.runtime_settings import get_system_settings
from ...models.assignment import Assignment, ProgressionState
from ...models.academic import Subject
from ...models.content import CurriculumRelease
from ...models.event import LearningEvent
from ...models.mastery import MasteryState
from ...models.recommendation import RecommendationRun, StudentSession
from ...models.student import Student
from ...models.user import User
from ..content.placement import ordered_skills
from .path import build_path
from .recommendation import ENGINE_REVISION, recommend
from .rewards import available_xp, calculate_xp, reward_config, skill_metadata
from .skips import record_recommendation_skip
from .schemas import RecommendationSkipIn, SessionEndIn, SessionStartIn, SubjectSelectionIn

logger = get_logger("learning")


router = APIRouter(tags=["learning"])


def _assignment_release_bindings(assignments: list[Any]) -> list[str]:
    return [f"{row.id}:{row.release_id}" for row in assignments]


def _run_matches_assignments(run: RecommendationRun, assignments: list[Any]) -> bool:
    """A cached session plan is valid only for the exact releases learners use now."""
    return set(run.assignment_release_ids) == set(_assignment_release_bindings(assignments))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _thumbnail_url(presentation: dict[str, Any], release_id: str) -> str | None:
    """Authored URL, or an **API-relative** path to the release's own artwork.

    The path is deliberately relative to this API's root, not to the browser's origin: the
    routers carry no global `/api` mount, and the client knows where the API lives (its own
    origin behind a proxy, a different port in development). The frontend joins it with the
    configured API base — see `apiFileUrl` in `api/client.ts`.
    """
    if presentation.get("thumbnailUrl"):
        return presentation["thumbnailUrl"]
    asset_id = presentation.get("thumbnailAssetId")
    if not asset_id:
        return None
    return f"/learning/assets/{quote(release_id, safe='')}/{quote(asset_id, safe='')}"


SVG_NAMESPACE = "http://www.w3.org/2000/svg"


def _ensure_svg_namespace(markup: str) -> str:
    """Guarantee the SVG namespace on artwork served as its own document.

    Studio markup is authored as a JSX-style fragment, where `xmlns` is optional. Served to
    an `<img>` — how the student home shows a skill thumbnail — a document without it fails
    to parse and renders as a broken image. Releases are immutable, so artwork published
    before the studio started emitting `xmlns` can only be repaired here, at read time.
    """
    stripped = markup.lstrip()
    if stripped[:4].lower() != "<svg":
        return markup
    opening_end = stripped.find(">")
    if opening_end == -1:
        return markup
    if re.search(r"\bxmlns\s*=", stripped[:opening_end], re.IGNORECASE):
        return markup
    return f'<svg xmlns="{SVG_NAMESPACE}"{stripped[4:]}'


@router.get("/learning/assets/{release_id}/{asset_id}", response_class=Response)
async def get_published_svg_asset(release_id: str, asset_id: str):
    """Serve sanitized learner artwork from an immutable published release."""
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == release_id)
    if not release:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Published asset not found")
    entry = next(
        (row for row in release.asset_manifest if row.get("asset_id") == asset_id),
        None,
    )
    markup = (entry or {}).get("snapshot", {}).get("markup")
    if not isinstance(markup, str) or not markup.strip():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Published asset not found")
    return Response(
        content=_ensure_svg_namespace(markup),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


def _session_out(session: StudentSession) -> dict[str, Any]:
    return {
        "sessionId": session.session_id,
        "source": session.source,
        "startedAt": session.started_at,
        "endedAt": session.ended_at,
        "eventsCount": session.events_count,
    }


async def _open_session(student_id: str, source: str = "independent") -> StudentSession:
    session = await StudentSession.find_one(
        StudentSession.student_id == student_id,
        StudentSession.ended_at == None,
    )
    # Close abandoned sessions before opening a fresh one.
    if session and _utc(session.last_seen_at) < _now() - timedelta(hours=12):
        session.ended_at = session.last_seen_at
        await session.save()
        session = None
    if session:
        session.last_seen_at = _now()
        await session.save()
        return session
    session = StudentSession(session_id=uuid4().hex, student_id=student_id, source=source)
    await session.insert()
    return session


@router.post("/sessions/start")
async def start_session(body: SessionStartIn, student: Student = Depends(get_current_student)):
    return _session_out(await _open_session(str(student.id), body.source))


@router.post("/sessions/end")
async def end_session(body: SessionEndIn, student: Student = Depends(get_current_student)):
    session = await StudentSession.find_one(
        StudentSession.session_id == body.session_id,
        StudentSession.student_id == str(student.id),
    )
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if not session.ended_at:
        session.ended_at = _now()
        session.last_seen_at = session.ended_at
        await session.save()
    return _session_out(session)


async def _course_inputs(
    student_id: str,
    subject_id: str | None = None,
) -> tuple[list[dict[str, Any]], list[Assignment], dict[str, CurriculumRelease]]:
    query: dict[str, Any] = {"student_id": student_id, "status": "active"}
    if subject_id:
        query["subject_id"] = subject_id
    rows = await Assignment.find(query).sort("priority", "created_at").to_list()
    if not rows:
        return [], [], {}
    progressions = await ProgressionState.find(
        ProgressionState.student_id == student_id,
        {"assignment_id": {"$in": [str(row.id) for row in rows]}},
    ).to_list()
    progression_by_assignment = {row.assignment_id: row for row in progressions}
    releases: dict[str, CurriculumRelease] = {}
    inputs: list[dict[str, Any]] = []
    included_rows: list[Assignment] = []
    for assignment in rows:
        progression = progression_by_assignment.get(str(assignment.id))
        if assignment.placement_required and (
            not progression or progression.placement_status not in {"completed", "skipped"}
        ):
            continue
        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == assignment.release_id)
        if not release:
            continue
        releases[release.release_id] = release
        question_counts: dict[str, int] = {}
        for entry in release.question_manifest:
            skill_id = entry.get("skill_id")
            if skill_id:
                question_counts[skill_id] = question_counts.get(skill_id, 0) + 1
        inputs.append({
            "id": str(assignment.id),
            "release_id": assignment.release_id,
            "curriculum_id": assignment.curriculum_id,
            # The grade the adult anchored this assignment to. A release may span several
            # grades, so the path walk narrows an "all" scope down to this one.
            "grade_id": assignment.grade_id,
            "priority": assignment.priority,
            "scope": assignment.scope,
            "schedule": assignment.schedule,
            "tree": release.tree,
            "available_skill_ids": set(question_counts),
            "question_counts": question_counts,
        })
        included_rows.append(assignment)
    return inputs, included_rows, releases


async def _progression_inputs(student_id: str, assignment_ids: list[str]) -> list[dict[str, Any]]:
    if not assignment_ids:
        return []
    rows = await ProgressionState.find(
        ProgressionState.student_id == student_id,
        {"assignment_id": {"$in": assignment_ids}},
    ).to_list()
    return [row.model_dump(mode="python") for row in rows]


async def _mastery_inputs(student_id: str) -> list[dict[str, Any]]:
    rows = await MasteryState.find(MasteryState.student_id == student_id).to_list()
    return [row.model_dump(mode="python") for row in rows]


async def _recent_skips(student_id: str, cooldown_sessions: int, current_session_id: str) -> set[tuple[str, str]]:
    if cooldown_sessions <= 0:
        return set()
    rows = await RecommendationRun.find(
        RecommendationRun.student_id == student_id,
    ).sort("-created_at").limit(100).to_list()
    prior_session_ids: list[str] = []
    output: set[tuple[str, str]] = set()
    for row in rows:
        if row.session_id != current_session_id and row.session_id not in prior_session_ids:
            if len(prior_session_ids) >= cooldown_sessions:
                continue
            prior_session_ids.append(row.session_id)
        if row.session_id != current_session_id and row.session_id not in prior_session_ids:
            continue
        for decision in row.decisions:
            if decision.get("action") == "skipped":
                output.add((decision.get("assignment_id"), decision.get("skill_id")))
    return output


def _item_out(
    item: dict[str, Any],
    releases: dict[str, CurriculumRelease],
    status_value: str = "not_completed",
    system_rewards: dict[str, Any] | None = None,
) -> dict[str, Any]:
    release = releases[item["release_id"]]
    questions = []
    for entry in release.question_manifest:
        if entry.get("skill_id") != item["skill_id"]:
            continue
        playable = dict(entry.get("playable") or {})
        playable.setdefault("difficulty", entry.get("difficulty", "medium"))
        questions.append(playable)
    presentation = skill_metadata(release.tree, item["skill_id"])
    return {
        "assignmentId": item["assignment_id"],
        "releaseId": item["release_id"],
        "curriculumId": item["curriculum_id"],
        "curriculumRevision": release.revision,
        "skillId": item["skill_id"],
        "skillLabel": presentation["title"],
        "curriculumSkillLabel": item["skill_label"],
        "description": presentation["description"],
        "thumbnailUrl": _thumbnail_url(presentation, release.release_id),
        "accent": presentation["accent"],
        "estimatedMinutes": presentation.get("estimatedMinutes"),
        "xpAvailable": available_xp(release.tree, item["skill_id"], len(questions), system_rewards),
        "unitId": item.get("unit_id"),
        "subjectId": item.get("subject_id"),
        "kind": item["kind"],
        "reason": item["reason"],
        "optional": item["optional"],
        "status": status_value,
        "questions": questions,
    }


def _free_items(
    assignments: list[dict[str, Any]],
    releases: dict[str, CurriculumRelease],
    system_rewards: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for assignment in assignments:
        release = releases[assignment["release_id"]]
        units = {unit.get("id"): unit for unit in release.tree.get("units", [])}
        for skill in ordered_skills(release.tree, assignment.get("scope")):
            skill_id = skill.get("id")
            if skill_id not in assignment["available_skill_ids"]:
                continue
            unit = units.get(skill.get("unitId"), {})
            items.append(_item_out({
                "assignment_id": assignment["id"],
                "release_id": assignment["release_id"],
                "curriculum_id": assignment["curriculum_id"],
                "skill_id": skill_id,
                "skill_label": skill.get("label") or skill.get("name") or skill_id,
                "unit_id": skill.get("unitId"),
                "subject_id": unit.get("subjectId"),
                "kind": "free",
                "reason": "Choose any assigned skill",
                "optional": True,
            }, releases, system_rewards=system_rewards))
    return items


async def _session_completion(
    *,
    student_id: str,
    session_id: str,
    releases: dict[str, CurriculumRelease],
    system_rewards: dict[str, Any] | None = None,
    assignment_ids: set[str] | None = None,
) -> tuple[dict[tuple[str, str], str], list[dict[str, Any]], dict[str, Any]]:
    filters: list[Any] = [
        LearningEvent.student_id == student_id,
        LearningEvent.session_id == session_id,
        LearningEvent.verified == True,
        {"event_type": {"$in": ["attempt", "lesson_complete"]}},
    ]
    if assignment_ids:
        filters.append({"assignment_id": {"$in": list(assignment_ids)}})
    rows = await LearningEvent.find(*filters).sort("client_timestamp_ms").to_list()
    statuses: dict[tuple[str, str], str] = {}
    completed_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        if not row.assignment_id or not row.curriculum_skill_id:
            continue
        key = (row.assignment_id, row.curriculum_skill_id)
        if row.event_type == "attempt" and statuses.get(key) != "completed":
            statuses[key] = "in_progress"
            continue
        if row.event_type != "lesson_complete":
            continue
        statuses[key] = "completed"
        release = releases.get(row.release_id or "")
        skill = next(
            (
                entry for entry in (release.tree.get("skills", []) if release else [])
                if entry.get("id") == row.curriculum_skill_id
            ),
            {},
        )
        presentation = skill_metadata(release.tree if release else {}, row.curriculum_skill_id)
        completed_by_key[key] = {
            "assignmentId": row.assignment_id,
            "releaseId": row.release_id,
            "curriculumId": row.curriculum_id,
            "skillId": row.curriculum_skill_id,
            "skillLabel": presentation["title"],
            "curriculumSkillLabel": skill.get("label") or skill.get("name") or row.curriculum_skill_id,
            "thumbnailUrl": _thumbnail_url(presentation, release.release_id) if release else None,
            "status": "completed",
            "completedAt": row.occurred_at or row.received_at.isoformat(),
        }
    xp = calculate_xp(
        rows, {release_id: release.tree for release_id, release in releases.items()},
        system_rewards,
    )
    for item in completed_by_key.values():
        item["xpEarned"] = sum(
            row["totalXp"]
            for row in xp["breakdown"]
            if row["releaseId"] == item["releaseId"] and row["skillId"] == item["skillId"]
        )
    return statuses, list(completed_by_key.values()), xp


def _annotate_queue(
    items: list[dict[str, Any]],
    statuses: dict[tuple[str, str], str],
) -> list[dict[str, Any]]:
    for item in items:
        item["status"] = statuses.get(
            (item["assignmentId"], item["skillId"]),
            "not_completed",
        )
    return items


async def _quest_payload(
    *,
    student_id: str,
    session_id: str,
    label: str,
    current_items: list[dict[str, Any]],
    completed_items: list[dict[str, Any]],
    xp: dict[str, Any],
) -> dict[str, Any]:
    first = await RecommendationRun.find_one(
        RecommendationRun.student_id == student_id,
        RecommendationRun.session_id == session_id,
        RecommendationRun.sequence == 1,
    )
    planned = first.served_items if first else current_items
    planned_keys = {
        (item.get("assignment_id") or item.get("assignmentId"), item.get("skill_id") or item.get("skillId"))
        for item in planned
    }
    completed = sum(
        (item["assignmentId"], item["skillId"]) in planned_keys
        for item in completed_items
    )
    return {
        "label": label,
        "target": len(planned_keys),
        "completed": completed,
        "xpEarned": xp["totalXp"],
    }


async def _build_today(
    *,
    student_id: str,
    session: StudentSession,
    mode: Literal["scheduled", "free"],
    persist: bool,
    subject_id: str | None = None,
) -> dict[str, Any]:
    assignment_inputs, assignments, releases = await _course_inputs(student_id, subject_id)
    if not assignment_inputs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No placement-ready assignment is available")
    # Loaded once here and threaded down: what playing is worth is an admin setting, so every
    # figure on this payload — available XP, earned XP, the quest — has to resolve against the
    # same document, not just the ones whose curriculum happened to author its own.
    settings_doc = await get_system_settings()
    system_rewards = dict((settings_doc.scoring or {}).get("rewards") or {})
    statuses, completed_items, xp = await _session_completion(
        student_id=student_id,
        session_id=session.session_id,
        releases=releases,
        system_rewards=system_rewards,
        assignment_ids={str(item.id) for item in assignments},
    )
    primary_release = releases[assignments[0].release_id]
    authored_rewards = reward_config(primary_release.tree, system_rewards)
    if mode == "free":
        return {
            "mode": "free",
            "subjectId": assignments[0].subject_id,
            "sessionId": session.session_id,
            "recommendationRunId": None,
            "queue": _annotate_queue(_free_items(assignment_inputs, releases, system_rewards), statuses),
            "completedItems": completed_items,
            "completedCount": len(completed_items),
            "quest": {
                "label": authored_rewards["quest"]["label"],
                "target": 0,
                "completed": 0,
                "xpEarned": xp["totalXp"],
            },
        }

    if persist:
        latest = await RecommendationRun.find_one(
            RecommendationRun.student_id == student_id,
            RecommendationRun.session_id == session.session_id,
            RecommendationRun.subject_id == assignments[0].subject_id,
            RecommendationRun.invalidated_at == None,
        )
        if latest and not _run_matches_assignments(latest, assignments):
            # Publishing can move an active assignment while the learner still has an open
            # session. Retiring its cached plan lets this request rebuild against the new
            # release instead of serving stale artwork/content or mismatched release ids.
            latest.invalidated_at = datetime.now(timezone.utc)
            await latest.save()
            latest = None
        if latest:
            quest = await _quest_payload(
                student_id=student_id,
                session_id=session.session_id,
                label=authored_rewards["quest"]["label"],
                current_items=latest.served_items,
                completed_items=completed_items,
                xp=xp,
            )
            return {
                "mode": "scheduled",
                "subjectId": assignments[0].subject_id,
                "sessionId": session.session_id,
                "recommendationRunId": latest.run_id,
                "queue": _annotate_queue(
                    [_item_out(item, releases, system_rewards=system_rewards) for item in latest.served_items],
                    statuses,
                ),
                "completedItems": completed_items,
                "completedCount": len(completed_items),
                "quest": quest,
            }

    config = dict((settings_doc.scoring or {}).get("recommendation") or {})
    config["skills_per_session"] = authored_rewards["quest"]["activitiesPerSession"]
    highest_priority = assignments[0]
    schedule = highest_priority.schedule or {}
    if schedule.get("skills_per_session") is not None:
        config["skills_per_session"] = schedule["skills_per_session"]
    assignment_ids = [str(row.id) for row in assignments]
    result = recommend(
        assignments=assignment_inputs,
        mastery_states=await _mastery_inputs(student_id),
        progressions=await _progression_inputs(student_id, assignment_ids),
        skipped_keys=await _recent_skips(
            student_id,
            int(config.get("skip_cooldown_sessions", 1)),
            session.session_id,
        ),
        config=config,
        completed_keys={
            key for key, value in statuses.items()
            if value == "completed"
        },
    )
    if not result["served_items"]:
        # An empty queue is the learner's whole session: they open the app and there is
        # nothing to do. It is never a normal state — it means every skill is filtered out by
        # eligibility, cooldown or completion, and no adult would otherwise find out.
        logger.warning(
            "recommendation starved student_id=%s assignments=%s candidates=%s",
            student_id, len(assignment_inputs), len(result["candidates"]),
        )

    run = None
    if persist:
        # Math and Science may load almost together while the learner changes tabs. The
        # sequence index is shared by the session, so allocate defensively if another
        # request claims the same next number between our read and insert.
        for attempt in range(4):
            last = await RecommendationRun.find(
                RecommendationRun.student_id == student_id,
                RecommendationRun.session_id == session.session_id,
            ).sort("-sequence").first_or_none()
            run = RecommendationRun(
                run_id=uuid4().hex,
                student_id=student_id,
                session_id=session.session_id,
                subject_id=assignments[0].subject_id,
                sequence=(last.sequence + 1) if last else 1,
                assignment_release_ids=_assignment_release_bindings(assignments),
                scoring_revision=settings_doc.scoring_revision,
                engine_revision=result["engine_revision"],
                candidates=result["candidates"],
                served_items=result["served_items"],
            )
            try:
                await run.insert()
                break
            except DuplicateKeyError:
                if attempt == 3:
                    raise
    quest = await _quest_payload(
        student_id=student_id,
        session_id=session.session_id,
        label=authored_rewards["quest"]["label"],
        current_items=result["served_items"],
        completed_items=completed_items,
        xp=xp,
    )
    return {
        "mode": "scheduled",
        "subjectId": assignments[0].subject_id,
        "sessionId": session.session_id,
        "recommendationRunId": run.run_id if run else None,
        "engineRevision": ENGINE_REVISION,
        "queue": _annotate_queue(
            [_item_out(item, releases, system_rewards=system_rewards) for item in result["served_items"]],
            statuses,
        ),
        "completedItems": completed_items,
        "completedCount": len(completed_items),
        "quest": quest,
    }


@router.get("/learning/today")
async def learning_today(
    mode: Literal["scheduled", "free"] = "scheduled",
    subject_id: str | None = None,
    student: Student = Depends(get_current_student),
):
    student_id = str(student.id)
    session = await _open_session(student_id)
    return await _build_today(
        student_id=student_id,
        session=session,
        mode=mode,
        persist=True,
        subject_id=subject_id,
    )


@router.get("/learning/subjects")
async def learning_subjects(student: Student = Depends(get_current_student)):
    assignments = await Assignment.find(
        Assignment.student_id == str(student.id),
        Assignment.status == "active",
    ).sort("priority", "created_at").to_list()
    catalog = {
        item.key: item
        for item in await Subject.find({"key": {"$in": [row.subject_id for row in assignments if row.subject_id]}}).to_list()
    }
    progression_rows = await ProgressionState.find(
        ProgressionState.student_id == str(student.id),
        {"assignment_id": {"$in": [str(row.id) for row in assignments]}},
    ).to_list()
    progression = {row.assignment_id: row for row in progression_rows}
    subjects = []
    for assignment in assignments:
        if not assignment.subject_id:
            continue
        item = catalog.get(assignment.subject_id)
        state = progression.get(str(assignment.id))
        ready = not assignment.placement_required or bool(
            state and state.placement_status in {"completed", "skipped"}
        )
        subjects.append({
            "id": assignment.subject_id,
            "name": item.name if item else assignment.subject_id,
            "icon": item.icon if item else "",
            "color": item.color if item else "#7252D8",
            "assignmentId": str(assignment.id),
            "ready": ready,
            "primary": assignment.subject_id == student.primary_subject,
        })
    subjects.sort(key=lambda item: (not item["primary"], item["name"].lower()))
    current = next((
        item["id"] for item in subjects
        if item["id"] == student.preferred_subject and item["ready"]
    ), None)
    current = current or next((item["id"] for item in subjects if item["primary"] and item["ready"]), None)
    current = current or next((item["id"] for item in subjects if item["ready"]), None)
    return {"currentSubjectId": current, "subjects": subjects}


@router.put("/learning/subjects/current")
async def select_learning_subject(
    body: SubjectSelectionIn,
    student: Student = Depends(get_current_student),
):
    assignment = await Assignment.find_one(
        Assignment.student_id == str(student.id),
        Assignment.subject_id == body.subject_id,
        Assignment.status == "active",
    )
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This subject is not assigned to the learner")
    if assignment.placement_required:
        progression = await ProgressionState.find_one(
            ProgressionState.student_id == str(student.id),
            ProgressionState.assignment_id == str(assignment.id),
        )
        if not progression or progression.placement_status not in {"completed", "skipped"}:
            raise HTTPException(status.HTTP_409_CONFLICT, "Finish this subject’s placement check first")
    student.preferred_subject = body.subject_id
    await student.save()
    return {"currentSubjectId": body.subject_id}


@router.get("/learning/path")
async def learning_path(
    subject_id: str | None = None,
    student: Student = Depends(get_current_student),
):
    """The whole assigned road, A→Z, with every skill's state.

    Complements `/learning/today`: that returns a short prioritised session plan, this returns
    the curriculum walk the plan sits inside — so a learner sees where they are, and which
    skills are done, in progress, overdue, unlocked, or still waiting on an earlier one.
    """
    student_id = str(student.id)
    assignment_inputs, assignments, _releases = await _course_inputs(student_id, subject_id)
    if not assignment_inputs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No placement-ready assignment is available")
    mastery = await _mastery_inputs(student_id)
    progressions = await _progression_inputs(student_id, [str(row.id) for row in assignments])
    by_assignment = {row.get("assignment_id"): row for row in progressions}
    return {
        "paths": [
            build_path(
                assignment=assignment,
                mastery_states=mastery,
                progression=by_assignment.get(assignment["id"]),
            )
            for assignment in assignment_inputs
        ],
    }


@router.post("/learning/recommendations/{run_id}/skip")
async def skip_recommendation(
    run_id: str,
    body: RecommendationSkipIn,
    student: Student = Depends(get_current_student),
):
    return await record_recommendation_skip(
        student_id=str(student.id),
        run_id=run_id,
        skill_id=body.skill_id,
        assignment_id=body.assignment_id,
    )


@router.get("/students/{student_id}/recommendations/preview")
async def recommendation_preview(student_id: str, user: User = Depends(get_current_user)):
    await authorize_guardian_read(student_id, user)
    session = StudentSession(session_id="preview", student_id=student_id, source="preview")
    return await _build_today(student_id=student_id, session=session, mode="scheduled", persist=False)
