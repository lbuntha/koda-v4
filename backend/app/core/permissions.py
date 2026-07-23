"""Cross-feature authorization helpers. Kept here (not inside a feature router)
so any feature can reuse them without importing another feature.

Access rule for reading a student's data:
  * admin   — any student
  * parent  — only guardianed children
  * teacher — only students actively enrolled in a classroom the teacher owns
              (the previous "any teacher can read any student" rule is gone)
"""

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from ..models.user import User, Role
from ..models.student import Student
from ..models.classroom import Classroom, ClassEnrollment


def can_read_student(
    *,
    role: str,
    user_id: str,
    guardian_parent_ids: list[str],
    teacher_has_active_enrollment: bool,
) -> bool:
    """The authorization decision, isolated from any I/O so it is unit-testable.

    `teacher_has_active_enrollment` is resolved by the caller (a DB query) only
    when the principal is a teacher.
    """
    if role == Role.admin.value:
        return True
    if role == Role.parent.value:
        return user_id in guardian_parent_ids
    if role == Role.teacher.value:
        return teacher_has_active_enrollment
    return False


async def _teacher_has_active_enrollment(teacher_id: str, student_id: str) -> bool:
    """True iff `student_id` is actively enrolled in a non-archived classroom
    owned by `teacher_id`."""
    enrollments = await ClassEnrollment.find(
        ClassEnrollment.student_id == student_id,
        ClassEnrollment.status == "active",
    ).to_list()
    if not enrollments:
        return False
    classroom_object_ids = []
    for enrollment in enrollments:
        try:
            classroom_object_ids.append(PydanticObjectId(enrollment.classroom_id))
        except Exception:
            continue
    if not classroom_object_ids:
        return False
    owned = await Classroom.find(
        {"_id": {"$in": classroom_object_ids}, "owner_teacher_id": teacher_id, "archived_at": None}
    ).count()
    return owned > 0


async def authorize_guardian_read(student_id: str, user: User) -> None:
    """Raise 403 unless `user` may read `student_id`'s data."""
    role = user.role.value if hasattr(user.role, "value") else str(user.role)

    # Admin short-circuits without a lookup.
    if role == Role.admin.value:
        return

    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your child")

    teacher_has_enrollment = (
        await _teacher_has_active_enrollment(str(user.id), student_id)
        if role == Role.teacher.value
        else False
    )

    if can_read_student(
        role=role,
        user_id=str(user.id),
        guardian_parent_ids=student.guardian_parent_ids,
        teacher_has_active_enrollment=teacher_has_enrollment,
    ):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your child")
