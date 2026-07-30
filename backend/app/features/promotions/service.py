"""Completion detection and safe assignment transitions for curriculum promotion."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo.errors import DuplicateKeyError

from ...models.academic import Grade, Subject
from ...models.assignment import Assignment, CurriculumOffering, CurriculumPromotion
from ...models.content import CurriculumRelease
from ...models.event import LearningEvent
from ...models.mastery import MasteryState
from ...models.student import Student
from ..content.placement import ordered_skills
from ..learning.path import grade_scope
from ..notifications.service import create_and_send


def completion_snapshot(
    *,
    tree: dict[str, Any],
    scope: dict[str, Any] | None,
    grade_id: str,
    available_skill_ids: set[str],
    mastery_levels: dict[str, str],
    completed_skill_ids: set[str] | None = None,
    completion_rule: str = "activities_completed",
) -> dict[str, Any]:
    """Return a stable completion decision for one immutable assignment release.

    Missing playable content blocks promotion instead of silently graduating a learner
    around an authoring problem. Curriculum Health is the repair surface for those ids.
    """
    skills = ordered_skills(tree, grade_scope(tree, scope, grade_id))
    required_ids = [str(item.get("id")) for item in skills if item.get("id")]
    unavailable = [skill_id for skill_id in required_ids if skill_id not in available_skill_ids]
    completed_skill_ids = completed_skill_ids or set()
    completed = [skill_id for skill_id in required_ids if skill_id in completed_skill_ids]
    level_rank = {"not_started": 0, "beginner": 1, "developing": 2, "proficient": 3, "master": 4}
    proficient = [
        skill_id for skill_id in required_ids
        if level_rank.get(mastery_levels.get(skill_id, "not_started"), 0) >= level_rank["proficient"]
    ]
    mastered = [skill_id for skill_id in required_ids if mastery_levels.get(skill_id) == "master"]
    qualified = {
        "activities_completed": completed,
        "proficient": proficient,
        "master": mastered,
    }.get(completion_rule, completed)
    return {
        "complete": bool(required_ids) and not unavailable and len(qualified) == len(required_ids),
        "completionRule": completion_rule,
        "required": len(required_ids),
        "qualified": len(qualified),
        "completed": len(completed),
        "proficient": len(proficient),
        "mastered": len(mastered),
        "unavailableSkillIds": unavailable,
    }


async def sync_promotions_for_parent(parent_id: str) -> list[CurriculumPromotion]:
    students = await Student.find(Student.guardian_parent_ids == parent_id).to_list()
    student_ids = [str(item.id) for item in students]
    if not student_ids:
        return []
    assignments = await Assignment.find({
        "student_id": {"$in": student_ids},
        "status": "active",
    }).to_list()
    mastery_rows = await MasteryState.find({"student_id": {"$in": student_ids}}).to_list()
    mastery_by_student_curriculum: dict[tuple[str, str], dict[str, str]] = {}
    for row in mastery_rows:
        if not row.curriculum_id:
            continue
        mastery_by_student_curriculum.setdefault(
            (row.student_id, row.curriculum_id), {},
        )[row.skill_id] = row.level

    assignment_ids = [str(item.id) for item in assignments]
    completion_rows = await LearningEvent.find({
        "student_id": {"$in": student_ids},
        "assignment_id": {"$in": assignment_ids},
        "event_type": "lesson_complete",
        "verified": True,
    }).to_list()
    completed_by_assignment: dict[str, set[str]] = {}
    for row in completion_rows:
        if row.assignment_id and row.curriculum_skill_id:
            completed_by_assignment.setdefault(row.assignment_id, set()).add(
                row.curriculum_skill_id,
            )

    for assignment in assignments:
        release = await CurriculumRelease.find_one(
            CurriculumRelease.release_id == assignment.release_id,
        )
        if not release or not assignment.subject_id:
            continue
        available = {
            str(item.get("skill_id"))
            for item in release.question_manifest
            if item.get("skill_id")
        }
        offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == assignment.grade_id,
            CurriculumOffering.subject_id == assignment.subject_id,
        )
        snapshot = completion_snapshot(
            tree=release.tree,
            scope=assignment.scope,
            grade_id=assignment.grade_id,
            available_skill_ids=available,
            mastery_levels=mastery_by_student_curriculum.get(
                (assignment.student_id, assignment.curriculum_id), {},
            ),
            completed_skill_ids=completed_by_assignment.get(str(assignment.id), set()),
            completion_rule=(
                offering.promotion_completion_rule
                if offering else "activities_completed"
            ),
        )
        if not snapshot["complete"]:
            continue
        successor = None
        if offering and offering.successor_grade_id and offering.successor_subject_id:
            successor = await CurriculumOffering.find_one(
                CurriculumOffering.grade_id == offering.successor_grade_id,
                CurriculumOffering.subject_id == offering.successor_subject_id,
                CurriculumOffering.active == True,
            )
        existing = await CurriculumPromotion.find_one(
            CurriculumPromotion.from_assignment_id == str(assignment.id),
        )
        if existing:
            # A learner may finish before an admin configures the successor. Keep a pending
            # card current so publishing Grade 2 later immediately enables the same card.
            if existing.status in {"pending", "deferred"}:
                next_values = {
                    "to_grade_id": offering.successor_grade_id if offering else None,
                    "to_subject_id": offering.successor_subject_id if offering else None,
                    "to_curriculum_id": successor.curriculum_id if successor else None,
                    "to_release_id": successor.release_id if successor else None,
                }
                if any(getattr(existing, field) != value for field, value in next_values.items()):
                    for field, value in next_values.items():
                        setattr(existing, field, value)
                    await existing.save()
            continue
        promotion = CurriculumPromotion(
            owner_id=parent_id,
            student_id=assignment.student_id,
            subject_id=assignment.subject_id,
            from_assignment_id=str(assignment.id),
            from_curriculum_id=assignment.curriculum_id,
            from_release_id=assignment.release_id,
            from_grade_id=assignment.grade_id,
            to_grade_id=offering.successor_grade_id if offering else None,
            to_subject_id=offering.successor_subject_id if offering else None,
            to_curriculum_id=successor.curriculum_id if successor else None,
            to_release_id=successor.release_id if successor else None,
        )
        created = False
        try:
            await promotion.insert()
            created = True
        except DuplicateKeyError:
            pass
        if created:
            student = next((row for row in students if str(row.id) == assignment.student_id), None)
            for guardian_id in (student.guardian_parent_ids if student else [parent_id]):
                await create_and_send(
                    kind="auto_curriculum_completion",
                    title=f"{student.name if student else 'Your learner'} completed a curriculum",
                    body="A subject is complete. Review the next curriculum and approve promotion when you’re ready.",
                    audience="user",
                    target_user_id=guardian_id,
                    channels=["in_app"],
                    idempotency_key=f"auto_curriculum_completion:{assignment.id}:{guardian_id}",
                )
    # Any current guardian may approve. The first guardian to open the dashboard may have
    # created the durable row, but that must not hide it from another guardian.
    return await CurriculumPromotion.find({
        "student_id": {"$in": student_ids},
    }).sort("-detected_at").to_list()


async def promotion_out(item: CurriculumPromotion) -> dict[str, Any]:
    student = await Student.get(item.student_id)
    from_grade = await Grade.find_one(Grade.key == item.from_grade_id)
    from_subject = await Subject.find_one(Subject.key == item.subject_id)
    to_grade = await Grade.find_one(Grade.key == item.to_grade_id) if item.to_grade_id else None
    to_subject = await Subject.find_one(Subject.key == item.to_subject_id) if item.to_subject_id else None
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == item.from_release_id)
    return {
        "id": str(item.id),
        "studentId": item.student_id,
        "studentName": student.name if student else "Learner",
        "subjectId": item.subject_id,
        "subjectName": from_subject.name if from_subject else item.subject_id,
        "fromAssignmentId": item.from_assignment_id,
        "fromCurriculumId": item.from_curriculum_id,
        "fromCurriculumTitle": (release.tree.get("title") if release else None)
        or f"{from_grade.name if from_grade else item.from_grade_id} {from_subject.name if from_subject else item.subject_id}",
        "fromGradeId": item.from_grade_id,
        "fromGradeName": from_grade.name if from_grade else item.from_grade_id,
        "toGradeId": item.to_grade_id,
        "toGradeName": to_grade.name if to_grade else None,
        "toSubjectId": item.to_subject_id,
        "toSubjectName": to_subject.name if to_subject else None,
        "toCurriculumId": item.to_curriculum_id,
        "toReleaseId": item.to_release_id,
        "toAssignmentId": item.to_assignment_id,
        "status": item.status,
        "successorReady": bool(item.to_curriculum_id and item.to_release_id),
        "detectedAt": item.detected_at,
        "deferredUntil": item.deferred_until,
        "decidedAt": item.decided_at,
    }


async def approve_promotion(item: CurriculumPromotion, parent_id: str) -> CurriculumPromotion:
    if item.status == "completed":
        return item
    if item.status not in {"pending", "deferred"}:
        raise ValueError("Promotion is not available")
    source = await Assignment.get(item.from_assignment_id)
    if not source:
        raise ValueError("The completed assignment is no longer available")
    offering = await CurriculumOffering.find_one(
        CurriculumOffering.grade_id == item.to_grade_id,
        CurriculumOffering.subject_id == item.to_subject_id,
        CurriculumOffering.active == True,
    ) if item.to_grade_id and item.to_subject_id else None
    if not offering:
        raise ValueError("The next curriculum has not been published yet")

    target = await Assignment.find_one(
        Assignment.student_id == item.student_id,
        Assignment.grade_id == offering.grade_id,
        Assignment.subject_id == offering.subject_id,
        Assignment.status == "active",
    )
    # Recovery for a retry that arrives after the assignment transition committed but
    # before the promotion row was finalized. This closes the only non-transactional gap
    # on standalone MongoDB and keeps the approval endpoint idempotent.
    if source.status == "completed" and target:
        now = datetime.now(timezone.utc)
        item.status = "completed"
        item.to_curriculum_id = offering.curriculum_id
        item.to_release_id = offering.release_id
        item.to_assignment_id = str(target.id)
        item.decided_at = item.decided_at or now
        item.decided_by = item.decided_by or parent_id
        await item.save()
        return item
    if source.status != "active":
        raise ValueError("The completed assignment is no longer active")
    if not target:
        target = Assignment(
            owner_id=parent_id,
            student_id=item.student_id,
            curriculum_id=offering.curriculum_id,
            release_id=offering.release_id,
            grade_id=offering.grade_id,
            subject_id=offering.subject_id,
            scope={"kind": "all", "ids": []},
            mode=source.mode,
            schedule=source.schedule,
            priority=source.priority,
            placement_required=offering.promotion_placement_required,
            status="active",
        )
        try:
            await target.insert()
        except DuplicateKeyError:
            target = await Assignment.find_one(
                Assignment.student_id == item.student_id,
                Assignment.grade_id == offering.grade_id,
                Assignment.subject_id == offering.subject_id,
                Assignment.status == "active",
            )
    if not target:
        raise ValueError("Unable to create the next curriculum assignment")

    now = datetime.now(timezone.utc)
    source.status = "completed"
    source.updated_at = now
    await source.save()
    item.status = "completed"
    item.to_grade_id = offering.grade_id
    item.to_subject_id = offering.subject_id
    item.to_curriculum_id = offering.curriculum_id
    item.to_release_id = offering.release_id
    item.to_assignment_id = str(target.id)
    item.decided_at = now
    item.decided_by = parent_id
    await item.save()

    student = await Student.get(item.student_id)
    if student and student.preferred_subject == item.subject_id:
        student.preferred_subject = offering.subject_id
        await student.save()
    return item
