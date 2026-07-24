"""Phase 3 server-authoritative student progress endpoints."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...core.deps import Principal, get_principal
from ...core.permissions import authorize_guardian_read
from ...models.student import Student
from ...models.user import Role, User
from .service import build_progress


router = APIRouter(prefix="/progress", tags=["progress"])


async def _authorize(student_id: str, principal: Principal) -> None:
    if principal.role == Role.student.value:
        if principal.id != student_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Students can only read their own progress")
        try:
            student = await Student.get(PydanticObjectId(student_id))
        except Exception:
            student = None
        if not student:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
        return
    try:
        user = await User.get(PydanticObjectId(principal.id))
    except Exception:
        user = None
    if not user or user.disabled_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
    await authorize_guardian_read(student_id, user)


@router.get("/{student_id}")
async def progress(student_id: str, principal: Principal = Depends(get_principal)):
    await _authorize(student_id, principal)
    return await build_progress(student_id)


@router.get("/{student_id}/{skill_id}")
async def skill_progress(
    student_id: str,
    skill_id: str,
    curriculum_id: str | None = None,
    principal: Principal = Depends(get_principal),
):
    await _authorize(student_id, principal)
    output = await build_progress(student_id)
    matches = [
        skill for skill in output["skills"]
        if skill["skillId"] == skill_id
        and (curriculum_id is None or skill["curriculumId"] == curriculum_id)
    ]
    if not matches:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Skill progress not found")
    if len(matches) > 1 and curriculum_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Skill exists in multiple curricula; provide curriculum_id",
        )
    return {
        "studentId": student_id,
        "scoringRevision": output["scoringRevision"],
        "engineRevision": output["engineRevision"],
        "skill": matches[0],
    }
