"""Parent-facing management of their own kids (students)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from datetime import datetime, timezone

from ...models.user import User
from ...models.student import Student
from ...models.throttle import LoginThrottle
from ...core.deps import get_current_parent
from ...core.logging import get_logger
from ...core.security import hash_secret
from ...core.audit import record_audit
from .schemas import ChildIn, ChildUpdate, ChildOut
from ..analytics.service import purge_learning_data
from ..auth.guard import clear as clear_throttle

router = APIRouter(prefix="/family", tags=["family"])
logger = get_logger("family")


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


@router.get("/children", response_model=list[ChildOut])
async def list_children(parent: User = Depends(get_current_parent)):
    kids = await Student.find(Student.guardian_parent_ids == str(parent.id)).to_list()
    return [_out(kid, await _pin_lock(parent.family_code, kid.name)) for kid in kids]


@router.post("/children", response_model=ChildOut, status_code=status.HTTP_201_CREATED)
async def add_child(body: ChildIn, parent: User = Depends(get_current_parent)):
    student = Student(
        name=body.name,
        avatar=body.avatar,
        grade_level=body.grade_level or "grade_1",
        primary_subject=body.primary_subject or "math",
        profile_gender=body.profile_gender,
        learning_goals=body.learning_goals,
        birth_year=body.birth_year,
        pin_hash=hash_secret(body.pin) if body.pin else None,
        guardian_parent_ids=[str(parent.id)],
    )
    await student.insert()

    # Automatically provision placement assignment for the new student if a curriculum release exists
    try:
        from ...models.content import CurriculumRelease
        from ...models.assignment import Assignment

        release = await CurriculumRelease.find_one(sort=[("created_at", -1)])
        if release:
            assignment = Assignment(
                owner_id=str(parent.id),
                student_id=str(student.id),
                curriculum_id=release.curriculum_id,
                release_id=release.release_id,
                grade_id=student.grade_level or "grade_1",
                priority=100,
                placement_required=body.placement_required,
                status="active",
            )
            await assignment.insert()
    except Exception as e:
        print(f"Notice: Auto assignment provision warning: {e}")

    return _out(student)


@router.patch("/children/{student_id}", response_model=ChildOut)
async def update_child(student_id: str, body: ChildUpdate, parent: User = Depends(get_current_parent)):
    student = await _own_child_or_404(student_id, parent)
    if body.name is not None:
        student.name = body.name
    if body.avatar is not None:
        student.avatar = body.avatar
    if body.grade_level is not None:
        student.grade_level = body.grade_level
    if body.primary_subject is not None:
        student.primary_subject = body.primary_subject
    if body.profile_gender is not None:
        student.profile_gender = body.profile_gender
    if body.learning_goals is not None:
        student.learning_goals = body.learning_goals
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
