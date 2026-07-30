from datetime import datetime, timedelta, timezone

from app.features.learning.path import (
    COMPLETED,
    IN_PROGRESS,
    NEW,
    OVERDUE,
    PENDING,
    build_path,
    grade_scope,
)


NOW = datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc)

TREE = {
    "grades": [
        {"id": "g1", "label": "Grade 1", "order": 1},
        {"id": "g2", "label": "Grade 2", "order": 2},
    ],
    "subjects": [
        {"id": "math1", "gradeId": "g1", "label": "Math", "order": 1},
        {"id": "math2", "gradeId": "g2", "label": "Math", "order": 1},
    ],
    "units": [
        # Deliberately declared out of order: the walk must use `order`, not array position.
        {"id": "u2", "subjectId": "math1", "label": "Addition", "order": 2},
        {"id": "u1", "subjectId": "math1", "label": "Counting", "order": 1,
         "presentation": {"icon": "hash", "accent": "green"}},
        {"id": "u3", "subjectId": "math2", "label": "Grade 2 work", "order": 1},
    ],
    "skills": [
        {"id": "count", "unitId": "u1", "label": "Count to 10", "order": 1},
        {"id": "subitize", "unitId": "u1", "label": "See numbers quickly", "order": 2,
         "prerequisiteSkillIds": ["count"]},
        {"id": "add", "unitId": "u2", "label": "Add within 10", "order": 1,
         "prerequisiteSkillIds": ["subitize"]},
        {"id": "g2skill", "unitId": "u3", "label": "Grade 2 skill", "order": 1},
    ],
}


def assignment(**over):
    return {
        "id": "a1",
        "release_id": "r1",
        "curriculum_id": "c1",
        "grade_id": "g1",
        "scope": {"kind": "all", "ids": []},
        "tree": TREE,
        "available_skill_ids": {"count", "subitize", "add", "g2skill"},
        **over,
    }


def mastery(skill_id, level, *, next_review_at=None, score=0.0):
    return {
        "curriculum_id": "c1", "skill_id": skill_id, "level": level,
        "score": score, "next_review_at": next_review_at,
    }


def statuses(result):
    return [(s["skillId"], s["status"]) for unit in result["units"] for s in unit["skills"]]


def test_the_walk_follows_curriculum_order_not_declaration_order():
    result = build_path(assignment=assignment(), mastery_states=[], progression=None, now=NOW)
    assert [unit["unitLabel"] for unit in result["units"]] == ["Counting", "Addition"]
    assert result["units"][0]["unitIcon"] == "hash"
    assert result["units"][0]["unitAccent"] == "green"
    assert [skill for skill, _ in statuses(result)] == ["count", "subitize", "add"]


def test_only_the_assigned_grade_is_walked():
    """A release can carry several grades; `scope={"kind":"all"}` must not mean all of them."""
    result = build_path(assignment=assignment(), mastery_states=[], progression=None, now=NOW)
    assert "g2skill" not in [skill for skill, _ in statuses(result)]

    grade_2 = build_path(assignment=assignment(grade_id="g2"), mastery_states=[], progression=None, now=NOW)
    assert [skill for skill, _ in statuses(grade_2)] == ["g2skill"]


def test_a_deliberate_narrower_scope_is_respected():
    scope = {"kind": "skills", "ids": ["add"]}
    assert grade_scope(TREE, scope, "g1") == scope
    assert grade_scope(TREE, {"kind": "all", "ids": []}, "g1") == {"kind": "grades", "ids": ["g1"]}


def test_every_state_is_derived_from_mastery_and_prerequisites():
    result = build_path(
        assignment=assignment(),
        mastery_states=[
            mastery("count", "master", score=0.95),
            mastery("subitize", "beginner", score=0.4, next_review_at=NOW - timedelta(days=1)),
        ],
        progression={"eligible_skill_ids": ["count"]},
        now=NOW,
    )
    assert statuses(result) == [
        ("count", COMPLETED),      # mastered
        ("subitize", OVERDUE),     # started, review date passed
        ("add", PENDING),          # prerequisite `subitize` is only at beginner
    ]
    assert result["counts"] == {
        "completed": 1, "overdue": 1, "inProgress": 1 - 1, "new": 0, "pending": 1, "total": 3,
    }


def test_started_but_not_due_is_in_progress_and_unlocks_nothing_until_developing():
    result = build_path(
        assignment=assignment(),
        mastery_states=[mastery("count", "master"), mastery("subitize", "beginner", score=0.7)],
        progression=None,
        now=NOW,
    )
    assert dict(statuses(result))["subitize"] == IN_PROGRESS
    assert dict(statuses(result))["add"] == PENDING


def test_developing_mastery_unlocks_the_next_skill():
    result = build_path(
        assignment=assignment(),
        mastery_states=[mastery("count", "master"), mastery("subitize", "developing", score=0.7)],
        progression=None,
        now=NOW,
    )
    assert dict(statuses(result))["add"] == NEW


def test_a_skill_placement_already_cleared_is_not_shown_as_locked():
    """Placement can pass a learner past a checkpoint without them doing the earlier skills.

    `add` requires `subitize`, which has no evidence at all — but placement marked `add`
    itself eligible, so calling it locked would contradict the checkpoint they passed.
    """
    result = build_path(
        assignment=assignment(),
        mastery_states=[],
        progression={"eligible_skill_ids": ["add"]},
        now=NOW,
    )
    listed = dict(statuses(result))
    assert listed["add"] == NEW
    assert listed["count"] == NEW         # needs no prerequisite at all
    # `subitize` still needs `count`, which has no evidence yet. Clearing one checkpoint does
    # not retroactively clear its neighbours — marking earlier skills eligible is
    # `compute_placement`'s decision to record, not something the path may infer.
    assert listed["subitize"] == PENDING


def test_next_card_is_the_first_skill_still_wanting_work():
    result = build_path(
        assignment=assignment(),
        mastery_states=[mastery("count", "master")],
        progression={"eligible_skill_ids": ["count"]},
        now=NOW,
    )
    # `count` is done, so the walk moves on to the next unfinished skill in order.
    assert result["nextSkill"]["skillId"] == "subitize"
    assert result["nextSkill"]["status"] == NEW


def test_a_finished_path_asks_for_nothing():
    result = build_path(
        assignment=assignment(),
        mastery_states=[mastery(s, "master") for s in ("count", "subitize", "add")],
        progression=None,
        now=NOW,
    )
    assert result["nextSkill"] is None
    assert result["counts"]["completed"] == 3


def test_an_unauthored_skill_stays_visible_but_does_not_block_the_road():
    """A skill with no published questions is an authoring gap, not a dead end.

    It cannot be played, so it can never be completed. Were it left blocking, every skill
    behind it would sit at `pending` forever and the learner would have nothing to do.
    """
    result = build_path(
        assignment=assignment(available_skill_ids={"subitize", "add"}),
        mastery_states=[],
        progression=None,
        now=NOW,
    )
    listed = dict(statuses(result))
    assert listed["count"] == NEW           # still shown, so the gap is visible
    assert listed["subitize"] == NEW        # not stranded behind it
    # ...but the unplayable one is never handed to a learner as their next card.
    assert result["nextSkill"]["skillId"] == "subitize"
