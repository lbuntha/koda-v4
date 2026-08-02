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


# ── Liquid sort (solved-state check) ─────────────────────────────────────────────

@register("LIQUID_SORT")
def grade_liquid_sort(entry: dict, selection: Any) -> GradeOutcome:
    """Grade the bottles the learner ended with, not their claim to have solved it.

    The puzzle is solved when every bottle holds a single colour. That is checkable
    from the submitted state alone, but only against the colours the level actually
    started with — otherwise an empty board would grade as a perfect sort. So the
    authored layer counts travel with the release as the private `liquidSortLayers`
    key, and a submission has to account for every unit of every colour.

    `selection` is one list per bottle, each a list of colour keys bottom-to-top.
    """
    expected = _keys(entry).get("liquidSortLayers")
    if not isinstance(expected, dict) or not expected:
        raise GradingError("liquid sort question has no layer key")
    if not isinstance(selection, list) or not all(isinstance(bottle, list) for bottle in selection):
        raise GradingError("liquid sort selection must be a list of bottles")

    counts: dict[str, int] = {}
    for bottle in selection:
        for layer in bottle:
            key = _norm(layer)
            counts[key] = counts.get(key, 0) + 1

    # A board that no longer holds the level's liquid was not sorted — it was replaced.
    if counts != {_norm(colour): int(total) for colour, total in expected.items()}:
        return "incorrect"

    # A colour is done when it sits alone in one bottle. Checking "every bottle holds one
    # colour" is not enough: magenta split across two single-colour bottles passes that
    # test while the puzzle is plainly unsolved.
    done = 0
    for colour in counts:
        holding = [bottle for bottle in selection if any(_norm(layer) == colour for layer in bottle)]
        if len(holding) == 1 and len({_norm(layer) for layer in holding[0]}) == 1:
            done += 1
    if done == len(counts):
        return "correct"
    if done == 0:
        return "incorrect"
    return "partial"


# ── Goods sort (solved-state check) ──────────────────────────────────────────────

@register("GOODS_SORT")
def grade_goods_sort(entry: dict, selection: Any) -> GradeOutcome:
    """Grade the shelf the learner ended with, not their claim to have tidied it.

    The board is sorted when every compartment that holds anything is full and holds a
    single kind of goods. That is checkable from the submitted state alone, but only
    against the goods the level actually started with — otherwise an empty shelf would
    grade as a perfect sort. So the authored counts travel with the release as the
    private `goodsSortCounts` key, and a submission has to account for every item.

    `selection` is one list per compartment, each a list of goods type keys front to back.

    Same shape as `grade_liquid_sort`, deliberately: both games end in "every container
    holds one kind", and a child who half-sorts should read as `partial` in both.
    """
    expected = _keys(entry).get("goodsSortCounts")
    if not isinstance(expected, dict) or not expected:
        raise GradingError("goods sort question has no goods key")
    if not isinstance(selection, list) or not all(isinstance(shelf, list) for shelf in selection):
        raise GradingError("goods sort selection must be a list of compartments")

    counts: dict[str, int] = {}
    for shelf in selection:
        for item in shelf:
            key = _norm(item)
            counts[key] = counts.get(key, 0) + 1

    # A shelf that no longer holds the level's goods was not sorted — it was restocked.
    if counts != {_norm(typeKey): int(total) for typeKey, total in expected.items()}:
        return "incorrect"

    # A kind is done when it sits alone in one compartment. "Every compartment holds one
    # kind" is not enough: three donuts split across two compartments passes that test
    # while the board is plainly unsorted.
    done = 0
    for typeKey in counts:
        holding = [shelf for shelf in selection if any(_norm(item) == typeKey for item in shelf)]
        if len(holding) == 1 and len({_norm(item) for item in holding[0]}) == 1:
            done += 1
    if done == len(counts):
        return "correct"
    if done == 0:
        return "incorrect"
    return "partial"


# ── Counting crates (derived answer) ─────────────────────────────────────────────

CRATE_UNITS = (100, 10, 5, 1)


@register("COUNT_CRATES")
def grade_count_crates(entry: dict, selection: Any) -> GradeOutcome:
    """Re-add the tray the learner packed, and re-check the level's constraint.

    A *derived-answer* technique, in this module's own terms: everything needed to grade is
    already in the playable config, so nothing secret travels with the release and
    GRADING_KEY_FIELDS is untouched. The client having the same numbers does not matter —
    it does not have the authority, and a tray that does not add up cannot be talked into
    adding up.

    `selection` is the crate sizes in the tray, e.g. [10, 10, 1, 1, 1].
    """
    cfg = _config(entry)
    order = cfg.get("orderTotal")
    if order is None:
        order = _playable(entry).get("targetCount")
    if order is None:
        raise GradingError("counting crates question has no order total")
    order = _to_int(order)

    if not isinstance(selection, list):
        raise GradingError("counting crates selection must be a list of crate sizes")
    crates = [_to_int(item) for item in selection]
    if any(crate not in CRATE_UNITS for crate in crates):
        raise GradingError(f"counting crates selection has a crate size that does not exist: {crates}")

    total = sum(crates)
    if total != order:
        # Nothing partial about it: a tray is either the order or it is not.
        return "incorrect"

    # The crate count is a goal, not a gate — deliberately, and it was the other way round
    # first. Requiring an exact count meant a child who had counted correctly was marked
    # wrong for packing it differently, and an audit of the ladder found the taught
    # strategy failing two levels outright and a single first crate stranding three more.
    # Packing tightly earns a star in the client; it does not decide correctness here.
    return "correct"


def _fewest_crates(order: int, stock: dict, opens_allowed: int) -> int | None:
    """The fewest crates that can fill this order, given the shelf and the opening budget.

    Mirrors `fewestCrates` in countCratesModel.ts. Opening only ever turns one crate into
    several smaller ones, so it can never reduce the count — but it can be the only way to
    reach the total at all, which is why the budget is searched rather than ignored.
    """
    shelf = {int(unit): _to_int(count) for unit, count in stock.items()}
    opens_into = {100: (10, 10), 10: (1, 10), 5: (1, 5)}

    def openings(index: int, used: int, current: dict):
        units = list(opens_into)
        if index == len(units):
            yield current
            return
        unit = units[index]
        most = min(current.get(unit, 0), opens_allowed - used)
        for count in range(most + 1):
            nxt = dict(current)
            if count:
                into, per = opens_into[unit]
                nxt[unit] = nxt.get(unit, 0) - count
                nxt[into] = nxt.get(into, 0) + per * count
            yield from openings(index + 1, used + count, nxt)

    best: int | None = None
    for shelf_after in openings(0, 0, shelf):
        for a in range(min(shelf_after.get(100, 0), order // 100) + 1):
            for b in range(min(shelf_after.get(10, 0), (order - 100 * a) // 10) + 1):
                for c in range(min(shelf_after.get(5, 0), (order - 100 * a - 10 * b) // 5) + 1):
                    ones = order - 100 * a - 10 * b - 5 * c
                    if 0 <= ones <= shelf_after.get(1, 0):
                        count = a + b + c + ones
                        if best is None or count < best:
                            best = count
    return best


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
