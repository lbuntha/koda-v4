"""When a person may be rung, and when they would rather not be.

The half of §5 that phase 1 plumbed and nothing ever wrote: quiet hours, and —
new for the reminder kinds — the hour a parent chose to be reminded at. Both are
about *time*, both belong to one adult rather than to a family, and neither is a
switch, which is why they are not rows in `notify_prefs`.

**A row per person, not per kind.** `notify_prefs` is keyed by kind because a
kind id contains a dot and Mongo reads dots as a path; that reasoning does not
apply here, and one document per person is what "do not ring me after nine"
actually is.

**Offsets, not an IANA zone.** §5 said the browser would report a zone. It
reports an offset instead, for the same reason `events.latest_tz_offset` reads
one: the offset is already on every learning event, the client already computes
it, and a zone database in the server buys correctness across a daylight-saving
boundary that a family who has not opened the app since the clocks changed does
not have anyway. The trade is stated where it is made.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

#: The hour a reminder goes out when a parent turned reminders on and never
#: chose one. Late afternoon: after school, before the evening runs out.
DEFAULT_REMINDER_HOUR = 17

#: When quiet hours run, for an account that has not set them.
#:
#: On by default, and that is the deliberate half. Every other preference here
#: ships off and waits to be asked for; this one protects a child's evening from
#: the feature itself, and a default of "no quiet hours" would mean the first
#: parent to turn reminders on discovers the policy by being woken at three in
#: the morning by a courtesy notification.
DEFAULT_QUIET_FROM = 21
DEFAULT_QUIET_TO = 7


def defaults() -> dict[str, Any]:
    return {
        "reminderHour": DEFAULT_REMINDER_HOUR,
        "quietFrom": DEFAULT_QUIET_FROM,
        "quietTo": DEFAULT_QUIET_TO,
        "tzOffsetMinutes": None,
    }


def _clamp_hour(value: Any, fallback: int) -> int:
    try:
        hour = int(value)
    except (TypeError, ValueError):
        return fallback
    return hour if 0 <= hour <= 23 else fallback


async def for_user(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any]:
    """One person's schedule, filled in from the defaults where they said nothing."""
    row = await db.notify_schedule.find_one({"_id": user_id}) or {}
    base = defaults()
    return {
        "reminderHour": _clamp_hour(row.get("reminderHour"), base["reminderHour"]),
        "quietFrom": _clamp_hour(row.get("quietFrom"), base["quietFrom"]),
        "quietTo": _clamp_hour(row.get("quietTo"), base["quietTo"]),
        "tzOffsetMinutes": row.get("tzOffsetMinutes"),
    }


async def for_users(db: AsyncIOMotorDatabase, user_ids: list[str]) -> dict[str, dict[str, Any]]:
    """Schedules for everyone a run is about, in one query rather than one each."""
    if not user_ids:
        return {}
    rows = await db.notify_schedule.find({"_id": {"$in": user_ids}}).to_list(length=500)
    found = {row["_id"]: row for row in rows}
    base = defaults()
    return {
        user_id: {
            "reminderHour": _clamp_hour(found.get(user_id, {}).get("reminderHour"), base["reminderHour"]),
            "quietFrom": _clamp_hour(found.get(user_id, {}).get("quietFrom"), base["quietFrom"]),
            "quietTo": _clamp_hour(found.get(user_id, {}).get("quietTo"), base["quietTo"]),
            "tzOffsetMinutes": found.get(user_id, {}).get("tzOffsetMinutes"),
        }
        for user_id in user_ids
    }


async def save(
    db: AsyncIOMotorDatabase,
    user_id: str,
    *,
    reminder_hour: int | None = None,
    quiet_from: int | None = None,
    quiet_to: int | None = None,
    tz_offset_minutes: int | None = None,
) -> dict[str, Any]:
    """Set what was named and leave the rest. Returns the whole schedule."""
    patch: dict[str, Any] = {"userId": user_id, "updatedAt": now()}
    if reminder_hour is not None:
        patch["reminderHour"] = _clamp_hour(reminder_hour, DEFAULT_REMINDER_HOUR)
    if quiet_from is not None:
        patch["quietFrom"] = _clamp_hour(quiet_from, DEFAULT_QUIET_FROM)
    if quiet_to is not None:
        patch["quietTo"] = _clamp_hour(quiet_to, DEFAULT_QUIET_TO)
    if tz_offset_minutes is not None and -840 <= tz_offset_minutes <= 840:
        patch["tzOffsetMinutes"] = tz_offset_minutes

    await db.notify_schedule.update_one({"_id": user_id}, {"$set": patch}, upsert=True)
    return await for_user(db, user_id)


def is_quiet(schedule: dict[str, Any], local_hour: int) -> bool:
    """Whether this hour falls inside the window a person asked to be left alone.

    Wraps around midnight, which is the normal case and the one a naive
    comparison gets wrong: 21 to 7 is not "between 21 and 7" on a number line,
    it is everything outside 7 to 21.

    Equal `from` and `to` means no quiet hours at all rather than every hour —
    a person who set both to the same time was turning the window off, and
    reading it as "always quiet" would silently stop every courtesy notification
    they had asked for.
    """
    start, end = schedule["quietFrom"], schedule["quietTo"]
    if start == end:
        return False
    if start < end:
        return start <= local_hour < end
    return local_hour >= start or local_hour < end


def next_open_hour(schedule: dict[str, Any], local_hour: int) -> int:
    """The first hour this person is willing to hear from us again.

    A courtesy notification inside quiet hours is *held to the edge of the
    window*, not dropped — §5's own words. What is returned is the hour to hold
    it until, which is `quietTo`; a caller outside quiet hours gets the hour it
    already has.
    """
    return schedule["quietTo"] if is_quiet(schedule, local_hour) else local_hour


async def forget_user(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Deleting an account takes its schedule with it."""
    result = await db.notify_schedule.delete_one({"_id": user_id})
    return result.deleted_count
