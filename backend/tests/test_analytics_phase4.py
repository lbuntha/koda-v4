from datetime import date, timedelta

from types import SimpleNamespace

from app.features.analytics.service import _streak, _weekly_activity
from app.features.progression.service import state_out


def test_streak_counts_current_and_longest_runs():
    today = date.today()
    days = {
        today,
        today - timedelta(days=1),
        today - timedelta(days=2),
        today - timedelta(days=7),
        today - timedelta(days=8),
        today - timedelta(days=9),
        today - timedelta(days=10),
    }

    assert _streak(days) == (3, 4)


def test_streak_keeps_yesterday_run_current():
    today = date.today()
    days = {today - timedelta(days=1), today - timedelta(days=2)}

    assert _streak(days) == (2, 2)


def test_weekly_activity_returns_zero_filled_seven_day_series():
    today = date(2026, 7, 24)
    events = [
        SimpleNamespace(occurred_at="2026-07-24T03:00:00Z"),
        SimpleNamespace(occurred_at="2026-07-24T04:00:00Z"),
        SimpleNamespace(occurred_at="2026-07-20T03:00:00Z"),
        SimpleNamespace(occurred_at="2026-07-01T03:00:00Z"),
        SimpleNamespace(occurred_at="not-a-date"),
    ]

    output = _weekly_activity(events, today)

    assert len(output) == 7
    assert output[0] == {"date": "2026-07-18", "day": "S", "count": 0}
    assert output[2] == {"date": "2026-07-20", "day": "M", "count": 1}
    assert output[-1] == {"date": "2026-07-24", "day": "F", "count": 2}


def test_progress_skill_carries_analytics_filter_dimensions():
    output = state_out(
        None,
        curriculum_id="curriculum-1",
        skill_id="skill-1",
        label="Count on",
        unit_id="unit-1",
        subject_id="math",
        grade_id="grade-1",
        assignment_id="assignment-1",
        current_revision=1,
        config={"gates": {}},
    )

    assert output["subjectId"] == "math"
    assert output["gradeId"] == "grade-1"
    assert output["assignmentId"] == "assignment-1"
