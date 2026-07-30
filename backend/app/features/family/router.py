"""Parent-facing management of their own kids (students)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from datetime import datetime, timezone

from ...models.user import User
from ...models.student import Student
from ...models.assignment import Assignment
from ...models.content import CurriculumRelease
from ...models.throttle import LoginThrottle
from ...core.deps import get_current_parent
from ...core.logging import get_logger
from ...core.security import hash_secret
from ...core.audit import record_audit
from .schemas import ChildIn, ChildUpdate, ChildOut, NotificationPrefsIn
from ..analytics.service import purge_learning_data
from ..auth.guard import clear as clear_throttle
from ..content.offerings import canonical_subject_ids, resolve_release

router = APIRouter(prefix="/family", tags=["family"])
logger = get_logger("family")


async def _subject_plan(
    grade_id: str,
    primary_subject: str | None,
    learning_goals: list[str],
):
    requested_subjects = [primary_subject or "math", *learning_goals]
    subject_ids, unknown_subjects = await canonical_subject_ids(grade_id, requested_subjects)
    if unknown_subjects:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"These subjects are not available for {grade_id}: {', '.join(unknown_subjects)}",
        )
    if not subject_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose at least one available subject")

    releases = []
    missing_subjects = []
    for subject_id in subject_ids:
        release = await resolve_release(grade_id, subject_id)
        if release:
            releases.append((subject_id, release))
        else:
            missing_subjects.append(subject_id)
    if missing_subjects:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Content is not published yet for: " + ", ".join(missing_subjects),
        )
    return subject_ids, releases


async def _reconcile_assignments(
    *,
    student: Student,
    parent: User,
    grade_id: str,
    releases: list[tuple[str, CurriculumRelease]],
) -> None:
    """Keep one active assignment per desired subject and archive removed access."""
    desired = {subject_id: release for subject_id, release in releases}
    all_rows = await Assignment.find(
        Assignment.student_id == str(student.id),
    ).sort("priority", "created_at").to_list()
    rows = [row for row in all_rows if row.status == "active"]
    retained: dict[str, Assignment] = {}
    changed: dict[str, tuple[Assignment, str, int, datetime]] = {}
    created: list[Assignment] = []
    now = datetime.now(timezone.utc)
    try:
        for row in rows:
            keep = row.grade_id == grade_id and row.subject_id in desired and row.subject_id not in retained
            if keep and row.subject_id:
                retained[row.subject_id] = row
                continue
            changed[str(row.id)] = (row, row.status, row.priority, row.updated_at)
            row.status = "archived"
            row.updated_at = now
            await row.save()

        for index, (subject_id, release) in enumerate(releases):
            priority = 50 + (index * 10)
            existing = retained.get(subject_id)
            if existing:
                if existing.priority != priority:
                    changed[str(existing.id)] = (
                        existing,
                        existing.status,
                        existing.priority,
                        existing.updated_at,
                    )
                    existing.priority = priority
                    existing.updated_at = now
                    await existing.save()
                continue
            resumable = next((
                row
                for row in all_rows
                if row.status != "active"
                and row.grade_id == grade_id
                and row.subject_id == subject_id
                and row.curriculum_id == release.curriculum_id
                and row.release_id == release.release_id
            ), None)
            if resumable:
                changed[str(resumable.id)] = (
                    resumable,
                    resumable.status,
                    resumable.priority,
                    resumable.updated_at,
                )
                resumable.status = "active"
                resumable.priority = priority
                resumable.updated_at = now
                await resumable.save()
                retained[subject_id] = resumable
                continue
            assignment = Assignment(
                owner_id=str(parent.id),
                student_id=str(student.id),
                curriculum_id=release.curriculum_id,
                release_id=release.release_id,
                grade_id=grade_id,
                subject_id=subject_id,
                priority=priority,
                placement_required=True,
                status="active",
            )
            await assignment.insert()
            created.append(assignment)
    except Exception:
        for assignment in created:
            await assignment.delete()
        for assignment, previous_status, priority, updated_at in changed.values():
            assignment.status = previous_status
            assignment.priority = priority
            assignment.updated_at = updated_at
            await assignment.save()
        raise


def pin_throttle_key(family_code: str | None, child_name: str) -> str | None:
    """The key `/auth/student/login` counts against — rebuilt here to read the same row."""
    if not family_code:
        return None
    return f"pin:{family_code.upper()}:{child_name.strip().lower()}"


async def _pin_lock(family_code: str | None, child_name: str) -> datetime | None:
    key = pin_throttle_key(family_code, child_name)
    if not key:
        return None
    row = await LoginThrottle.find_one(LoginThrottle.key == key)
    if not row or not row.locked_until:
        return None
    locked_until = row.locked_until if row.locked_until.tzinfo else row.locked_until.replace(tzinfo=timezone.utc)
    # An expired lock is not a lock; the row is swept later but must not show as one now.
    return locked_until if locked_until > datetime.now(timezone.utc) else None


def _out(s: Student, pin_locked_until: datetime | None = None) -> ChildOut:
    return ChildOut(
        id=str(s.id),
        name=s.name,
        avatar=s.avatar,
        grade_level=s.grade_level or "grade_1",
        primary_subject=s.primary_subject or "math",
        profile_gender=s.profile_gender,
        learning_goals=s.learning_goals,
        birth_year=s.birth_year,
        has_pin=s.pin_hash is not None,
        pin_locked_until=pin_locked_until,
    )


async def _own_child_or_404(student_id: str, parent: User) -> Student:
    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student or str(parent.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Child not found")
    return student


@router.patch("/me/notification-preferences")
async def update_notification_preferences(body: NotificationPrefsIn, parent: User = Depends(get_current_parent)):
    """A parent's own opt-out for the weekly digest / announcement emails — a
    benign self-service preference, not audited (same tier as the theme toggle)."""
    if body.email_digest_enabled is not None:
        parent.email_digest_enabled = body.email_digest_enabled
    if body.email_inactivity_enabled is not None:
        parent.email_inactivity_enabled = body.email_inactivity_enabled
    if body.email_announcements_enabled is not None:
        parent.email_announcements_enabled = body.email_announcements_enabled
    await parent.save()
    return {
        "email_digest_enabled": parent.email_digest_enabled,
        "email_inactivity_enabled": parent.email_inactivity_enabled,
        "email_announcements_enabled": parent.email_announcements_enabled,
    }


@router.get("/children", response_model=list[ChildOut])
async def list_children(parent: User = Depends(get_current_parent)):
    kids = await Student.find(Student.guardian_parent_ids == str(parent.id)).to_list()
    return [_out(kid, await _pin_lock(parent.family_code, kid.name)) for kid in kids]


@router.post("/children", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
async def add_child(body: ChildIn, parent: User = Depends(get_current_parent)):
    grade_id = body.grade_level or "grade_1"
    subject_ids, releases = await _subject_plan(grade_id, body.primary_subject, body.learning_goals)

    primary_subject = subject_ids[0]
    student = Student(
        name=body.name,
        avatar=body.avatar,
        grade_level=grade_id,
        primary_subject=primary_subject,
        profile_gender=body.profile_gender,
        learning_goals=subject_ids,
        birth_year=body.birth_year,
        pin_hash=hash_secret(body.pin) if body.pin else None,
        guardian_parent_ids=[str(parent.id)],
    )
    inserted_assignments: list[Assignment] = []
    try:
        await student.insert()
        for index, (subject_id, release) in enumerate(releases):
            assignment = Assignment(
                owner_id=str(parent.id),
                student_id=str(student.id),
                curriculum_id=release.curriculum_id,
                release_id=release.release_id,
                grade_id=grade_id,
                subject_id=subject_id,
                priority=50 + (index * 10),
                placement_required=body.placement_required,
                status="active",
            )
            await assignment.insert()
            inserted_assignments.append(assignment)
    except Exception as exc:
        for assignment in inserted_assignments:
            await assignment.delete()
        if student.id:
            await student.delete()
        logger.exception("child provisioning failed parent_id=%s", parent.id)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not provision the child profile") from exc

    return _out(student)


@router.patch("/children/{student_id}", response_model=ChildOut)
async def update_child(student_id: str, body: ChildUpdate, parent: User = Depends(get_current_parent)):
    student = await _own_child_or_404(student_id, parent)
    subject_change = any(
        value is not None
        for value in (body.grade_level, body.primary_subject, body.learning_goals)
    )
    if subject_change:
        grade_id = body.grade_level or student.grade_level or "grade_1"
        goals = body.learning_goals if body.learning_goals is not None else student.learning_goals
        primary = body.primary_subject or student.primary_subject
        if goals and primary not in goals and body.primary_subject is None:
            primary = goals[0]
        subject_ids, releases = await _subject_plan(grade_id, primary, goals)
        await _reconcile_assignments(
            student=student,
            parent=parent,
            grade_id=grade_id,
            releases=releases,
        )
        student.grade_level = grade_id
        student.primary_subject = subject_ids[0]
        student.learning_goals = subject_ids
    if body.name is not None:
        student.name = body.name
    if body.avatar is not None:
        student.avatar = body.avatar
    if body.profile_gender is not None:
        student.profile_gender = body.profile_gender
    if body.birth_year is not None:
        student.birth_year = body.birth_year
    if body.pin is not None:
        student.pin_hash = hash_secret(body.pin)
    await student.save()
    return _out(student)


@router.delete("/children/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_child(student_id: str, parent: User = Depends(get_current_parent)):
    student = await _own_child_or_404(student_id, parent)
    counts = await purge_learning_data(str(student.id), include_student=True)
    await record_audit(
        actor=parent,
        resource_type="student_data",
        action="child_profile_deleted",
        owner_id=student_id,
        reason="Guardian deleted child profile",
        summary={"studentId": student_id, "deletedCounts": counts},
    )


@router.post("/children/{student_id}/unlock-pin", response_model=ChildOut)
async def unlock_child_pin(student_id: str, parent: User = Depends(get_current_parent)):
    """Clear a PIN lockout for one's own child.

    Telling a parent their child is locked out is only half a fix if they then have to wait it
    out. Scoped to their own child, and it clears the counter rather than changing the PIN, so
    it cannot be used to take an account over.
    """
    student = await _own_child_or_404(student_id, parent)
    key = pin_throttle_key(parent.family_code, student.name)
    if key:
        await clear_throttle([key])
    logger.info("pin lockout cleared by guardian student_id=%s", student.id)
    await record_audit(
        actor=parent,
        resource_type="student_account",
        action="child_pin_unlocked",
        owner_id=student_id,
        reason="Guardian cleared a PIN lockout",
    )
    return _out(student)
