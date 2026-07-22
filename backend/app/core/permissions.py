"""Cross-feature authorization helpers. Kept here (not inside a feature router)
so any feature can reuse them without importing another feature."""

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from ..models.user import User, Role
from ..models.student import Student


async def authorize_guardian_read(student_id: str, user: User) -> None:
    """Allow admins/teachers to read any student; parents only their own kids."""
    if user.role in (Role.admin, Role.teacher):
        return
    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student or str(user.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your child")
