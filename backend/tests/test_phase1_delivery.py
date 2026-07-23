from app.features.content.placement import select_delivery_skill_ids


TREE = {
    "grades": [{"id": "g1", "order": 1}],
    "subjects": [{"id": "math", "gradeId": "g1", "order": 1}],
    "units": [{"id": "unit", "subjectId": "math", "order": 1}],
    "skills": [
        {"id": "count", "unitId": "unit", "order": 1},
        {"id": "add", "unitId": "unit", "order": 2},
        {"id": "subtract", "unitId": "unit", "order": 3},
    ],
}


def test_delivery_starts_at_frontier_and_skips_unplayable_skill():
    selected = select_delivery_skill_ids(
        TREE,
        {"kind": "all", "ids": []},
        "add",
        ["count"],
        {"count", "subtract"},
    )
    assert selected == ["subtract"]


def test_delivery_uses_last_skill_as_confirmation_when_all_checkpoints_pass():
    selected = select_delivery_skill_ids(
        TREE,
        {"kind": "all", "ids": []},
        None,
        ["count", "add", "subtract"],
        {"count", "add", "subtract"},
    )
    assert selected == ["subtract"]


def test_delivery_respects_assignment_scope_without_progression():
    selected = select_delivery_skill_ids(
        TREE,
        {"kind": "skills", "ids": ["add", "subtract"]},
        None,
        [],
        {"count", "add", "subtract"},
    )
    assert selected == ["add"]
