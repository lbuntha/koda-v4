"""Unit tests for the immutable release core (features/content/release.py).

Pure logic, no database — this is the Phase 0 slice that makes every later
decision reproducible: content hashing, answer-key separation, and structural
validation (foreign keys, prerequisite DAG, checkpoint flags).
"""

import pytest

from app.features.content.grading import supported_techniques
from app.features.content.release import (
    GRADING_KEY_FIELDS,
    ReleaseValidationError,
    build_release_payload,
    content_hash,
    normalize_difficulty,
    split_question,
    validate_prerequisites,
)


# ── Fixtures ────────────────────────────────────────────────────────────────────

def _skill(skill_id, unit_id="u1", order=1, prereqs=None, checkpoint=None):
    s = {"id": skill_id, "unitId": unit_id, "label": skill_id, "order": order}
    if prereqs is not None:
        s["prerequisiteSkillIds"] = prereqs
    if checkpoint is not None:
        s["placementCheckpoint"] = checkpoint
    return s


def _tree(skills):
    return {
        "grades": [{"id": "g1"}],
        "subjects": [{"id": "g1-math", "gradeId": "g1"}],
        "units": [{"id": "u1", "subjectId": "g1-math"}],
        "skills": skills,
    }


def _question(qid, skill_id, **config):
    return {"id": qid, "technique": "ONE_TO_ONE", "skillId": skill_id, "config": config}


# ── content_hash ────────────────────────────────────────────────────────────────

def test_content_hash_is_stable_and_key_order_independent():
    a = content_hash({"x": 1, "y": [1, 2, 3]})
    b = content_hash({"y": [1, 2, 3], "x": 1})
    assert a == b
    assert a.startswith("sha256:")


def test_content_hash_changes_with_content():
    assert content_hash({"x": 1}) != content_hash({"x": 2})


# ── split_question: answer keys stay private ────────────────────────────────────

def test_split_moves_answer_keys_out_of_playable():
    q = _question(
        "q1", "count-10",
        targetCount=7,               # a problem parameter — stays playable
        patternAnswers=["🍎", "🧁"],  # an answer key — must be private
        flexibleCorrectAnswer="cat",
    )
    playable, grading = split_question(q)

    # playable keeps the renderable parameter, loses every answer key
    assert playable["config"]["targetCount"] == 7
    assert "patternAnswers" not in playable["config"]
    assert "flexibleCorrectAnswer" not in playable["config"]

    # grading holds exactly the keys, tagged with id + technique for a grader
    assert grading["questionId"] == "q1"
    assert grading["technique"] == "ONE_TO_ONE"
    assert grading["keys"] == {"patternAnswers": ["🍎", "🧁"], "flexibleCorrectAnswer": "cat"}


def test_grading_key_fields_are_all_stripped():
    cfg = {field: "secret" for field in GRADING_KEY_FIELDS}
    cfg["targetCount"] = 5
    playable, grading = split_question(_question("q1", "s1", **cfg))
    assert set(playable["config"].keys()) == {"targetCount"}
    assert set(grading["keys"].keys()) == set(GRADING_KEY_FIELDS)


# ── normalize_difficulty ────────────────────────────────────────────────────────

def test_difficulty_prefers_top_level_then_config_then_default():
    assert normalize_difficulty({"difficulty": "hard"}) == "hard"
    assert normalize_difficulty({"config": {"difficulty": "easy"}}) == "easy"
    assert normalize_difficulty({}) == "medium"


def test_difficulty_rejects_unknown_bands():
    assert normalize_difficulty({"difficulty": "spicy"}) == "medium"


# ── prerequisite validation ─────────────────────────────────────────────────────

def test_prerequisites_valid_dag_passes():
    tree = _tree([
        _skill("a"),
        _skill("b", prereqs=["a"]),
        _skill("c", prereqs=["a", "b"]),
    ])
    validate_prerequisites(tree)  # no raise


def test_prerequisite_missing_reference_rejected():
    tree = _tree([_skill("b", prereqs=["ghost"])])
    with pytest.raises(ReleaseValidationError, match="missing prerequisite"):
        validate_prerequisites(tree)


def test_prerequisite_self_reference_rejected():
    tree = _tree([_skill("a", prereqs=["a"])])
    with pytest.raises(ReleaseValidationError, match="itself"):
        validate_prerequisites(tree)


def test_prerequisite_cycle_rejected():
    tree = _tree([
        _skill("a", prereqs=["c"]),
        _skill("b", prereqs=["a"]),
        _skill("c", prereqs=["b"]),
    ])
    with pytest.raises(ReleaseValidationError, match="cycle"):
        validate_prerequisites(tree)


# ── build_release_payload ────────────────────────────────────────────────────────

def test_build_release_payload_produces_manifests_and_hashes():
    tree = _tree([_skill("count-10", checkpoint=True), _skill("count-20", prereqs=["count-10"])])
    questions = [
        _question("q1", "count-10", targetCount=6, patternAnswers=["🍎"]),
        _question("q2", "count-20", targetCount=15),
        _question("q3", "not-in-tree", targetCount=3),  # excluded — skill not in curriculum
    ]
    payload = build_release_payload(tree=tree, questions=questions, assets=[{"id": "svg1"}])

    qids = [m["question_id"] for m in payload["question_manifest"]]
    assert qids == ["q1", "q2"]                      # q3 dropped
    assert "patternAnswers" not in payload["question_manifest"][0]["playable"]["config"]
    assert payload["question_manifest"][0]["grading"]["keys"] == {"patternAnswers": ["🍎"]}
    assert all(m["content_hash"].startswith("sha256:") for m in payload["question_manifest"])
    assert set(payload["content_hashes"]) == {"tree", "questions", "assets"}
    assert len(payload["asset_manifest"]) == 1


def test_build_release_payload_rejects_a_technique_no_grader_can_score():
    """Publishing is the last point where this is an author's problem rather than a
    child's: an ungraded question yields unverified attempts, and progression and XP
    both skip those, so the activity can never complete."""
    tree = _tree([_skill("s1")])
    questions = [{"id": "q1", "technique": "A_TECHNIQUE_WITH_NO_GRADER", "skillId": "s1", "config": {}}]
    with pytest.raises(ReleaseValidationError, match="no server-side grader"):
        build_release_payload(tree=tree, questions=questions)


def test_build_release_payload_accepts_every_registered_technique():
    """Guards the gate itself: it must key off the grader registry, never a literal
    list, so techniques added later pass without editing release.py."""
    tree = _tree([_skill("s1")])
    for technique in supported_techniques():
        questions = [{"id": "q1", "technique": technique, "skillId": "s1", "config": {}}]
        payload = build_release_payload(tree=tree, questions=questions)
        assert payload["question_manifest"][0]["playable"]["technique"] == technique


def test_build_release_payload_rejects_bad_prerequisites():
    tree = _tree([_skill("a", prereqs=["a"])])
    with pytest.raises(ReleaseValidationError):
        build_release_payload(tree=tree, questions=[])


def test_build_release_payload_is_deterministic():
    tree = _tree([_skill("s1")])
    questions = [_question("q1", "s1", targetCount=4)]
    first = build_release_payload(tree=tree, questions=questions)
    second = build_release_payload(tree=tree, questions=questions)
    assert first["content_hashes"] == second["content_hashes"]


def test_build_release_payload_keeps_selected_thumbnail_asset_in_snapshot():
    skill = _skill("s1")
    skill["presentation"] = {"thumbnailAssetId": "custom_svg_thumbnail"}
    asset = {
        "id": "custom_svg_thumbnail",
        "label": "Counting thumbnail",
        "markup": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
        "scale": 1,
    }

    payload = build_release_payload(tree=_tree([skill]), questions=[], assets=[asset])

    assert payload["tree"]["skills"][0]["presentation"]["thumbnailAssetId"] == asset["id"]
    assert payload["asset_manifest"][0]["snapshot"] == asset


def test_build_release_payload_rejects_missing_thumbnail_asset():
    skill = _skill("s1")
    skill["presentation"] = {"thumbnailAssetId": "missing"}

    with pytest.raises(ReleaseValidationError, match="thumbnail asset.*is missing"):
        build_release_payload(tree=_tree([skill]), questions=[], assets=[])


@pytest.mark.parametrize(
    "rewards",
    [
        {"quest": {"activitiesPerSession": 0}},
        {"quest": {"activitiesPerSession": 6}},
        {"xp": {"correctAnswer": -1}},
        {"xp": {"firstTryBonus": 101}},
        {"xp": {"activityCompletion": 1.5}},
        {"level": {"xpPerLevel": 0}},
        {"achievements": [{"id": "bad", "label": "Bad", "description": "Bad", "metric": "madeUp", "target": 1, "icon": "star", "accent": "purple"}]},
    ],
)
def test_build_release_payload_rejects_invalid_reward_configuration(rewards):
    tree = _tree([_skill("s1")])
    tree["rewards"] = rewards
    with pytest.raises(ReleaseValidationError):
        build_release_payload(tree=tree, questions=[])


def test_build_release_payload_rejects_invalid_skill_completion_xp():
    skill = _skill("s1")
    skill["completionXp"] = 101
    with pytest.raises(ReleaseValidationError, match="completionXp"):
        build_release_payload(tree=_tree([skill]), questions=[])
