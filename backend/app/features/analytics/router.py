"""Phase 4 authorized adult analytics and child-data controls."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ...core.audit import record_audit
from ...core.deps import get_current_user
from ...core.permissions import authorize_guardian_read
from ...models.student import Student
from ...models.user import Role, User
from ..progression.service import build_progress
from .service import (
    activity_snapshot,
    authorized_students,
    export_student_data,
    purge_learning_data,
    recommendation_snapshot,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


class PurgeIn(BaseModel):
    confirmation: str = Field(min_length=6, max_length=20)
    reason: str = Field(default="Requested by authorized adult", max_length=300)


def can_manage_student_data(role: str) -> bool:
    """Only guardians and admins may export or permanently delete child data."""
    return role in {Role.admin.value, Role.parent.value}


def _require_data_manager(user: User) -> None:
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if not can_manage_student_data(role):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only an administrator or guardian may manage learning data",
        )


async def _student(student_id: str) -> Student:
    try:
        row = await Student.get(PydanticObjectId(student_id))
    except Exception:
        row = None
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return row


@router.get("/students")
async def roster(user: User = Depends(get_current_user)):
    rows = await authorized_students(user)
    return {
        "students": [
            {"id": str(row.id), "name": row.name, "avatar": row.avatar}
            for row in rows
        ]
    }


@router.get("/summary")
async def summary(student_id: str, user: User = Depends(get_current_user)):
    await authorize_guardian_read(student_id, user)
    activity = await activity_snapshot(student_id, limit=1)
    progress = await build_progress(student_id)
    return {
        "studentId": student_id,
        **activity["summary"],
        "rank": progress["rank"],
    }


@router.get("/mastery")
async def mastery(
    student_id: str,
    subject_id: str | None = None,
    grade_id: str | None = None,
    assignment_id: str | None = None,
    user: User = Depends(get_current_user),
):
    await authorize_guardian_read(student_id, user)
    output = await build_progress(student_id)
    if subject_id or grade_id or assignment_id:
        output["skills"] = [
            skill for skill in output["skills"]
            if (not subject_id or skill.get("subjectId") == subject_id)
            and (not grade_id or skill.get("gradeId") == grade_id)
            and (not assignment_id or skill.get("assignmentId") == assignment_id)
        ]
    return output


@router.get("/activity")
async def activity(
    student_id: str,
    limit: int = 100,
    assignment_id: str | None = None,
    user: User = Depends(get_current_user),
):
    await authorize_guardian_read(student_id, user)
    return await activity_snapshot(student_id, limit=limit, assignment_id=assignment_id)


@router.get("/recommendations")
async def recommendations(
    student_id: str,
    limit: int = 20,
    user: User = Depends(get_current_user),
):
    await authorize_guardian_read(student_id, user)
    return await recommendation_snapshot(student_id, limit=limit)


@router.get("/data-export/{student_id}")
async def data_export(student_id: str, user: User = Depends(get_current_user)):
    await authorize_guardian_read(student_id, user)
    _require_data_manager(user)
    student = await _student(student_id)
    output = await export_student_data(student)
    await record_audit(
        actor=user,
        resource_type="student_data",
        action="exported",
        owner_id=student_id,
        summary={"studentId": student_id},
    )
    return output


@router.delete("/data/{student_id}")
async def delete_learning_data(
    student_id: str,
    body: PurgeIn,
    user: User = Depends(get_current_user),
):
    await authorize_guardian_read(student_id, user)
    _require_data_manager(user)
    if body.confirmation != "DELETE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Type "DELETE" to confirm')
    await _student(student_id)
    counts = await purge_learning_data(student_id)
    await record_audit(
        actor=user,
        resource_type="student_data",
        action="learning_data_deleted",
        owner_id=student_id,
        reason=body.reason,
        summary={"studentId": student_id, "deletedCounts": counts},
    )
    return {"ok": True, "deleted": counts}


@router.get("/retention")
async def retention(_: User = Depends(get_current_user)):
    return {
        "policy": "account_lifetime",
        "description": "Learning data is retained while the child profile exists. Authorized adults may export or permanently delete it at any time.",
        "deletionIsPermanent": True,
    }
