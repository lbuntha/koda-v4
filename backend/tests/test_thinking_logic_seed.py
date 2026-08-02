"""The shape of the Grade 1 Thinking & Logic subject, before it reaches a learner.

Two ladders share this subject, and the ways they can be wrongly combined are silent: a
learner still gets a playable board, just the wrong one, weeks into their path. Both
failures below shipped and were found by measuring, not by playing.

The seed is a script, so nothing else runs these rules. This file is what stands between
them and a re-seed.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.content.release import build_release_payload  # noqa: E402
from scripts import seed_grade1_thinking_logic as seed  # noqa: E402

TIER_RANK = seed.TIER_RANK


@pytest.fixture(scope="module")
def subject():
    liquid = seed.load_levels()
    goods = seed.load_goods_levels()
    tree = seed.logic_tree(liquid, goods)
    questions = seed.logic_questions(liquid) + seed.goods_questions(goods)
    return tree, questions, liquid, goods


def test_the_subject_publishes(subject):
    tree, questions, _, _ = subject
    payload = build_release_payload(tree=tree, questions=questions, assets=[])
    # Every question is server-gradeable, or build_release_payload would have refused.
    assert len(payload["question_manifest"]) == len(tree["skills"]) == len(questions)


def test_goods_answer_keys_never_reach_the_client(subject):
    tree, questions, _, _ = subject
    manifest = build_release_payload(tree=tree, questions=questions, assets=[])["question_manifest"]
    goods = [m for m in manifest if m["playable"]["technique"] == "GOODS_SORT"]
    assert goods
    for entry in goods:
        assert "goodsSortCounts" not in entry["playable"]["config"]
        assert entry["grading"]["keys"]["goodsSortCounts"]


def test_grade_1_only_gets_boards_inside_the_liquid_ladders_envelope(subject):
    """Liquid tops out at 32 units of liquid across 10 bottles — the hardest thing this
    subject asks of a Grade 1 learner. The goods ladder runs to 72 items across 20
    compartments, more than twice the objects, drawn at about 20px each on a 4x5 grid.
    Interleaving the ladders by tier only aligns them if the tiers mean comparable things.
    """
    _, _, _, goods = subject
    assert goods, "no goods levels survived the Grade 1 filter"
    for level in goods:
        assert level["items"] <= seed.GRADE1_MAX_ITEMS, level["id"]
        assert level["shelves"] <= seed.GRADE1_MAX_SHELVES, level["id"]


def test_the_two_ladders_interleave_rather_than_run_end_to_end(subject):
    """Appending one ladder after the other made a learner finish the ten-bottle
    grandmaster liquid board — the hardest in the subject — before being shown the
    two-kind goods shelf that is its gentlest. The frontier walks `order`, so `order` has
    to express difficulty across the whole subject rather than within one game.
    """
    tree, _, _, _ = subject
    ordered = sorted(tree["skills"], key=lambda skill: skill["order"])

    assert [skill["order"] for skill in ordered] == list(range(1, len(ordered) + 1))
    assert len({skill["id"] for skill in ordered}) == len(ordered)

    # Both games appear in the opening pair, and neither owns a long unbroken run early on.
    assert {skill["unitId"] for skill in ordered[:2]} == {seed.UNIT_SORT, seed.UNIT_GOODS}
    longest_run = run = 1
    for earlier, later in zip(ordered, ordered[1:]):
        run = run + 1 if later["unitId"] == earlier["unitId"] else 1
        longest_run = max(longest_run, run)
    assert longest_run <= 5, f"one game runs {longest_run} rungs unbroken"


def test_each_game_opens_with_a_placement_checkpoint_and_nothing_else_is_one(subject):
    """A quiz has to be able to see both games. Both checkpoints sit at the very start,
    where passing one can only mark the other's opener eligible — a checkpoint per tier let
    placement write eligibility deep in the ladder and skip a learner past most of it.
    """
    tree, _, _, _ = subject
    ordered = sorted(tree["skills"], key=lambda skill: skill["order"])
    checkpoints = [skill for skill in ordered if skill.get("placementCheckpoint")]

    assert {skill["unitId"] for skill in checkpoints} == {seed.UNIT_SORT, seed.UNIT_GOODS}
    assert len(checkpoints) == 2
    assert max(skill["order"] for skill in checkpoints) <= 2


def test_no_prerequisites_anywhere(subject):
    """A level is a single puzzle. The engine counts a prerequisite as met only once the
    earlier skill reaches *developing* (score >= 0.6 over 6+ plays), so a chain would mean
    replaying one board six times before the next could ever be offered — in practice
    nothing qualified as `new` and the stretch fallback served the *last* skill.
    """
    tree, _, _, _ = subject
    assert all(not skill["prerequisiteSkillIds"] for skill in tree["skills"])


def test_a_goods_activity_is_told_what_to_do_not_how_to_do_it_well(subject):
    """The strategy line was being used as the question instruction. It is an adult
    sentence and it is not an instruction; it still reaches the child on the canvas's coach
    line, which is where advice belongs.
    """
    _, questions, _, _ = subject
    goods = [q for q in questions if q["technique"] == "GOODS_SORT"]
    assert goods
    assert len({q["instruction"] for q in goods}) <= 2  # one wording, plus the 4-item note
    for question in goods:
        assert question["instruction"].startswith("Move the goods between compartments")


def test_estimated_minutes_come_from_the_board(subject):
    """A flat per-tier figure said the same number of minutes for boards needing 26 moves
    and 36. Minutes are sized from `moveFloor`, and have to stay inside a sitting.
    """
    tree, _, _, goods = subject
    by_id = {level["id"]: level for level in goods}
    minutes = {}
    for skill in tree["skills"]:
        if skill["unitId"] != seed.UNIT_GOODS:
            continue
        estimate = skill["presentation"]["estimatedMinutes"]
        assert 2 <= estimate <= 12, skill["id"]
        minutes[skill["id"]] = estimate

    # Harder boards take longer: the estimate has to track the floor, not sit flat.
    floors = {
        seed.goods_skill_id_for(level_id): level["moveFloor"]
        for level_id, level in by_id.items()
    }
    ranked = sorted(minutes, key=lambda skill_id: floors[skill_id])
    assert minutes[ranked[0]] < minutes[ranked[-1]]
