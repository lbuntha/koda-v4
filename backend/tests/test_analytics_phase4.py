from datetime import date, timedelta

from app.features.analytics.service import _streak
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
