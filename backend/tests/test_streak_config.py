"""The streak rule, as an admin-configurable policy.

The rule used to be hardcoded and counted *any* event, so opening an activity and leaving
kept a streak alive — attendance, next to labels that read as practice. It is now
`SystemSettings.scoring.streak`, and these pin what each setting actually changes.
"""

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.features.learning.streak import (
    current_run,
    longest_run,
    reference_today,
    streak_days,
)


TODAY = datetime.now(timezone.utc).date()


def event(offset_days: int, event_type: str = "attempt", verified: bool = True):
    """One event `offset_days` before today, carrying its own local timestamp."""
    when = datetime.now(timezone.utc) - timedelta(days=offset_days)
    return SimpleNamespace(
        occurred_at=when.isoformat(), event_type=event_type, verified=verified,
    )


def days(*offsets: int) -> set[date]:
    return {TODAY - timedelta(days=offset) for offset in offsets}


# ── counts ──────────────────────────────────────────────────────────────────────

def test_default_counts_answering_not_merely_opening():
    events = [event(0, "slide_view"), event(1, "attempt")]
    # A slide view is attendance; only the day with a real attempt counts.
    assert streak_days(events) == days(1)


def test_any_restores_the_old_attendance_behaviour():
    events = [event(0, "slide_view"), event(1, "recommendation_skipped")]
    assert streak_days(events, {"counts": "any"}) == days(0, 1)
    assert streak_days(events, {"counts": "attempt"}) == set()


def test_lesson_complete_requires_finishing_the_activity():
    events = [event(0, "attempt"), event(1, "lesson_complete")]
    assert streak_days(events, {"counts": "lesson_complete"}) == days(1)


def test_an_unverified_attempt_never_counts():
    """Unverifiable events stay out of authoritative reads (progression-design §7)."""
    assert streak_days([event(0, "attempt", verified=False)]) == set()


# ── min_events_per_day ──────────────────────────────────────────────────────────

def test_a_day_can_be_made_to_require_several_answers():
    events = [event(0), event(0), event(1)]
    assert streak_days(events, {"min_events_per_day": 2}) == days(0)
    assert streak_days(events, {"min_events_per_day": 1}) == days(0, 1)


# ── grace_days ──────────────────────────────────────────────────────────────────

def test_grace_decides_how_stale_the_last_active_day_may_be():
    yesterday_only = days(1, 2, 3)
    # Default: yesterday still counts, so the run is visible and still savable today.
    assert current_run(yesterday_only, TODAY, 1) == 3
    # No grace: the streak resets the moment today has no work in it.
    assert current_run(yesterday_only, TODAY, 0) == 0


def test_a_gap_restarts_the_run_rather_than_resuming_it():
    active = days(0, 2, 3, 4)
    assert current_run(active, TODAY, 1) == 1
    assert longest_run(active) == 3


def test_no_activity_is_zero_not_an_error():
    assert (current_run(set(), TODAY, 1), longest_run(set())) == (0, 0)
    assert streak_days([]) == set()


@pytest.mark.parametrize("bad", [0, -5])
def test_a_nonsense_minimum_still_needs_one_event(bad):
    assert streak_days([event(0)], {"min_events_per_day": bad}) == days(0)


# ── one rule, both surfaces ─────────────────────────────────────────────────────

def test_the_home_chip_and_the_achievement_share_one_day_rule():
    """`streakDays` (achievement) and the home chip used to disagree about a "day".

    The achievement counted any event and never reset; the chip counted any event with a
    grace window. Both now go through `streak_days`, so a config change moves them together.
    """
    events = [event(0, "slide_view"), event(1, "attempt"), event(2, "attempt")]

    practice = streak_days(events, {"counts": "attempt"})
    attendance = streak_days(events, {"counts": "any"})

    # The chip's current run and the achievement's longest run read the same day set...
    assert current_run(practice, TODAY, 1) == 2
    assert longest_run(practice) == 2
    # ...and both move when the admin widens the rule.
    assert longest_run(attendance) == 3
    assert current_run(attendance, TODAY, 1) == 3


# ── one clock ───────────────────────────────────────────────────────────────────

def test_today_is_taken_from_the_learners_own_offset():
    """A day boundary must be measured on one calendar, not two.

    Days come from `occurred_at`'s offset; "today" used to come from the server's UTC clock.
    At UTC+7 those disagree for seven hours: 06:30 local on the 28th is 23:30 UTC on the
    27th, so a learner's morning practice was dated a day ahead of the server's "today".
    """
    bangkok = timezone(timedelta(hours=7))
    moment = datetime(2026, 7, 28, 6, 30, tzinfo=bangkok)   # 2026-07-27 23:30 UTC
    learner = [SimpleNamespace(occurred_at=moment.isoformat(), event_type="attempt", verified=True)]

    assert reference_today(learner, moment) == date(2026, 7, 28)
    assert moment.astimezone(timezone.utc).date() == date(2026, 7, 27)   # what it used to use

    # The streak day and the reference day now agree, so the run is not off by one.
    days = streak_days(learner)
    assert days == {date(2026, 7, 28)}
    assert current_run(days, reference_today(learner, moment), 1) == 1


def test_no_events_dates_against_utc_without_failing():
    now = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)
    assert reference_today([], now) == date(2026, 7, 27)
