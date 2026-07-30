"""Admin compose/history endpoints, plus the parent/adult and student inbox
reads. Split into two recipient paths (`/notifications/me` for a `User`,
`/notifications/student/me` for a `Student`) because there is no unified
User/Student principal dependency in `core/deps.py` — this mirrors the existing
split between `features/family/router.py` and `features/events/router.py`."""

from fastapi import APIRouter, Depends, HTTPException, status

from ...core.audit import record_audit
from ...core.deps import get_current_admin, get_current_student, get_current_user
from ...models.student import Student
from ...models.user import User
from . import service
from .schemas import ComposeNotificationIn, InboxOut, NotificationOut, NotificationStatsOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/compose", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
async def compose_notification(body: ComposeNotificationIn, admin: User = Depends(get_current_admin)):
    if body.target_user_id and not await User.get(body.target_user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Target user does not exist")
    if body.target_student_id and not await Student.get(body.target_student_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Target student does not exist")

    notification = await service.create_and_send(
        kind="broadcast",
        title=body.title,
        body=body.body,
        audience=body.audience,
        channels=body.channels,
        created_by=str(admin.id),
        target_user_id=body.target_user_id,
        target_student_id=body.target_student_id,
        scheduled_for=body.scheduled_for,
    )
    stats = await service.stats(str(notification.id))
    await record_audit(
        actor=admin, resource_type="notification", action="broadcast_sent",
        owner_id=str(notification.id),
        summary={
            "title": notification.title, "audience": notification.audience,
            "channels": notification.channels, "recipientCount": stats.recipients,
        },
    )
    return NotificationOut(
        id=str(notification.id), kind=notification.kind, title=notification.title,
        body=notification.body, audience=notification.audience, channels=notification.channels,
        created_by=notification.created_by, scheduled_for=notification.scheduled_for,
        sent_at=notification.sent_at, created_at=notification.created_at,
        recipient_count=stats.recipients,
    )


@router.get("/sent", response_model=list[NotificationOut])
async def sent_notifications(limit: int = 200, _: User = Depends(get_current_admin)):
    return await service.list_sent(min(max(limit, 1), 500))


@router.get("/{notification_id}/stats", response_model=NotificationStatsOut)
async def notification_stats(notification_id: str, _: User = Depends(get_current_admin)):
    return await service.stats(notification_id)


@router.get("/me", response_model=InboxOut)
async def my_inbox(user: User = Depends(get_current_user)):
    return await service.list_inbox("user", str(user.id))


@router.post("/me/{receipt_id}/read")
async def mark_my_notification_read(receipt_id: str, user: User = Depends(get_current_user)):
    if not await service.mark_read("user", str(user.id), receipt_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return {"ok": True}


@router.post("/me/read-all")
async def mark_all_my_notifications_read(user: User = Depends(get_current_user)):
    count = await service.mark_all_read("user", str(user.id))
    return {"marked": count}


@router.get("/student/me", response_model=InboxOut)
async def my_student_inbox(student: Student = Depends(get_current_student)):
    return await service.list_inbox("student", str(student.id))


@router.post("/student/me/{receipt_id}/read")
async def mark_my_student_notification_read(receipt_id: str, student: Student = Depends(get_current_student)):
    if not await service.mark_read("student", str(student.id), receipt_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return {"ok": True}
