from copy import deepcopy

import pytest
from fastapi import HTTPException

from app.features.content.router import (
    analyze_curriculum_impact,
    apply_delivery_impact,
    ensure_rollout_is_safe,
)


def curriculum_tree() -> dict:
    return {
        "grades": [{"id": "grade-1", "label": "Grade 1", "order": 1}],
        "subjects": [{"id": "math", "gradeId": "grade-1", "label": "Math", "order": 1}],
        "units": [{"id": "counting", "subjectId": "math", "label": "Counting", "order": 1}],
        "skills": [
            {
                "id": "count-10",
                "unitId": "counting",
                "label": "Count to 10",
                "order": 1,
                "prerequisiteSkillIds": [],
                "placementCheckpoint": True,
            }
        ],
    }


def test_copy_and_presentation_edits_are_patch_changes():
    before = curriculum_tree()
    after = deepcopy(before)
    after["skills"][0]["label"] = "Count objects to 10"
    after["skills"][0]["presentation"] = {"accent": "purple"}

    impact = analyze_curriculum_impact(before, after)

    assert impact["level"] == "patch"
    assert impact["structuralChanges"] == []


def test_adding_skills_is_a_minor_path_extension():
    before = curriculum_tree()
    after = deepcopy(before)
    after["skills"].append({
        "id": "count-20",
        "unitId": "counting",
        "label": "Count to 20",
        "order": 2,
        "prerequisiteSkillIds": ["count-10"],
    })

    impact = analyze_curriculum_impact(before, after)

    assert impact["level"] == "minor"
    assert impact["addedSkills"] == [{"id": "count-20", "label": "Count to 20"}]


def test_removing_a_skill_is_a_major_change():
    before = curriculum_tree()
    after = deepcopy(before)
    after["skills"] = []

    impact = analyze_curriculum_impact(before, after)

    assert impact["level"] == "major"
    assert impact["removedSkills"] == [{"id": "count-10", "label": "Count to 10"}]


def test_moving_or_resequencing_content_is_a_major_change():
    before = curriculum_tree()
    after = deepcopy(before)
    after["units"][0]["order"] = 2
    after["skills"][0]["placementCheckpoint"] = False

    impact = analyze_curriculum_impact(before, after)

    assert impact["level"] == "major"
    assert {item["id"] for item in impact["structuralChanges"]} == {"counting", "count-10"}


def test_first_publish_is_identified_separately():
    impact = analyze_curriculum_impact(None, curriculum_tree())

    assert impact["level"] == "initial"
    assert impact["addedSkills"] == [{"id": "count-10", "label": "Count to 10"}]


def test_losing_every_activity_for_a_skill_is_a_major_change():
    impact = analyze_curriculum_impact(curriculum_tree(), curriculum_tree())

    result = apply_delivery_impact(
        impact,
        [{"question_id": "q1", "skill_id": "count-10"}],
        [],
    )

    assert result["level"] == "major"
    assert result["structuralChanges"] == [
        {"id": "count-10", "label": "count-10", "fields": ["activities"]}
    ]


def test_major_rollout_cannot_move_active_learners():
    with pytest.raises(HTTPException) as error:
        ensure_rollout_is_safe("major", "active_learners")

    assert error.value.status_code == 409
    ensure_rollout_is_safe("major", "new_learners")
    ensure_rollout_is_safe("minor", "active_learners")
