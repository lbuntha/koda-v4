from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.core.scoring_config import DEFAULT_SCORING_CONFIG
from app.features.progression.service import rank_out, state_out


def test_progress_contract_explains_next_level_and_due_state():
    state = SimpleNamespace(
        student_id="stu-1",
        curriculum_id="c1",
        skill_id="count",
        level="beginner",
        score=0.5,
        plays=2,
        sessions=1,
        distinct_days=1,
        hard_plays=0,
        next_review_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        scoring_revision=1,
        engine_revision="scoring-2",
        components={},
        recent_score=0.5,
        last_practiced_at="2026-07-24T00:00:00Z",
        highest_earned_level="beginner",
        promoted_at=None,
    )
    output = state_out(
        state,
        curriculum_id="c1",
        skill_id="count",
        label="Count to 10",
        unit_id="u1",
        subject_id="math",
        current_revision=1,
        config=DEFAULT_SCORING_CONFIG,
    )
    assert output["level"] == "beginner"
    assert output["nextLevel"] == "developing"
    assert "4 more strong tries" in output["toNextLevel"]
    assert output["isDue"] is True
    assert output["projectionStatus"] == "current"


def test_progress_contract_accepts_mongo_naive_review_datetime():
    state = SimpleNamespace(
        level="beginner",
        score=1.0,
        plays=1,
        sessions=1,
        distinct_days=1,
        hard_plays=0,
        next_review_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1),
        scoring_revision=1,
        engine_revision="scoring-2",
        components={},
        recent_score=1.0,
        last_practiced_at="2026-07-24T00:00:00Z",
        highest_earned_level="beginner",
        promoted_at=None,
    )
    output = state_out(
        state,
        curriculum_id="c1",
        skill_id="count",
        label="Count",
        unit_id=None,
        subject_id=None,
        current_revision=1,
        config=DEFAULT_SCORING_CONFIG,
    )
    assert output["isDue"] is True


def test_rank_rollup_matches_proficient_share_boundaries():
    skills = [
        {"level": "master"},
        {"level": "proficient"},
        {"level": "beginner"},
        {"level": "not_started"},
    ]
    rank = rank_out(skills)
    assert rank["totalSkills"] == 3
    assert rank["assignedSkills"] == 4
    assert rank["mastered"] == 1
    assert rank["proficientPlus"] == 2
    assert rank["tier"] == "gold"
