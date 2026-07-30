"""The daily-streak policy, in one place.

Two surfaces read a streak — the learner's home chip (current run) and the `streakDays`
achievement metric (longest run, per curriculum). They used to compute it separately and
disagreed about what a day even was: the chip counted any event, the achievement counted any
event but never reset. Both now share this module and the same admin configuration
(`SystemSettings.scoring.streak`), so they cannot drift.

Pure functions — the caller supplies events and config, and does the I/O.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any


#: Used when the stored settings predate this block, or a caller passes nothing.
DEFAULT_STREAK: dict[str, Any] = {
    "counts": "attempt",
    "min_events_per_day": 1,
    "grace_days": 1,
}


def _qualifies(event: Any, counts: str) -> bool:
    """Whether one event is the kind of work a streak day is meant to represent."""
    if counts == "any":
        return True
    if counts == "lesson_complete":
        return event.event_type == "lesson_complete"
    # Unverifiable events stay out of authoritative reads (progression-design §7).
    return event.event_type == "attempt" and bool(event.verified)


def streak_days(events: list[Any], config: dict[str, Any] | None = None) -> set[date]:
    """The calendar days that count, under the admin's streak rule.

    Days come from each event's own `occurred_at`, so a day is the learner's local day
    rather than the server's.
    """
    settings = {**DEFAULT_STREAK, **(config or {})}
    counts = settings.get("counts", "attempt")
    minimum = max(1, int(settings.get("min_events_per_day", 1)))
    tally: dict[date, int] = {}
    for event in events:
        raw = getattr(event, "occurred_at", None)
        if not raw or not _qualifies(event, counts):
            continue
        parsed = _parsed(raw)
        if not parsed:
            continue
        day = parsed.date()
        tally[day] = tally.get(day, 0) + 1
    return {day for day, count in tally.items() if count >= minimum}


def _parsed(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def reference_today(events: list[Any], now: datetime | None = None) -> date:
    """"Today" on the learner's clock, not the server's.

    Streak days come from each event's own `occurred_at`, which carries the offset the
    learner was in. Comparing those against `datetime.now(utc).date()` measured two
    different calendars — at UTC+7 they disagree for seven hours every day, so early-morning
    practice landed on a date the server thought was still tomorrow.

    The most recent event's offset is the best evidence of where the learner is; with no
    events at all there is no streak to date anyway, so UTC is a harmless fallback.
    """
    moment = now or datetime.now(timezone.utc)
    latest = max(
        (parsed for parsed in (_parsed(getattr(e, "occurred_at", None)) for e in events) if parsed),
        default=None,
    )
    return moment.astimezone(latest.tzinfo).date() if latest else moment.date()


def longest_run(days: set[date]) -> int:
    """Best run of consecutive days anywhere in the set."""
    longest = run = 0
    previous: date | None = None
    for day in sorted(days):
        run = run + 1 if previous and (day - previous).days == 1 else 1
        longest = max(longest, run)
        previous = day
    return longest


def current_run(days: set[date], today: date, grace_days: int = 1) -> int:
    """The run ending at the most recent active day, if that day is still recent enough.

    Counting back from the latest active day rather than from `today` is what keeps a streak
    visible — and savable — for the rest of a day the learner has not practised in yet.
    """
    if not days:
        return 0
    latest = max(days)
    if latest < today - timedelta(days=max(0, grace_days)):
        return 0
    count = 0
    cursor = latest
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count
