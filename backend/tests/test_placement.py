from types import SimpleNamespace

from app.features.content.placement import build_placement, compute_placement
from app.features.placement.router import _placement_out


def _release():
    return {
        "tree": {
            "grades": [{"id": "g1", "order": 1}],
            "subjects": [{"id": "sub1", "gradeId": "g1", "order": 1}],
            "units": [{"id": "u1", "subjectId": "sub1", "order": 1}],
            "skills": [
                {"id": "s1", "unitId": "u1", "order": 1, "placementCheckpoint": True},
                {"id": "s2", "unitId": "u1", "order": 2, "placementCheckpoint": True},
            ],
        },
        "question_manifest": [
            {
                "question_id": "q1",
                "skill_id": "s1",
                "difficulty": "easy",
                "content_hash": "h1",
                "playable": {"id": "q1", "technique": "ONE_TO_ONE", "targetCount": 3, "title": "Count"},
                "grading": {"technique": "ONE_TO_ONE"},
            },
            {
                "question_id": "q2",
                "skill_id": "s1",
                "difficulty": "hard",
                "content_hash": "h2",
                "playable": {"id": "q2", "technique": "ONE_TO_ONE", "targetCount": 4, "title": "Count"},
                "grading": {"technique": "ONE_TO_ONE"},
            },
            {
                "question_id": "q3",
                "skill_id": "s2",
                "difficulty": "medium",
                "content_hash": "h3",
                "playable": {"id": "q3", "technique": "ADDITION_COLUMN", "config": {"num1": 2, "num2": 3}, "title": "Add"},
                "grading": {"technique": "ADDITION_COLUMN"},
            },
        ],
    }


def test_generator_is_deterministic_and_caps_each_skill():
    release = _release()
    config = {"checkpoints_only": True, "per_skill": 2, "checkpoint_cap": 8, "generator_revision": 1}
    first = build_placement(release, {"kind": "all", "ids": []}, config, "seed")
    second = build_placement(release, {"kind": "all", "ids": []}, config, "seed")
    assert first == second
    assert {item["question_id"] for item in first["item_manifest"]} == {"q1", "q2", "q3"}


def test_compute_placement_scores_by_skill_and_sets_frontier():
    release = _release()
    generated = build_placement(
        release,
        {"kind": "all", "ids": []},
        {"checkpoints_only": True, "per_skill": 2, "checkpoint_cap": 8},
        "seed",
    )
    result = compute_placement(
        [{"questionId": "q1", "selection": 3}, {"questionId": "q2", "selection": 4}, {"questionId": "q3", "selection": 2}],
        release,
        generated["item_manifest"],
        0.8,
    )
    assert result["score_by_skill"] == {"s1": 1.0, "s2": 0.0}
    assert result["frontier_skill_id"] == "s2"
    assert result["eligible_skill_ids"] == ["s1"]


def test_placement_payload_identifies_subject_and_sequence():
    placement = SimpleNamespace(
        id="placement-1",
        assignment_id="assignment-1",
        release_id="release-1",
        status="completed",
        frontier_skill_id="s1",
        eligible_skill_ids=["s1"],
        score_by_skill={"s1": 1.0},
        completed_at=None,
    )
    release = SimpleNamespace(tree={"subjects": [{"id": "reading", "label": "Reading"}]})
    assignment = SimpleNamespace(subject_id="reading")
    payload = _placement_out(placement, release, assignment, subject_position=2, subject_total=3)
    assert payload["subjectId"] == "reading"
    assert payload["subjectName"] == "Reading"
    assert payload["subjectPosition"] == 2
    assert payload["subjectTotal"] == 3
