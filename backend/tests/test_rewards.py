"""Pure tests for curriculum-authored quest and replayable XP rules."""

from types import SimpleNamespace

from app.features.learning.rewards import (
    achievement_profile,
    available_xp,
    calculate_xp,
    reward_config,
    skill_metadata,
)


def _event(**overrides):
    values = {
        "event_type": "attempt",
        "verified": True,
        "outcome": "correct",
        "release_id": "r1",
        "curriculum_id": "c1",
        "session_id": "session-1",
        "assignment_id": "assignment-1",
        "curriculum_skill_id": "skill-1",
        "question_id": "question-1",
        "attempt_number": 1,
        "hint_used_before_attempt": False,
        "client_timestamp_ms": 1,
        "occurred_at": "2026-07-25T01:00:00Z",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_reward_config_requires_admin_authored_xp_and_achievements():
    assert reward_config({})["quest"]["activitiesPerSession"] == 3
    assert reward_config({})["xp"] == {
        "correctAnswer": 0,
        "firstTryBonus": 0,
        "activityCompletion": 0,
    }
    assert reward_config({})["achievements"] == []
    authored = reward_config({
        "rewards": {
            "quest": {"label": "Math mission", "activitiesPerSession": 4},
            "xp": {"correctAnswer": 8, "firstTryBonus": 3, "activityCompletion": 15},
            "level": {"xpPerLevel": 80},
            "achievements": [{
                "id": "winner",
                "label": "Winner",
                "description": "Finish one activity.",
                "metric": "lessonsCompleted",
                "target": 1,
                "icon": "trophy",
                "accent": "amber",
            }],
        },
    })
    assert authored["xp"]["correctAnswer"] == 8
    assert authored["level"]["xpPerLevel"] == 80
    assert authored["achievements"][0]["id"] == "winner"


def test_available_xp_uses_skill_completion_override():
    tree = {
        "rewards": {"xp": {"correctAnswer": 4, "firstTryBonus": 3, "activityCompletion": 8}},
        "skills": [{"id": "skill-1", "label": "Count", "completionXp": 11}],
    }
    assert available_xp(tree, "skill-1", 2) == 25


def test_skill_metadata_preserves_library_thumbnail_reference():
    tree = {
        "skills": [{
            "id": "skill-1",
            "label": "Count",
            "presentation": {"thumbnailAssetId": "custom_svg_count"},
        }],
    }

    metadata = skill_metadata(tree, "skill-1")

    assert metadata["thumbnailAssetId"] == "custom_svg_count"
    assert metadata["thumbnailUrl"] is None


def test_calculate_xp_is_verified_deduplicated_and_explainable():
    tree = {
        "rewards": {"xp": {"correctAnswer": 4, "firstTryBonus": 3, "activityCompletion": 8}},
        "skills": [{"id": "skill-1", "label": "Count", "completionXp": 11}],
    }
    events = [
        _event(),
        _event(client_timestamp_ms=2),  # duplicate correct event earns nothing twice
        _event(question_id="question-2", attempt_number=2, client_timestamp_ms=3),
        _event(question_id="question-3", verified=False, client_timestamp_ms=4),
        _event(
            event_type="lesson_complete",
            outcome=None,
            question_id=None,
            attempt_number=None,
            hint_used_before_attempt=False,
            client_timestamp_ms=5,
        ),
    ]

    result = calculate_xp(events, {"r1": tree})

    assert result["totalXp"] == 22
    assert result["breakdown"] == [{
        "releaseId": "r1",
        "skillId": "skill-1",
        "correctXp": 8,
        "firstTryXp": 3,
        "completionXp": 11,
        "totalXp": 22,
    }]


def test_achievement_profile_uses_only_admin_rules_and_verified_metrics():
    tree = {
        "rewards": {
            "xp": {"correctAnswer": 4, "firstTryBonus": 3, "activityCompletion": 8},
            "level": {"xpPerLevel": 20},
            "achievements": [
                {
                    "id": "quick-start",
                    "label": "Quick Start",
                    "description": "One first-try answer.",
                    "metric": "firstTryCorrect",
                    "target": 1,
                    "icon": "star",
                    "accent": "purple",
                },
                {
                    "id": "two-wins",
                    "label": "Two Wins",
                    "description": "Complete two practices.",
                    "metric": "lessonsCompleted",
                    "target": 2,
                    "icon": "trophy",
                    "accent": "amber",
                },
                {
                    "id": "champ",
                    "label": "Champ",
                    "description": "Reach Proficient.",
                    "metric": "proficientSkills",
                    "target": 1,
                    "icon": "medal",
                    "accent": "green",
                },
            ],
        },
        "skills": [{"id": "skill-1", "label": "Count"}],
    }
    events = [
        _event(),
        _event(question_id="question-2", client_timestamp_ms=2),
        _event(
            event_type="lesson_complete",
            outcome=None,
            question_id=None,
            attempt_number=None,
            client_timestamp_ms=3,
        ),
        _event(question_id="ignored", verified=False, client_timestamp_ms=4),
    ]
    mastery = [SimpleNamespace(curriculum_id="c1", highest_earned_level="proficient")]

    profile = achievement_profile(events, {"r1": tree}, [("c1", tree)], mastery)

    assert profile["totalXp"] == 22
    assert profile["level"] == {
        "number": 2,
        "currentXp": 2,
        "xpPerLevel": 20,
        "xpToNext": 18,
        "progress": 0.1,
    }
    by_id = {row["id"]: row for row in profile["achievements"]}
    assert by_id["quick-start"]["earned"] is True
    assert by_id["two-wins"]["current"] == 1
    assert by_id["two-wins"]["progress"] == 0.5
    assert by_id["champ"]["earned"] is True
