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


# ── Flexible ─────────────────────────────────────────────────────────────────────

def test_flexible_multichoice():
    e = _entry("FLEXIBLE_CANVAS", {"flexibleMode": "multichoice", "flexibleCorrectAnswer": "cat"})
    assert grade(e, "cat") == "correct"
    assert grade(e, "dog") == "incorrect"


def test_flexible_unsupported_mode_raises():
    e = _entry("FLEXIBLE_CANVAS", {"flexibleMode": "dragmatch"})
    with pytest.raises(GradingError, match="not implemented"):
        grade(e, [])


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
