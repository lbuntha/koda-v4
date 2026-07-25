"""Server-side grading (Phase 0, item 2).

A client submits only its *selection* for a question; the server decides
correctness by grading that selection against the immutable release — it never
trusts a client-sent `correct` flag. Grading is technique-specific:

  * **Answer-key techniques** (pattern, sudoku, flexible) compare the selection to
    the private `grading.keys` that never left the server.
  * **Derived-answer techniques** (counting, arithmetic) recompute the expected
    answer from the release's own playable config and compare. The client has the
    same config, but not the authority — the server's recomputation is what counts.

One registry keyed by technique, one `grade(manifest_entry, selection)` contract.
Pure and database-free, so it is unit-testable with plain dicts. A technique with
no registered grader raises `GradingError` rather than guessing — adding coverage
is a new `@register(...)` here, the single place it's decided; no caller changes.
"""

from __future__ import annotations

from typing import Any, Callable, Literal

GradeOutcome = Literal["correct", "incorrect", "partial"]


class GradingError(ValueError):
    """A response cannot be graded — unknown technique, missing key, or malformed selection."""


# ── Technique identifiers (mirror CountingTechnique enum *values* in types.ts) ──

COUNTING = frozenset({
    "ONE_TO_ONE", "MOVE_AND_COUNT", "LINE_UP_AND_COUNT", "GROUP_IN_TENS",
    "COUNT_ON", "COUNT_BACK", "DIFFERENT_ARRANGEMENTS", "COUNT_MAGNETS", "SUBITIZE",
})

# technique -> (operation, ordered operand config fields). Field names verified
# against the canvases/panels that author them (e.g. column addition writes
# num1/num2; the subtraction sandbox writes minuend/subtrahend).
ARITHMETIC: dict[str, tuple[str, list[str]]] = {
    "ADDITION_SANDBOX": ("sum", ["addend1", "addend2"]),
    "ADDITION_TUTOR": ("sum", ["num1", "num2"]),
    "ADDITION_COLUMN": ("sum", ["num1", "num2"]),
    "ADDITION_COLUMN_MULTI": ("sum", ["num1", "num2", "num3"]),
    "SUBTRACTION_SANDBOX": ("diff", ["minuend", "subtrahend"]),
    "SUBTRACTION_COLUMN": ("diff", ["minuend", "subtrahend"]),
    "SUBTRACTION_COLUMN_MULTI": ("diff", ["minuend", "subtrahend", "subtrahend2"]),
    "MULTIPLICATION_COLUMN": ("product", ["multiplicand", "multiplier"]),
    "MULTIPLICATION_ARRAY": ("product", ["rows", "cols"]),
}


# ── Registry ────────────────────────────────────────────────────────────────────

_GRADERS: dict[str, Callable[[dict, Any], GradeOutcome]] = {}


def register(*techniques: str) -> Callable:
    def decorate(fn: Callable[[dict, Any], GradeOutcome]) -> Callable[[dict, Any], GradeOutcome]:
        for technique in techniques:
            _GRADERS[technique] = fn
        return fn
    return decorate


def supported_techniques() -> frozenset[str]:
    """Every technique the server can currently grade — the rest raise GradingError."""
    return frozenset(_GRADERS)


def grade(manifest_entry: dict, selection: Any) -> GradeOutcome:
    """Grade one submitted `selection` against a release question manifest entry.

    `manifest_entry` is a `build_question_manifest` row: `{playable, grading, ...}`.
    """
    technique = _technique(manifest_entry)
    grader = _GRADERS.get(technique)
    if grader is None:
        raise GradingError(f"no grader registered for technique {technique!r}")
    return grader(manifest_entry, selection)


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _technique(entry: dict) -> str | None:
    grading = entry.get("grading") or {}
    if grading.get("technique"):
        return grading["technique"]
    return (entry.get("playable") or {}).get("technique")


def _config(entry: dict) -> dict:
    return (entry.get("playable") or {}).get("config") or {}


def _playable(entry: dict) -> dict:
    return entry.get("playable") or {}


def _keys(entry: dict) -> dict:
    return (entry.get("grading") or {}).get("keys") or {}


def _to_int(value: Any) -> int:
    try:
        return int(str(value).strip())
    except (ValueError, TypeError, AttributeError):
        raise GradingError(f"expected a number, got {value!r}")


def _norm(value: Any) -> Any:
    """Comparison-normalize: trim strings, leave everything else as-is."""
    return value.strip() if isinstance(value, str) else value


# ── Counting ─────────────────────────────────────────────────────────────────────

@register(*COUNTING)
def grade_count(entry: dict, selection: Any) -> GradeOutcome:
    expected = _expected_count(_playable(entry), _config(entry))
    return "correct" if _to_int(selection) == expected else "incorrect"


def _expected_count(playable: dict, cfg: dict) -> int:
    """Resolve the authored target from the real question shape.

    `CountingQuestion.targetCount` is a top-level field. Older drafts placed it
    inside `config`, so releases support both shapes while preferring the current
    top-level value.
    """
    target_count = playable.get("targetCount")
    if target_count is None:
        target_count = cfg.get("targetCount")
    if target_count is not None:
        return _to_int(target_count)
    if cfg.get("baseCount") is not None and cfg.get("extraCount") is not None:
        return _to_int(cfg["baseCount"]) + _to_int(cfg["extraCount"])
    if cfg.get("totalCount") is not None and cfg.get("removeCount") is not None:
        return _to_int(cfg["totalCount"]) - _to_int(cfg["removeCount"])
    if cfg.get("totalCount") is not None:
        return _to_int(cfg["totalCount"])
    raise GradingError("counting question has no resolvable target count")


# ── Arithmetic ───────────────────────────────────────────────────────────────────

@register(*ARITHMETIC)
def grade_arithmetic(entry: dict, selection: Any) -> GradeOutcome:
    technique = _technique(entry)
    operation, fields = ARITHMETIC[technique]
    cfg = _config(entry)
    values = [cfg.get(field) for field in fields]

    if any(value is None for value in values):
        # Some authoring stores the derived answer on the question itself.
        target_count = _playable(entry).get("targetCount")
        if target_count is None:
            target_count = cfg.get("targetCount")
        if target_count is not None:
            expected = _to_int(target_count)
        else:
            raise GradingError(f"{technique}: missing operands {fields}")
    else:
        expected = _reduce(operation, [_to_int(v) for v in values])

    return "correct" if _to_int(selection) == expected else "incorrect"


def _reduce(operation: str, nums: list[int]) -> int:
    if operation == "sum":
        return sum(nums)
    if operation == "diff":
        result = nums[0]
        for n in nums[1:]:
            result -= n
        return result
    if operation == "product":
        result = 1
        for n in nums:
            result *= n
        return result
    raise GradingError(f"unknown arithmetic operation {operation!r}")


# ── Pattern (answer key) ─────────────────────────────────────────────────────────

@register("KODA_PATTERN")
def grade_pattern(entry: dict, selection: Any) -> GradeOutcome:
    keys = _keys(entry)
    answers = keys.get("patternAnswers")
    if answers is None:
        single = keys.get("patternAnswer")
        answers = [single] if single is not None else None
    if not answers:
        raise GradingError("pattern question has no answer key")

    picks = selection if isinstance(selection, list) else [selection]
    matches = sum(1 for a, p in zip(answers, picks) if _norm(a) == _norm(p))
    if matches == len(answers) and len(picks) >= len(answers):
        return "correct"
    if matches == 0:
        return "incorrect"
    return "partial"


# ── Sudoku (answer key) ──────────────────────────────────────────────────────────

@register("KODA_SUDOKU")
def grade_sudoku(entry: dict, selection: Any) -> GradeOutcome:
    solution = _keys(entry).get("sudokuSolution")
    if not solution:
        raise GradingError("sudoku question has no solution key")
    if not isinstance(selection, list):
        raise GradingError("sudoku selection must be a grid")

    total = correct = 0
    for r, row in enumerate(solution):
        for c, expected in enumerate(row):
            total += 1
            got = selection[r][c] if r < len(selection) and c < len(selection[r]) else None
            if _norm(got) == _norm(expected):
                correct += 1
    if total and correct == total:
        return "correct"
    if correct == 0:
        return "incorrect"
    return "partial"


# ── Flexible canvas (answer key) ─────────────────────────────────────────────────

@register("FLEXIBLE_CANVAS")
def grade_flexible(entry: dict, selection: Any) -> GradeOutcome:
    cfg = _config(entry)
    mode = cfg.get("flexibleMode", "multichoice")
    if mode in ("multichoice", "textinput"):
        key = _keys(entry).get("flexibleCorrectAnswer")
        if key is None:
            raise GradingError("flexible question has no correct answer key")
        return "correct" if _norm(selection) == _norm(key) else "incorrect"
    items = cfg.get("flexibleItems") or []
    if mode == "tapcount":
        return "correct" if _to_int(selection) == len(items) else "incorrect"
    if mode == "dragmatch":
        if not isinstance(selection, dict):
            raise GradingError("dragmatch selection must map item ids to target ids")
        expected = {
            str(item.get("id")): item.get("targetBin")
            for item in items
            if item.get("id") is not None and item.get("targetBin") is not None
        }
        actual = {str(key): value for key, value in selection.items()}
        return "correct" if actual == expected else "incorrect"
    raise GradingError(f"flexible mode {mode!r} grading is not supported")
