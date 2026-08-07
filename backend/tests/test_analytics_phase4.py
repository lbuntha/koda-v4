from datetime import date, timedelta

from types import SimpleNamespace

from app.features.analytics.service import _event_out, _skill_thumbnail_url, _thumbnail_ref_url, _weekly_activity
from app.features.learning.streak import current_run, longest_run
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

    assert (current_run(days, today), longest_run(days)) == (3, 4)


def test_streak_keeps_yesterday_run_current():
    today = date.today()
    days = {today - timedelta(days=1), today - timedelta(days=2)}

    assert (current_run(days, today), longest_run(days)) == (2, 2)


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


def test_skill_thumbnail_resolves_published_svg_asset():
    assert _skill_thumbnail_url(
        {"thumbnailAssetId": "count & compare"},
        "release/grade-1",
    ) == "/learning/assets/release%2Fgrade-1/count%20%26%20compare"


def test_skill_thumbnail_keeps_authored_url():
    assert _skill_thumbnail_url(
        {"thumbnailUrl": "/assets/counting.svg", "thumbnailAssetId": "ignored"},
        "release-1",
    ) == "/assets/counting.svg"


def test_snapshot_thumbnail_resolves_release_asset_reference():
    assert _thumbnail_ref_url(
        {"source": "component_override", "assetId": "custom art"},
        "release/1",
    ) == "/learning/assets/release%2F1/custom%20art"


def test_old_release_falls_back_to_component_catalog():
    assert _skill_thumbnail_url({}, "release-1", "ONE_TO_ONE") == "/assets/components/one-to-one.svg"


def test_event_uses_published_question_thumbnail_before_legacy_fallback():
    event = SimpleNamespace(
        id="mongo-event-1",
        client_id="event-1",
        session_id="session-1",
        release_id="release-1",
        question_id="question-1",
        curriculum_skill_id="skill-1",
        curriculum_id="curriculum-1",
        assignment_id="assignment-1",
        technique="ONE_TO_ONE",
        occurred_at="2026-08-07T00:00:00Z",
        received_at=None,
        event_type="attempt",
        outcome="correct",
        attempt_number=1,
        hint_used_before_attempt=False,
        time_on_task_ms=1000,
        slide_index=0,
        total_slides=1,
        verified=True,
    )
    output = _event_out(
        event,
        {"release-1": {"skills": [{
            "id": "skill-1",
            "presentation": {"thumbnailUrl": "/assets/legacy-skill.svg"},
        }]}},
        {("release-1", "question-1"): "/assets/published-question.svg"},
    )

    assert output["thumbnailUrl"] == "/assets/published-question.svg"


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
