"""Unit tests for server-side grading (features/content/grading.py).

Pure logic, no database. Verifies each technique family grades a submitted
selection correctly against a release manifest entry, and that unknown
techniques fail loudly rather than guessing.
"""

import pytest

from app.features.content.grading import (
    GradingError,
    grade,
    supported_techniques,
)
from app.features.content.release import build_question_manifest, split_question


def _entry(technique, config):
    """A manifest entry the way build_question_manifest would produce it."""
    playable, grading = split_question({"id": "q", "technique": technique, "config": config})
    return {"question_id": "q", "playable": playable, "grading": grading}


# ── Counting ─────────────────────────────────────────────────────────────────────

def test_count_correct_and_incorrect():
    e = _entry("ONE_TO_ONE", {"targetCount": 7})
    assert grade(e, 7) == "correct"
    assert grade(e, "7") == "correct"        # numeric string selection
    assert grade(e, 6) == "incorrect"


def test_count_reads_real_top_level_target_count():
    manifest = build_question_manifest(
        [{
            "id": "q-count",
            "technique": "ONE_TO_ONE",
            "skillId": "s1",
            "targetCount": 7,
            "config": {"objectSpacing": 12},
        }],
        {"s1"},
    )
    assert grade(manifest[0], 7) == "correct"
    assert grade(manifest[0], 6) == "incorrect"


def test_count_on_derives_from_base_plus_extra():
    e = _entry("COUNT_ON", {"baseCount": 7, "extraCount": 3})
    assert grade(e, 10) == "correct"


def test_count_back_derives_from_total_minus_remove():
    e = _entry("COUNT_BACK", {"totalCount": 9, "removeCount": 4})
    assert grade(e, 5) == "correct"


# ── Arithmetic ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("technique,config,answer", [
    ("ADDITION_SANDBOX", {"addend1": 8, "addend2": 5}, 13),
    ("ADDITION_TUTOR", {"num1": 27, "num2": 15}, 42),
    ("ADDITION_COLUMN", {"num1": 27, "num2": 15}, 42),
    ("ADDITION_COLUMN_MULTI", {"num1": 10, "num2": 20, "num3": 3}, 33),
    ("SUBTRACTION_SANDBOX", {"minuend": 12, "subtrahend": 5}, 7),
    ("SUBTRACTION_COLUMN", {"minuend": 40, "subtrahend": 13}, 27),
    ("SUBTRACTION_COLUMN_MULTI", {"minuend": 20, "subtrahend": 5, "subtrahend2": 4}, 11),
    ("MULTIPLICATION_COLUMN", {"multiplicand": 6, "multiplier": 7}, 42),
    ("MULTIPLICATION_ARRAY", {"rows": 3, "cols": 4}, 12),
])
def test_arithmetic_expected(technique, config, answer):
    e = _entry(technique, config)
    assert grade(e, answer) == "correct"
    assert grade(e, answer + 1) == "incorrect"


def test_multiplication_array_falls_back_to_target_count():
    e = _entry("MULTIPLICATION_ARRAY", {"targetCount": 12})
    assert grade(e, 12) == "correct"


def test_arithmetic_fallback_reads_real_top_level_target_count():
    manifest = build_question_manifest(
        [{
            "id": "q-array",
            "technique": "MULTIPLICATION_ARRAY",
            "skillId": "s1",
            "targetCount": 12,
            "config": {},
        }],
        {"s1"},
    )
    assert grade(manifest[0], 12) == "correct"


def test_arithmetic_missing_operands_raises():
    e = _entry("ADDITION_COLUMN", {"num1": 5})  # num2 missing, no targetCount
    with pytest.raises(GradingError, match="missing operands"):
        grade(e, 5)


# ── Pattern (answer key stays server-side) ───────────────────────────────────────

def test_pattern_full_partial_incorrect():
    e = _entry("KODA_PATTERN", {"patternSequence": ["🍎", "🧁", "", ""], "patternAnswers": ["🍎", "🧁"]})
    # the answer key is private — never in the playable snapshot
    assert "patternAnswers" not in e["playable"]["config"]
    assert grade(e, ["🍎", "🧁"]) == "correct"
    assert grade(e, ["🍎", "🍎"]) == "partial"
    assert grade(e, ["🧁 ", " 🍎"]) == "incorrect"  # trimmed but both wrong positions


def test_pattern_single_legacy_answer():
    e = _entry("KODA_PATTERN", {"patternAnswer": "⭐️"})
    assert grade(e, "⭐️") == "correct"
    assert grade(e, ["⭐️"]) == "correct"


# ── Sudoku ───────────────────────────────────────────────────────────────────────

def test_sudoku_grid_compare():
    solution = [["1", "2"], ["2", "1"]]
    e = _entry("KODA_SUDOKU", {"sudokuSolution": solution})
    assert grade(e, [["1", "2"], ["2", "1"]]) == "correct"
    assert grade(e, [["1", "2"], ["2", "2"]]) == "partial"
    assert grade(e, [["2", "1"], ["1", "2"]]) == "incorrect"


# ── Liquid sort ──────────────────────────────────────────────────────────────────

def _sort_entry():
    return _entry("LIQUID_SORT", {"liquidSortLayers": {"cyan": 3, "magenta": 3}})


def test_liquid_sort_solved_board():
    e = _sort_entry()
    assert grade(e, [["cyan", "cyan", "cyan"], ["magenta", "magenta", "magenta"], []]) == "correct"
    # Which bottle holds which colour is not part of the puzzle.
    assert grade(e, [[], ["magenta", "magenta", "magenta"], ["cyan", "cyan", "cyan"]]) == "correct"


def test_liquid_sort_colour_split_across_bottles_is_not_solved():
    # Every bottle holds one colour here, yet magenta sits in two of them.
    e = _sort_entry()
    assert grade(e, [["cyan", "cyan", "cyan"], ["magenta", "magenta"], ["magenta"]]) == "partial"


def test_liquid_sort_untouched_board_is_incorrect():
    e = _sort_entry()
    assert grade(e, [["cyan", "cyan", "magenta"], ["magenta", "magenta", "cyan"], []]) == "incorrect"


def test_liquid_sort_rejects_a_board_that_lost_or_gained_liquid():
    e = _sort_entry()
    assert grade(e, [[], [], []]) == "incorrect"
    assert grade(e, [["cyan"] * 3, ["magenta"] * 3, ["gold"] * 3]) == "incorrect"
    assert grade(e, [["gold"] * 3, ["lime"] * 3, []]) == "incorrect"


def test_liquid_sort_requires_a_key_and_a_board():
    with pytest.raises(GradingError, match="no layer key"):
        grade(_entry("LIQUID_SORT", {}), [["cyan"]])
    with pytest.raises(GradingError, match="list of bottles"):
        grade(_sort_entry(), "level_1")


# ── Goods sort ───────────────────────────────────────────────────────────────────

def _goods_entry():
    return _entry("GOODS_SORT", {"goodsSortCounts": {"chips": 3, "cola": 3}})


def test_goods_sort_sorted_shelf():
    e = _goods_entry()
    # the counts are the answer key — never in the playable snapshot
    assert "goodsSortCounts" not in e["playable"]["config"]
    assert grade(e, [["chips", "chips", "chips"], ["cola", "cola", "cola"], []]) == "correct"
    # Which compartment holds which goods is not part of the puzzle.
    assert grade(e, [[], ["cola", "cola", "cola"], ["chips", "chips", "chips"]]) == "correct"


def test_goods_sort_kind_split_across_compartments_is_not_sorted():
    # Every compartment holds one kind here, yet cola sits in two of them.
    e = _goods_entry()
    assert grade(e, [["chips", "chips", "chips"], ["cola", "cola"], ["cola"]]) == "partial"


def test_goods_sort_untouched_shelf_is_incorrect():
    e = _goods_entry()
    assert grade(e, [["chips", "cola", "chips"], ["cola", "chips", "cola"], []]) == "incorrect"


def test_goods_sort_rejects_a_shelf_that_lost_or_gained_goods():
    e = _goods_entry()
    assert grade(e, [[], [], []]) == "incorrect"
    assert grade(e, [["chips"] * 3, ["cola"] * 3, ["milk"] * 3]) == "incorrect"
    assert grade(e, [["chips"] * 2, ["cola"] * 3]) == "incorrect"


def test_goods_sort_requires_a_key_and_a_shelf():
    with pytest.raises(GradingError, match="no goods key"):
        grade(_entry("GOODS_SORT", {}), [["chips"]])
    with pytest.raises(GradingError, match="list of compartments"):
        grade(_goods_entry(), "level_1")


# ── Counting crates ──────────────────────────────────────────────────────────────

def _crates_entry(**config):
    base = {"orderTotal": 23, "cratesStock": {"10": 3, "5": 2, "1": 9}, "cratesOpensAllowed": 0}
    return _entry("COUNT_CRATES", {**base, **config})


def test_count_crates_adds_the_tray_up():
    e = _crates_entry()
    assert grade(e, [10, 10, 1, 1, 1]) == "correct"
    assert grade(e, [10, 5, 5, 1, 1, 1]) == "correct"   # a longer way to the same number
    assert grade(e, [10, 10, 1, 1]) == "incorrect"      # 22
    assert grade(e, [10, 10, 5]) == "incorrect"         # 25


def test_count_crates_nothing_secret_travels_with_the_release():
    """A derived-answer technique: the config the client already has is what grades it, so
    there is no key to leak and GRADING_KEY_FIELDS stays untouched."""
    e = _crates_entry()
    assert e["playable"]["config"]["orderTotal"] == 23
    assert e["grading"]["keys"] == {}


def test_count_crates_never_marks_a_correct_count_wrong_for_its_packing():
    """The change that mattered most: the crate count is a goal, not a gate.

    It gated correctness first, and the ladder audit showed what that cost — the
    biggest-crate-first strategy the levels teach failed two of them outright, one opening
    permanently stranded two more, and on the hundred level any first crate but the hundred
    killed the board. A child who counts 23 has counted 23, however they packed it.
    """
    for constraint in ("none", "fewest", "exactly"):
        e = _crates_entry(cratesConstraint=constraint, cratesExactly=6)
        assert grade(e, [10, 10, 1, 1, 1]) == "correct", constraint
        assert grade(e, [10, 5, 5, 1, 1, 1]) == "correct", constraint
        # The total is still the whole of it.
        assert grade(e, [10, 10, 1, 1]) == "incorrect", constraint


def test_count_crates_rejects_crates_that_do_not_exist():
    with pytest.raises(GradingError, match="does not exist"):
        grade(_crates_entry(), [10, 10, 3])
    with pytest.raises(GradingError, match="list of crate sizes"):
        grade(_crates_entry(), 23)


# ── Flexible ─────────────────────────────────────────────────────────────────────

def test_flexible_multichoice():
    e = _entry("FLEXIBLE_CANVAS", {"flexibleMode": "multichoice", "flexibleCorrectAnswer": "cat"})
    assert grade(e, "cat") == "correct"
    assert grade(e, "dog") == "incorrect"


def test_flexible_tapcount_uses_curriculum_items():
    e = _entry("FLEXIBLE_CANVAS", {
        "flexibleMode": "tapcount",
        "flexibleItems": [{"id": "one"}, {"id": "two"}, {"id": "three"}],
    })
    assert grade(e, 3) == "correct"
    assert grade(e, 2) == "incorrect"


def test_flexible_dragmatch_uses_curriculum_target_mapping():
    e = _entry("FLEXIBLE_CANVAS", {
        "flexibleMode": "dragmatch",
        "flexibleItems": [
            {"id": "apple", "targetBin": "fruit"},
            {"id": "carrot", "targetBin": "vegetable"},
        ],
    })
    assert grade(e, {"apple": "fruit", "carrot": "vegetable"}) == "correct"
    assert grade(e, {"apple": "vegetable", "carrot": "fruit"}) == "incorrect"


# ── Registry ─────────────────────────────────────────────────────────────────────

def test_unknown_technique_raises_not_guesses():
    e = _entry("SOME_FUTURE_TECHNIQUE", {})
    with pytest.raises(GradingError, match="no grader registered"):
        grade(e, 1)


def test_supported_covers_the_core_families():
    supported = supported_techniques()
    for t in ("ONE_TO_ONE", "ADDITION_COLUMN", "KODA_PATTERN", "KODA_SUDOKU", "FLEXIBLE_CANVAS"):
        assert t in supported


def test_grade_reads_real_manifest_from_build_question_manifest():
    # end-to-end with the actual manifest builder, not a hand-made entry
    manifest = build_question_manifest(
        [{"id": "q1", "technique": "ADDITION_COLUMN", "skillId": "s1", "config": {"num1": 19, "num2": 6}}],
        {"s1"},
    )
    assert grade(manifest[0], 25) == "correct"
    assert grade(manifest[0], 24) == "incorrect"


# ── Number path & place value lab ────────────────────────────────────────────────
#
# These two grade against the question's `targetCount` rather than re-deriving from the
# authored config, because the canvases normalize before play: a "10 more" board's target
# is start + 10 whatever the author typed, and a count-forward board clamps the end to
# within nine of the start. Both authoring paths write that normalized answer to
# targetCount, so it is the number the child is actually asked for.


def _numeric_entry(technique, target, config=None):
    manifest = build_question_manifest(
        [{
            "id": "q-n", "technique": technique, "skillId": "s1",
            "targetCount": target, "config": config or {},
        }],
        {"s1"},
    )
    return manifest[0]


@pytest.mark.parametrize("technique", ["NUMBER_PATH", "PLACE_VALUE_LAB"])
def test_numeric_target_grades_against_the_normalized_answer(technique):
    entry = _numeric_entry(technique, 44)
    assert grade(entry, 44) == "correct"
    assert grade(entry, "44") == "correct"
    assert grade(entry, 45) == "incorrect"


def test_number_path_ignores_an_authored_end_that_the_canvas_would_override():
    """A "10 more" board asks for start + 10; whatever `numberChartEnd` says, the child sees
    44 and must be graded on 44."""
    entry = _numeric_entry(
        "NUMBER_PATH", 44,
        {"numberChartTask": "ten_more", "numberChartStart": 34, "numberChartEnd": 99},
    )
    assert grade(entry, 44) == "correct"
    assert grade(entry, 99) == "incorrect"


def test_numeric_target_without_a_target_fails_loudly():
    entry = {"question_id": "q", "playable": {"technique": "NUMBER_PATH", "config": {}}, "grading": {}}
    with pytest.raises(GradingError, match="targetCount"):
        grade(entry, 5)


# ── Story problem mat ────────────────────────────────────────────────────────────


def _story(**config):
    return _entry("STORY_PROBLEM_MAT", {"storyProblemType": "add_to", **config})


@pytest.mark.parametrize(
    "config,answer",
    [
        ({"storyProblemType": "add_to", "storyUnknown": "result", "storyStart": 5, "storyPart2": 4}, 9),
        ({"storyProblemType": "add_to", "storyUnknown": "change", "storyStart": 5, "storyPart2": 4}, 4),
        ({"storyProblemType": "add_to", "storyUnknown": "start", "storyStart": 5, "storyPart2": 4}, 5),
        ({"storyProblemType": "take_from", "storyUnknown": "result", "storyStart": 12, "storyPart2": 5}, 7),
        ({"storyProblemType": "take_from", "storyUnknown": "change", "storyStart": 12, "storyPart2": 5}, 5),
        ({"storyProblemType": "put_together", "storyUnknown": "result", "storyStart": 6, "storyPart2": 3}, 9),
        ({"storyProblemType": "put_together", "storyUnknown": "part", "storyStart": 6, "storyPart2": 3}, 3),
        ({"storyProblemType": "take_apart", "storyStart": 10, "storyPart2": 4}, 6),
        ({"storyProblemType": "compare", "storyStart": 12, "storyPart2": 5}, 7),
        ({"storyProblemType": "three_addends", "storyStart": 2, "storyPart2": 3, "storyPart3": 4}, 9),
    ],
)
def test_story_answer_depends_on_which_quantity_is_unknown(config, answer):
    """The same three numbers ask three different questions. Grading the total every time
    would mark a correct "how many arrived?" wrong."""
    entry = _entry("STORY_PROBLEM_MAT", config)
    assert grade(entry, answer) == "correct"
    assert grade(entry, answer + 1) == "incorrect"


def test_story_accepts_the_legacy_change_field():
    entry = _entry("STORY_PROBLEM_MAT", {
        "storyProblemType": "add_to", "storyUnknown": "result",
        "storyStart": 5, "storyChange": 4,
    })
    assert grade(entry, 9) == "correct"


def test_story_falls_back_to_target_count_when_the_story_is_incomplete():
    manifest = build_question_manifest(
        [{"id": "q-s", "technique": "STORY_PROBLEM_MAT", "skillId": "s1",
          "targetCount": 9, "config": {}}],
        {"s1"},
    )
    assert grade(manifest[0], 9) == "correct"
    assert grade(manifest[0], 8) == "incorrect"


def test_story_with_an_unknown_type_fails_loudly():
    entry = _entry("STORY_PROBLEM_MAT", {
        "storyProblemType": "teleporting", "storyStart": 5, "storyPart2": 4,
    })
    with pytest.raises(GradingError, match="unknown story type"):
        grade(entry, 9)


def test_every_picker_component_can_now_be_graded():
    """The three that blocked Grade 1 Maths: a release containing them used to be refused."""
    for technique in ("NUMBER_PATH", "PLACE_VALUE_LAB", "STORY_PROBLEM_MAT"):
        assert technique in supported_techniques()
