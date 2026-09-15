"""When each notification job runs, as an operator set it.

Cloud Scheduler still calls every job on the hour — one `cron` line each, and
the deciding done here against each family's own clock (§10). What used to be a
constant in code is now a row an operator edits from Notification Settings →
Events: whether a job runs at all, and for the weekly summary, the day and hour
it lands on. Moving Sunday evening to Saturday morning is a save, not a gcloud
command and not a release.

Defaults live in code for the reason every other catalog here does: a
deployment that never opened the screen behaves exactly as it did before the
screen existed. A row exists only once somebody changed something, plus the
last-run note each job writes.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

#: Every job, and how it ships.
JOB_DEFAULTS: dict[str, dict[str, Any]] = {
    "weekly-summary": {"enabled": True, "weekday": 6, "hour": 18},
    "daily-reminders": {"enabled": True},
    "skill-announcements": {"enabled": True},
    # Phase 2. Both ride the hourly `daily-reminders` call, so neither needs a
    # Cloud Scheduler job of its own.
    "absence-check": {"enabled": True, "days": 7},
    "daily-digest": {"enabled": True},
    "token-sweep": {"enabled": True},
}

#: The jobs whose moment an operator can move. The others have no single time:
#: reminders go at each parent's own hour, announcements as soon as there is a
#: skill to announce, and the sweep at night when nothing notices it.
TIMED = frozenset({"weekly-summary"})

#: The jobs with a number of days an operator can set — how long a child is
#: away before a parent is told.
THRESHOLD = frozenset({"absence-check"})


def _clamp(value: Any, low: int, high: int, fallback: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return number if low <= number <= high else fallback


def _merge(job: str, row: dict[str, Any]) -> dict[str, Any]:
    base = JOB_DEFAULTS[job]
    last = row.get("lastRunAt")
    return {
        "id": job,
        "enabled": bool(row.get("enabled", base["enabled"])),
        "weekday": _clamp(row.get("weekday"), 0, 6, base["weekday"]) if job in TIMED else None,
        "hour": _clamp(row.get("hour"), 0, 23, base["hour"]) if job in TIMED else None,
        "days": _clamp(row.get("days"), 1, 60, base["days"]) if job in THRESHOLD else None,
        "lastRunAt": last.isoformat() if last else None,
        "lastSent": row.get("lastSent"),
        "lastSkipped": row.get("lastSkipped"),
    }


async def get(db: AsyncIOMotorDatabase, job: str) -> dict[str, Any]:
    """One job's settings, filled in from the defaults."""
    return _merge(job, await db.notify_jobs.find_one({"_id": job}) or {})


async def all_jobs(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    rows = {row["_id"]: row for row in await db.notify_jobs.find({}).to_list(length=50)}
    return [_merge(job, rows.get(job, {})) for job in JOB_DEFAULTS]


async def save(
    db: AsyncIOMotorDatabase,
    job: str,
    *,
    enabled: bool | None = None,
    weekday: int | None = None,
    hour: int | None = None,
    days: int | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    """Change what was named and leave the rest. Returns the whole job."""
    patch: dict[str, Any] = {"updatedAt": now(), "updatedBy": updated_by}
    if job in THRESHOLD and days is not None:
        patch["days"] = _clamp(days, 1, 60, JOB_DEFAULTS[job]["days"])
    if enabled is not None:
        patch["enabled"] = enabled
    if job in TIMED and weekday is not None:
        patch["weekday"] = _clamp(weekday, 0, 6, JOB_DEFAULTS[job]["weekday"])
    if job in TIMED and hour is not None:
        patch["hour"] = _clamp(hour, 0, 23, JOB_DEFAULTS[job]["hour"])
    await db.notify_jobs.update_one({"_id": job}, {"$set": patch}, upsert=True)
    return await get(db, job)


async def note_run(db: AsyncIOMotorDatabase, job: str, report: dict[str, Any]) -> None:
    """Remember the last run, for the Events screen. Never raises.

    What an operator asks of a job they cannot watch: did it run, and did it do
    anything. A note that fails to save must not turn a finished run into a 500
    that Cloud Scheduler then retries.
    """
    try:
        await db.notify_jobs.update_one(
            {"_id": job},
            {
                "$set": {
                    "lastRunAt": now(),
                    "lastSent": report.get("sent"),
                    "lastSkipped": report.get("skipped"),
                }
            },
            upsert=True,
        )
    except Exception:  # noqa: BLE001 — a note is never worth failing a run over
        pass
