"""Business logic for authoring, fanning out, and reading notifications.

`create_and_send` is the single entry point automated generators and the admin
composer both go through: it inserts the `Notification`, relies on the unique
partial index on `idempotency_key` to make automated (`auto_*`) notifications
idempotent (a duplicate insert raises, and is swallowed, rather than requiring a
pre-check query), then fans out unless the send is scheduled for later.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from ...core.logging import get_logger
from ...core.mail import Message, resolve_mailer
from ...core.runtime_settings import get_system_settings
from ...models.event import LearningEvent
from ...models.notification import Notification, NotificationReceipt
from ...models.student import Student
from ...models.user import Role, User
from ..analytics.service import MAX_SNAPSHOT_EVENTS
from ..learning.streak import DEFAULT_STREAK, current_run, reference_today, streak_days
from .schemas import InboxItemOut, InboxOut, NotificationOut, NotificationStatsOut
from .templates import achievement_notification, pin_lockout_alert, streak_notification

logger = get_logger("notifications")

#: Fallback when the stored settings document predates the `notifications` block —
#: mirrors the `DEFAULT_STREAK` pattern in `features/learning/streak.py`.
DEFAULT_NOTIFICATIONS: dict[str, Any] = {
    "auto_achievement_enabled": True,
    "auto_streak_enabled": True,
    "auto_weekly_digest_enabled": True,
    "weekly_digest_day": "sun",
    "streak_milestones": [3, 7, 14, 30, 60, 100],
    "auto_review_enabled": True,
    "auto_inactivity_enabled": True,
    "inactivity_days": 7,
    "auto_pin_lockout_enabled": True,
}

#: The only kinds that email a parent regardless of their preferences: account
#: alerts where honouring an unrelated "no marketing" toggle would leave a child
#: locked out of their own account with nobody told. Password reset already works
#: this way. The parent settings screen states this plainly rather than leaving it
#: to be discovered. Keep this set tiny, and require a deliberate decision to add.
ACCOUNT_ALERT_KINDS = frozenset({"auto_pin_lockout"})

#: Which per-user preference gates each kind's email — one feature, one switch, so
#: declining the quiet-learner nudge does not also cancel the weekly summary.
EMAIL_OPT_OUT_FIELD: dict[str, str] = {
    "auto_digest": "email_digest_enabled",
    "auto_inactivity": "email_inactivity_enabled",
    "broadcast": "email_announcements_enabled",
    "announcement": "email_announcements_enabled",
}

#: Applied to any kind in neither collection above. This fails *closed* on purpose:
#: forgetting to register a new email-capable kind must mean it respects a
#: preference, never that it mails every parent regardless of their settings. The
#: mistake should cost a missed email, not an unwanted one.
DEFAULT_EMAIL_OPT_OUT = "email_announcements_enabled"


def email_opt_out_field(kind: str) -> str | None:
    """The preference gating this kind's email, or None if it always sends."""
    if kind in ACCOUNT_ALERT_KINDS:
        return None
    field = EMAIL_OPT_OUT_FIELD.get(kind)
    if field is None:
        logger.warning(
            "notification kind=%s is not registered in EMAIL_OPT_OUT_FIELD; "
            "gating its email on %s. Register it explicitly.",
            kind, DEFAULT_EMAIL_OPT_OUT,
        )
        return DEFAULT_EMAIL_OPT_OUT
    return field


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def resolve_audience(
    audience: str, target_user_id: str | None, target_student_id: str | None
) -> tuple[list[str], list[str]]:
    """Returns (user_ids, student_ids) to fan out receipts to. "parents"/"students"/
    "all" only ever reach parent accounts, never admin/teacher — those roles aren't
    a notification audience."""
    if audience == "parents":
        users = await User.find(User.role == Role.parent).to_list()
        return [str(user.id) for user in users], []
    if audience == "students":
        students = await Student.find_all().to_list()
        return [], [str(student.id) for student in students]
    if audience == "all":
        users = await User.find(User.role == Role.parent).to_list()
        students = await Student.find_all().to_list()
        return [str(user.id) for user in users], [str(student.id) for student in students]
    if audience == "user":
        return ([target_user_id] if target_user_id else []), []
    if audience == "student":
        return [], ([target_student_id] if target_student_id else [])
    return [], []


async def create_and_send(
    *,
    kind: str,
    title: str,
    body: str,
    audience: str,
    channels: list[str],
    created_by: str | None = None,
    idempotency_key: str | None = None,
    target_user_id: str | None = None,
    target_student_id: str | None = None,
    scheduled_for: datetime | None = None,
) -> Notification | None:
    """Returns None when `idempotency_key` collides with an existing notification
    — the caller's dedup contract, so automated hooks can call this unconditionally
    on every qualifying event without a pre-check query."""
    notification = Notification(
        kind=kind, title=title, body=body, audience=audience,
        target_user_id=target_user_id, target_student_id=target_student_id,
        channels=channels, created_by=created_by,
        idempotency_key=idempotency_key, scheduled_for=scheduled_for,
    )
    try:
        await notification.insert()
    except DuplicateKeyError:
        return None
    if scheduled_for is None or scheduled_for <= _now():
        await fan_out(notification)
    return notification


async def fan_out(notification: Notification) -> int:
    """Materializes one receipt per recipient and sends email where the channel
    and the recipient's own opt-out allow it. Returns the receipt count."""
    user_ids, student_ids = await resolve_audience(
        notification.audience, notification.target_user_id, notification.target_student_id
    )
    receipts = [
        NotificationReceipt(notification_id=str(notification.id), recipient_type="user", recipient_id=uid)
        for uid in user_ids
    ] + [
        NotificationReceipt(notification_id=str(notification.id), recipient_type="student", recipient_id=sid)
        for sid in student_ids
    ]
    if receipts:
        await NotificationReceipt.insert_many(receipts)

    if "email" in notification.channels and user_ids:
        mailer = await resolve_mailer()
        users = await User.find({"_id": {"$in": [PydanticObjectId(uid) for uid in user_ids]}}).to_list()
        opt_out_field = email_opt_out_field(notification.kind)
        for user in users:
            if opt_out_field and not getattr(user, opt_out_field):
                continue
            mailer.send(Message(to=str(user.email), subject=notification.title, body=notification.body))
            await NotificationReceipt.find(
                NotificationReceipt.notification_id == str(notification.id),
                NotificationReceipt.recipient_type == "user",
                NotificationReceipt.recipient_id == str(user.id),
            ).update({"$set": {"email_sent_at": _now()}})

    notification.sent_at = _now()
    await notification.save()
    return len(receipts)


async def list_inbox(recipient_type: str, recipient_id: str, limit: int = 50) -> InboxOut:
    receipts = await NotificationReceipt.find(
        NotificationReceipt.recipient_type == recipient_type,
        NotificationReceipt.recipient_id == recipient_id,
    ).sort("-created_at").limit(limit).to_list()
    unread_count = await NotificationReceipt.find(
        NotificationReceipt.recipient_type == recipient_type,
        NotificationReceipt.recipient_id == recipient_id,
        NotificationReceipt.read_at == None,
    ).count()
    notification_ids = {receipt.notification_id for receipt in receipts}
    notifications = await Notification.find(
        {"_id": {"$in": [PydanticObjectId(nid) for nid in notification_ids]}}
    ).to_list() if notification_ids else []
    by_id = {str(row.id): row for row in notifications}
    items = []
    for receipt in receipts:
        notification = by_id.get(receipt.notification_id)
        if not notification:
            continue
        items.append(InboxItemOut(
            id=str(receipt.id), notification_id=receipt.notification_id, kind=notification.kind,
            title=notification.title, body=notification.body,
            created_at=receipt.created_at, read_at=receipt.read_at,
        ))
    return InboxOut(items=items, unread_count=unread_count)


async def mark_read(recipient_type: str, recipient_id: str, receipt_id: str) -> bool:
    try:
        receipt = await NotificationReceipt.get(PydanticObjectId(receipt_id))
    except Exception:
        receipt = None
    if not receipt or receipt.recipient_type != recipient_type or receipt.recipient_id != recipient_id:
        return False
    if receipt.read_at is None:
        receipt.read_at = _now()
        await receipt.save()
    return True


async def mark_all_read(recipient_type: str, recipient_id: str) -> int:
    receipts = await NotificationReceipt.find(
        NotificationReceipt.recipient_type == recipient_type,
        NotificationReceipt.recipient_id == recipient_id,
        NotificationReceipt.read_at == None,
    ).to_list()
    now = _now()
    for receipt in receipts:
        receipt.read_at = now
        await receipt.save()
    return len(receipts)


async def has_unread_of_kind(recipient_type: str, recipient_id: str, kind: str) -> bool:
    """Whether this recipient still has an unread notification of `kind`.

    The anti-pileup guard for recurring reminders. An idempotency key stops the
    *same* reminder repeating, but a daily "you have reviews due" is a genuinely
    new notification each day — a learner away for two months would come back to
    sixty of them stacked in the bell, which is worse than never reminding them.
    So a reminder is only issued when the last one has actually been seen.
    """
    target_field = "target_student_id" if recipient_type == "student" else "target_user_id"
    latest = await Notification.find(
        Notification.kind == kind,
        {target_field: recipient_id},
    ).sort("-created_at").limit(1).to_list()
    if not latest:
        return False
    return await NotificationReceipt.find_one(
        NotificationReceipt.notification_id == str(latest[0].id),
        NotificationReceipt.recipient_type == recipient_type,
        NotificationReceipt.recipient_id == recipient_id,
        NotificationReceipt.read_at == None,
    ) is not None


async def notify_pin_lockout(parent: User, student: Student, unlock_at: datetime) -> Notification | None:
    """Tell a guardian their child is locked out, and how to clear it themselves.

    Called from the student sign-in path. Until this existed the lockout was
    entirely silent: the child simply could not sign in, and the only way an adult
    could find out was to go looking in the dashboard for a state they had no
    reason to suspect.
    """
    settings_doc = await get_system_settings()
    flags = {**DEFAULT_NOTIFICATIONS, **dict((settings_doc.scoring or {}).get("notifications") or {})}
    if not flags["auto_pin_lockout_enabled"]:
        return None
    title, body = pin_lockout_alert(
        parent.name or "there", student.name, unlock_at.strftime("%H:%M on %d %b"),
    )
    return await create_and_send(
        kind="auto_pin_lockout", title=title, body=body,
        audience="user", target_user_id=str(parent.id),
        channels=["in_app", "email"],
        # One alert per lockout window, not per failed attempt inside it.
        idempotency_key=f"auto_pin_lockout:{student.id}:{unlock_at.isoformat()}",
    )


async def list_sent(limit: int = 200) -> list[NotificationOut]:
    rows = await Notification.find_all().sort("-created_at").limit(limit).to_list()
    outputs = []
    for row in rows:
        count = await NotificationReceipt.find(NotificationReceipt.notification_id == str(row.id)).count()
        outputs.append(NotificationOut(
            id=str(row.id), kind=row.kind, title=row.title, body=row.body,
            audience=row.audience, channels=row.channels, created_by=row.created_by,
            scheduled_for=row.scheduled_for, sent_at=row.sent_at, created_at=row.created_at,
            recipient_count=count,
        ))
    return outputs


async def stats(notification_id: str) -> NotificationStatsOut:
    recipients = await NotificationReceipt.find(NotificationReceipt.notification_id == notification_id).count()
    read = await NotificationReceipt.find(
        NotificationReceipt.notification_id == notification_id,
        {"read_at": {"$ne": None}},
    ).count()
    email_sent = await NotificationReceipt.find(
        NotificationReceipt.notification_id == notification_id,
        {"email_sent_at": {"$ne": None}},
    ).count()
    return NotificationStatsOut(recipients=recipients, read=read, email_sent=email_sent)


async def on_events_ingested(student: Student, mastery_updates: list[dict], docs: list[LearningEvent]) -> None:
    """Called right after `recompute_touched_mastery` in `events/router.py`.
    Generates at most one achievement notification per newly-reached level, and
    at most one streak notification per newly-crossed milestone — both dedup'd
    via `idempotency_key`, so this is safe to call on every ingest batch."""
    settings_doc = await get_system_settings()
    flags = {**DEFAULT_NOTIFICATIONS, **dict((settings_doc.scoring or {}).get("notifications") or {})}
    student_id = str(student.id)

    if flags["auto_achievement_enabled"]:
        for update in mastery_updates:
            if update.get("promoted") and update.get("level") in ("proficient", "master"):
                key = (
                    f"auto_achievement:{student_id}:{update.get('curriculumId')}:"
                    f"{update['skillId']}:{update['level']}"
                )
                title, body = achievement_notification(student.name, update["skillId"], update["level"])
                await create_and_send(
                    kind="auto_achievement", title=title, body=body,
                    audience="student", target_student_id=student_id,
                    channels=["in_app"], idempotency_key=key,
                )

    if flags["auto_streak_enabled"]:
        events = await LearningEvent.find(
            LearningEvent.student_id == student_id
        ).sort("-client_timestamp_ms").limit(MAX_SNAPSHOT_EVENTS).to_list()
        streak_config = {**DEFAULT_STREAK, **dict((settings_doc.scoring or {}).get("streak") or {})}
        days = streak_days(events, streak_config)
        current = current_run(days, reference_today(events), int(streak_config["grace_days"]))
        milestone = next(
            (m for m in sorted(flags["streak_milestones"], reverse=True) if m <= current), None
        )
        if milestone:
            key = f"auto_streak:{student_id}:{milestone}"
            title, body = streak_notification(student.name, milestone)
            await create_and_send(
                kind="auto_streak", title=title, body=body,
                audience="student", target_student_id=student_id,
                channels=["in_app"], idempotency_key=key,
            )
