from datetime import datetime, timedelta, timezone

from app.features.learning.recommendation import recommend


def assignment(assignment_id: str, priority: int = 100):
    return {
        "id": assignment_id,
        "release_id": f"release-{assignment_id}",
        "curriculum_id": f"curriculum-{assignment_id}",
        "priority": priority,
        "scope": {"kind": "all", "ids": []},
        "available_skill_ids": {"count", "add", "subtract"},
        "question_counts": {"count": 2, "add": 2, "subtract": 2},
        "tree": {
            "grades": [{"id": "g1", "order": 1}],
            "subjects": [{"id": "math", "gradeId": "g1", "order": 1}],
            "units": [{"id": "unit", "subjectId": "math", "order": 1}],
            "skills": [
                {"id": "count", "label": "Count", "unitId": "unit", "order": 1},
                {"id": "add", "label": "Add", "unitId": "unit", "order": 2, "prerequisiteSkillIds": ["count"]},
                {"id": "subtract", "label": "Subtract", "unitId": "unit", "order": 3, "prerequisiteSkillIds": ["add"]},
            ],
        },
    }


CONFIG = {"skills_per_session": 3, "max_non_new": 2, "reinforce_threshold": 0.6}


def test_frontier_and_prerequisites_choose_next_new_skill():
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count"]}],
        skipped_keys=set(),
        config=CONFIG,
    )
    assert [(item["kind"], item["skill_id"]) for item in result["served_items"]] == [("new", "add")]


def test_due_reinforcement_keeps_reserved_new_slot():
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[{
            "curriculum_id": "curriculum-a1", "skill_id": "count", "level": "beginner",
            "score": 0.4, "last_review_outcome": "unsuccessful", "next_review_at": now - timedelta(days=1),
        }],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count"]}],
        skipped_keys=set(),
        config=CONFIG,
        now=now,
    )
    served = [(item["kind"], item["skill_id"]) for item in result["served_items"]]
    assert ("reinforce", "count") in served
    assert ("new", "add") in served


def test_skip_cooldown_excludes_skill_and_surfaces_next_candidate():
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count", "add"]}],
        skipped_keys={("a1", "add")},
        config=CONFIG,
    )
    assert all(item["skill_id"] != "add" for item in result["served_items"])
    excluded = next(item for item in result["candidates"] if item["skill_id"] == "add")
    assert excluded["excluded"] == "skip_cooldown"


def test_completed_skill_is_excluded_for_the_current_session():
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[],
        progressions=[{
            "assignment_id": "a1",
            "frontier_skill_id": "add",
            "eligible_skill_ids": ["count"],
        }],
        skipped_keys=set(),
        completed_keys={("a1", "add")},
        config=CONFIG,
    )
    assert all(item["skill_id"] != "add" for item in result["served_items"])
    excluded = next(item for item in result["candidates"] if item["skill_id"] == "add")
    assert excluded["excluded"] == "completed_session"


def test_multiple_assignments_round_robin_by_priority():
    result = recommend(
        assignments=[assignment("a1", 10), assignment("a2", 20)],
        mastery_states=[],
        progressions=[
            {"assignment_id": "a1", "frontier_skill_id": "count", "eligible_skill_ids": []},
            {"assignment_id": "a2", "frontier_skill_id": "count", "eligible_skill_ids": []},
        ],
        skipped_keys=set(),
        config={**CONFIG, "skills_per_session": 2},
    )
    assert [item["assignment_id"] for item in result["served_items"]] == ["a1", "a2"]
