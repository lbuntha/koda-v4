from app.features.settings.simulator import compare_mastery_states, delivery_impact


def _state(student: str, skill: str, level: str, score: float, due: int | None = None):
    return {
        "student_id": student,
        "curriculum_id": "math",
        "skill_id": skill,
        "level": level,
        "score": score,
        "next_review_at_ms": due,
    }


def test_simulator_counts_promotions_demotions_and_due_changes():
    current = [
        _state("s1", "count", "developing", 0.7),
        _state("s1", "add", "proficient", 0.9, 200),
        _state("s2", "subtract", "master", 0.95),
    ]
    proposed = [
        _state("s1", "count", "proficient", 0.86),
        _state("s1", "add", "proficient", 0.9, 50),
        _state("s2", "subtract", "developing", 0.7),
    ]

    result = compare_mastery_states(current, proposed, now_ms=100)

    assert result["affectedStudents"] == 2
    assert result["promotedSkills"] == 1
    assert result["demotedSkills"] == 1
    assert result["reviewDueChanged"] == 1


def test_delivery_impact_is_deterministic():
    current = {
        "recommendation": {"skills_per_session": 3, "max_non_new": 2, "skip_cooldown_sessions": 1},
        "placement": {"per_skill": 2, "checkpoint_cap": 8, "pass_threshold": 0.8},
    }
    proposed = {
        "recommendation": {"skills_per_session": 5, "max_non_new": 2, "skip_cooldown_sessions": 3},
        "placement": {"per_skill": 1, "checkpoint_cap": 10, "pass_threshold": 0.9},
    }

    result = delivery_impact(current, proposed)

    assert result["sessionPlan"]["proposed"] == {"skills": 5, "newSlots": 3, "reviewSlots": 2}
    assert result["placementMaximumItems"]["proposed"] == 10
