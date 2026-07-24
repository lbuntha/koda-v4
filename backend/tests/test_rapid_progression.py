from app.features.learning.progression import advance_frontier


TREE = {
    "grades": [{"id": "g", "order": 1}],
    "subjects": [{"id": "sub", "gradeId": "g", "order": 1}],
    "units": [{"id": "unit", "subjectId": "sub", "order": 1}],
    "skills": [
        {"id": "count", "unitId": "unit", "order": 1},
        {"id": "add", "unitId": "unit", "order": 2, "prerequisiteSkillIds": ["count"]},
        {"id": "subtract", "unitId": "unit", "order": 3, "prerequisiteSkillIds": ["add"]},
    ],
}


def test_confirmation_advances_frontier_without_mastery_output():
    result = advance_frontier(
        tree=TREE,
        scope={"kind": "all", "ids": []},
        frontier_skill_id="add",
        eligible_skill_ids=["count"],
        confirmed_skill_id="add",
    )
    assert result == {
        "changed": True,
        "frontier_skill_id": "subtract",
        "eligible_skill_ids": ["count", "add"],
    }


def test_confirmation_does_not_jump_a_non_frontier_skill():
    result = advance_frontier(
        tree=TREE,
        scope={"kind": "all", "ids": []},
        frontier_skill_id="add",
        eligible_skill_ids=["count"],
        confirmed_skill_id="count",
    )
    assert result["changed"] is False
    assert result["frontier_skill_id"] == "add"
