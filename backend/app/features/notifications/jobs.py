"""Periodic notification work: the weekly parent digest, and any admin-scheduled
broadcasts whose send time has arrived. Neither is triggered by a request — both
run from `backend/scripts/run_notification_jobs.py`, invoked by external cron (see
that script's docstring). There is no in-process scheduler in this codebase.
"""

from __future__ import annotations

from datetime import datetime, timezone

from beanie import PydanticObjectId

from ...core.runtime_settings import get_system_settings
from ...models.event import LearningEvent
from ...models.mastery import MasteryState
from ...models.notification import Notification
from ...models.student import Student
from ...models.user import Role, User
from ..analytics.service import activity_snapshot
from . import service
from .templates import (
    feature_announcement_email,
    inactivity_nudge,
    review_reminder_notification,
    weekly_digest_email,
)

_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


async def _flags() -> dict:
    settings_doc = await get_system_settings()
    return {**service.DEFAULT_NOTIFICATIONS, **dict((settings_doc.scoring or {}).get("notifications") or {})}


async def run_review_reminders(now: datetime) -> int:
    """One grouped "you have N skills to review" per learner, at most once a day.

    `MasteryState.next_review_at` is the spaced-repetition scheduler field, and the
    model carries a dedicated `(student_id, next_review_at)` index for exactly this
    query — the data was already shaped for a reminder nobody had built yet.
    """
    flags = await _flags()
    if not flags["auto_review_enabled"]:
        return 0

    # Group in the database: one row per learner with a backlog, not one per skill.
    rows = await MasteryState.get_motor_collection().aggregate([
        {"$match": {"next_review_at": {"$ne": None, "$lte": now}}},
        {"$group": {"_id": "$student_id", "due": {"$sum": 1}}},
    ]).to_list(length=None)

    sent = 0
    for row in rows:
        student_id, due = row["_id"], row["due"]
        # Don't stack a new reminder on top of one they haven't read yet.
        if await service.has_unread_of_kind("student", student_id, "auto_review"):
            continue
        try:
            student = await Student.get(PydanticObjectId(student_id))
        except Exception:
            # A malformed legacy student_id is one learner's problem, not the job's.
            student = None
        if not student:
            continue
        title, body = review_reminder_notification(student.name, due)
        result = await service.create_and_send(
            kind="auto_review", title=title, body=body,
            audience="student", target_student_id=student_id,
            channels=["in_app"],
            idempotency_key=f"auto_review:{student_id}:{now.date().isoformat()}",
        )
        if result is not None:
            sent += 1
    return sent


async def run_inactivity_nudges(now: datetime) -> int:
    """Tell a parent once when a learner who had been practising goes quiet.

    Keyed to the learner's last active day, so the gap gets exactly one nudge no
    matter how long it lasts, and a fresh gap later earns a fresh one. Learners who
    have never played at all are skipped — "we haven't seen them in 7 days" is not
    an honest thing to say about someone who never started.
    """
    flags = await _flags()
    if not flags["auto_inactivity_enabled"]:
        return 0
    threshold_days = int(flags["inactivity_days"])

    sent = 0
    for parent in await User.find(User.role == Role.parent).to_list():
        for kid in await Student.find(Student.guardian_parent_ids == str(parent.id)).to_list():
            latest = await LearningEvent.find(
                LearningEvent.student_id == str(kid.id)
            ).sort("-client_timestamp_ms").limit(1).to_list()
            if not latest:
                continue
            stamp = latest[0].client_timestamp_ms
            last_active = (
                datetime.fromtimestamp(stamp / 1000, tz=timezone.utc) if stamp
                else latest[0].received_at
            )
            if last_active.tzinfo is None:
                last_active = last_active.replace(tzinfo=timezone.utc)
            quiet_days = (now - last_active).days
            if quiet_days < threshold_days:
                continue
            title, body = inactivity_nudge(parent.name or "there", kid.name, quiet_days)
            result = await service.create_and_send(
                kind="auto_inactivity", title=title, body=body,
                audience="user", target_user_id=str(parent.id),
                channels=["in_app", "email"],
                idempotency_key=f"auto_inactivity:{kid.id}:{last_active.date().isoformat()}",
            )
            if result is not None:
                sent += 1
    return sent


async def run_weekly_digests(now: datetime) -> int:
    """Sends one digest email per opted-in parent, at most once per ISO week.
    Safe to invoke daily — it no-ops on every day except the configured
    `weekly_digest_day`, and the idempotency key caps it at once per week even if
    invoked more than once on that day."""
    flags = await _flags()
    if not flags["auto_weekly_digest_enabled"]:
        return 0
    if _WEEKDAY_KEYS[now.weekday()] != flags["weekly_digest_day"]:
        return 0

    iso_year, iso_week, _ = now.isocalendar()
    sent = 0
    parents = await User.find(User.role == Role.parent, User.email_digest_enabled == True).to_list()
    for parent in parents:
        kids = await Student.find(Student.guardian_parent_ids == str(parent.id)).to_list()
        if not kids:
            continue
        children = []
        for kid in kids:
            summary = (await activity_snapshot(str(kid.id)))["summary"]
            children.append({
                "name": kid.name,
                "xp_earned": summary["xpEarned"],
                "current_streak_days": summary["currentStreakDays"],
                "lessons_completed": summary["lessonsCompleted"],
            })
        message = weekly_digest_email(parent.name, children)
        key = f"auto_digest:{parent.id}:{iso_year}-W{iso_week:02d}"
        result = await service.create_and_send(
            kind="auto_digest", title=message.subject, body=message.body,
            audience="user", target_user_id=str(parent.id),
            channels=["email"], idempotency_key=key,
        )
        if result is not None:
            sent += 1
    return sent


async def flush_due_broadcasts(now: datetime) -> int:
    """Fans out any admin-composed broadcast whose `scheduled_for` has arrived."""
    due = await Notification.find({
        "sent_at": None,
        "scheduled_for": {"$ne": None, "$lte": now},
    }).to_list()
    for notification in due:
        await service.fan_out(notification)
    return len(due)


async def send_feature_announcement() -> int:
    """One-off: introduces the notifications feature to every parent who hasn't
    opted out of announcement emails. Idempotent via a versioned key, so running
    this script twice is harmless — intended to be run once, by hand, not on a
    recurring schedule."""
    sent = 0
    parents = await User.find(User.role == Role.parent, User.email_announcements_enabled == True).to_list()
    for parent in parents:
        message = feature_announcement_email(parent.name)
        key = f"announcement:notifications-launch-v1:{parent.id}"
        result = await service.create_and_send(
            kind="announcement", title=message.subject, body=message.body,
            audience="user", target_user_id=str(parent.id),
            channels=["email", "in_app"], idempotency_key=key,
        )
        if result is not None:
            sent += 1
    return sent
