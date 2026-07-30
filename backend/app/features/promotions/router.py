"""Parent API for approving subject-level curriculum progression."""

from datetime import datetime, timedelta, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...core.audit import record_audit
from ...core.deps import get_current_admin, get_current_parent
from ...models.assignment import CurriculumPromotion
from ...models.student import Student
from ...models.user import User
from .service import approve_promotion, promotion_out, sync_promotions_for_parent

router = APIRouter(prefix="/promotions", tags=["promotions"])


async def _owned_promotion(raw_id: str, parent: User) -> CurriculumPromotion:
    try:
        item = await CurriculumPromotion.get(PydanticObjectId(raw_id))
    except Exception:
        item = None
    student = await Student.get(item.student_id) if item else None
    if not item or not student or str(parent.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Promotion not found")
    return item


@router.get("")
async def list_promotions(parent: User = Depends(get_current_parent)):
    rows = await sync_promotions_for_parent(str(parent.id))
    return {"promotions": [await promotion_out(item) for item in rows]}


@router.get("/admin")
async def list_promotions_for_admin(_: User = Depends(get_current_admin)):
    rows = await CurriculumPromotion.find_all().sort("-detected_at").to_list()
    return {"promotions": [await promotion_out(item) for item in rows]}


@router.post("/{promotion_id}/approve")
async def approve(promotion_id: str, parent: User = Depends(get_current_parent)):
    item = await _owned_promotion(promotion_id, parent)
    try:
        updated = await approve_promotion(item, str(parent.id))
    except ValueError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error))
    await record_audit(
        actor=parent,
        owner_id=str(parent.id),
        resource_type="curriculum_promotion",
        action="approved",
        curriculum_id=updated.from_curriculum_id,
        summary={
            "studentId": updated.student_id,
            "fromAssignmentId": updated.from_assignment_id,
            "toAssignmentId": updated.to_assignment_id,
        },
    )
    return await promotion_out(updated)


@router.post("/{promotion_id}/defer")
async def defer(promotion_id: str, parent: User = Depends(get_current_parent)):
    item = await _owned_promotion(promotion_id, parent)
    if item.status not in {"pending", "deferred"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "Promotion is no longer pending")
    item.status = "deferred"
    item.decided_at = datetime.now(timezone.utc)
    item.deferred_until = item.decided_at + timedelta(days=7)
    item.decided_by = str(parent.id)
    await item.save()
    return await promotion_out(item)
