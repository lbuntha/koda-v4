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


# ── Number path & place value lab (answer authored as targetCount) ───────────────

# Both canvases normalize their authored config before play — a "10 more" board derives its
# target as start + 10 whatever the author typed, and a count-forward board clamps the end to
# within nine of the start. Re-deriving that here would mean a second copy of the rules in a
# second language, and a child would be marked wrong the first time the two drifted.
#
# Both authoring paths already write the normalized answer to the question's `targetCount`:
# the AI schema does it in `validate()` and the studio panel does it on every edit, from the
# same normalizer the canvas plays with. That single value is what the child is asked for, so
# it is what the server grades against.
NUMERIC_TARGET = frozenset({"NUMBER_PATH", "PLACE_VALUE_LAB"})


@register(*NUMERIC_TARGET)
def grade_numeric_target(entry: dict, selection: Any) -> GradeOutcome:
    playable = _playable(entry)
    target = playable.get("targetCount")
    if target is None:
        target = _config(entry).get("targetCount")
    if target is None:
        raise GradingError(f"{_technique(entry)}: question has no targetCount to grade against")
    return "correct" if _to_int(selection) == _to_int(target) else "incorrect"


# ── Story problem mat (answer derived from the story) ────────────────────────────

@register("STORY_PROBLEM_MAT")
def grade_story_problem(entry: dict, selection: Any) -> GradeOutcome:
    """Derived from the story, because the story is what the child is answering.

    Unlike the two above there is no clamping to duplicate — `storyAnswer` is six branches of
    plain arithmetic — and which quantity is unknown changes the answer completely: the same
    three numbers ask for the total, the change, or the starting amount. Deriving keeps the
    grade tied to the story actually shown; `targetCount` is the fallback for a question
    authored before the fields existed.
    """
    config = _config(entry)
    story_type = config.get("storyProblemType")
    unknown = config.get("storyUnknown")
    first, second, third = (
        config.get("storyStart"),
        config.get("storyPart2", config.get("storyChange")),
        config.get("storyPart3"),
    )

    if story_type is None or first is None or second is None:
        target = _playable(entry).get("targetCount")
        if target is None:
            raise GradingError("STORY_PROBLEM_MAT: incomplete story and no targetCount")
        expected = _to_int(target)
    else:
        expected = _story_answer(story_type, unknown, _to_int(first), _to_int(second), third)

    return "correct" if _to_int(selection) == expected else "incorrect"


def _story_answer(story_type: str, unknown: Any, first: int, second: int, third: Any) -> int:
    """Mirrors `storyAnswer` in frontend/src/components/canvases/storyProblemModel.ts."""
    if story_type == "add_to":
        if unknown == "start":
            return first
        return second if unknown == "change" else first + second
    if story_type == "take_from":
        if unknown == "start":
            return first
        return second if unknown == "change" else first - second
    if story_type == "put_together":
        return second if unknown == "part" else first + second
    if story_type in ("take_apart", "compare"):
        return first - second
    if story_type == "three_addends":
        return first + second + (_to_int(third) if third is not None else 0)
    raise GradingError(f"STORY_PROBLEM_MAT: unknown story type {story_type!r}")


# ── Equation mat (derived from the equation) ─────────────────────────────────────

#: An Equation Mat `judge` verdict, carried as a number so every grader stays numeric.
#: Mirrors JUDGE_TRUE / JUDGE_FALSE in EquationMatCanvas.tsx.
JUDGE_TRUE = 1
JUDGE_FALSE = 0


@register("EQUATION_MAT")
def grade_equation_mat(entry: dict, selection: Any) -> GradeOutcome:
    """Which quantity is hidden decides the answer, so the equation is re-derived here.

    `8 + 3 = 11` asks for 11, 3, or 8 depending on whether the result, the second term or the
    first is hidden — from identical config. Grading the total every time would mark a correct
    missing-addend answer wrong, which is the entire skill this canvas exists for. Mirrors
    `equationAnswer` in frontend/src/components/canvases/EquationMatCanvas.tsx.

    `judge` hides nothing: the child answers True (1) or False (0) about the equation as
    written, so the grade compares the two sides rather than reading a term off the config.
    """
    config = _config(entry)
    unknown = config.get("equationUnknown", "result")
    first, second = config.get("equationFirst"), config.get("equationSecond")

    if first is None or second is None:
        target = _playable(entry).get("targetCount")
        if target is None:
            raise GradingError("EQUATION_MAT: incomplete equation and no targetCount")
        expected = _to_int(target)
    elif unknown == "first":
        expected = _to_int(first)
    elif unknown == "second":
        expected = _to_int(second)
    else:
        operation = config.get("equationOperation", "add")
        if operation not in ("add", "subtract"):
            raise GradingError(f"EQUATION_MAT: unknown operation {operation!r}")
        result = (_to_int(first) + _to_int(second)) if operation == "add" else (_to_int(first) - _to_int(second))
        if unknown == "judge":
            claim = _to_int(config.get("equationClaimFirst", 0)) + _to_int(config.get("equationClaimSecond", 0))
            expected = JUDGE_TRUE if result == claim else JUDGE_FALSE
        else:
            expected = result

    return "correct" if _to_int(selection) == expected else "incorrect"


# ── Grade 1 measurement, data, geometry and comparison ───────────────────────────
#
# All four derive their answer from the same config the canvas draws from, so a forged
# selection cannot pass and an authored typo cannot make a question ungradable.

@register("COMPARE_NUMBERS")
def grade_compare_numbers(entry: dict, selection: Any) -> GradeOutcome:
    """The answer is a symbol, not a number — >, < or =, derived from the two values."""
    config = _config(entry)
    first, second = config.get("compareFirst"), config.get("compareSecond")
    if first is None or second is None:
        raise GradingError("COMPARE_NUMBERS: needs compareFirst and compareSecond")
    first, second = _to_int(first), _to_int(second)
    expected = ">" if first > second else "<" if first < second else "="
    return "correct" if str(_norm(selection)) == expected else "incorrect"


@register("CLOCK_READ")
def grade_clock(entry: dict, selection: Any) -> GradeOutcome:
    """Compared as "H:MM" so "3:00" and "3:0" both read as three o'clock."""
    config = _config(entry)
    hour, minute = config.get("clockHour"), config.get("clockMinute")
    if hour is None:
        raise GradingError("CLOCK_READ: needs clockHour")
    expected = f"{_to_int(hour)}:{'30' if _to_int(minute or 0) == 30 else '00'}"
    submitted = str(_norm(selection))
    if ":" in submitted:
        left, _, right = submitted.partition(":")
        submitted = f"{_to_int(left)}:{'30' if _to_int(right) == 30 else '00'}"
    return "correct" if submitted == expected else "incorrect"


@register("MEASURE_LENGTH")
def grade_measure_length(entry: dict, selection: Any) -> GradeOutcome:
    """`measure` answers a unit count; the compare tasks answer a bar's 1-based position."""
    config = _config(entry)
    task = config.get("measureTask", "measure")
    lengths = config.get("measureLengths") or []
    if not lengths:
        raise GradingError("MEASURE_LENGTH: needs measureLengths")
    values = [_to_int(value) for value in lengths]
    if task == "measure":
        expected = values[0]
    elif task in ("longest", "shortest"):
        target = max(values) if task == "longest" else min(values)
        expected = values.index(target) + 1
    else:
        raise GradingError(f"MEASURE_LENGTH: unknown task {task!r}")
    return "correct" if _to_int(selection) == expected else "incorrect"


@register("DATA_CHART")
def grade_data_chart(entry: dict, selection: Any) -> GradeOutcome:
    config = _config(entry)
    kind = config.get("dataKind", "count")
    counts = [_to_int(value) for value in (config.get("dataCounts") or [])]
    if not counts:
        raise GradingError("DATA_CHART: needs dataCounts")
    focus = _to_int(config.get("dataFocus", 0))
    against = _to_int(config.get("dataAgainst", 1))
    if kind == "total":
        expected = sum(counts)
    elif kind == "more":
        expected = counts[focus] - counts[against]
    elif kind == "most":
        expected = counts.index(max(counts)) + 1
    elif kind == "count":
        expected = counts[focus]
    else:
        raise GradingError(f"DATA_CHART: unknown question kind {kind!r}")
    return "correct" if _to_int(selection) == expected else "incorrect"


SHAPE_SIDES = {"triangle": 3, "square": 4, "rectangle": 4, "pentagon": 5, "hexagon": 6, "circle": 0}
#: Which shape the target is composed of. The canvas also tracks how many pieces it takes
#: (2 triangles for a square, 6 for a hexagon) because the prompt says so; the answer is the
#: part's identity either way, which is all grading needs.
COMPOSED_FROM = {"square": "triangle", "rectangle": "square", "hexagon": "triangle"}
SHAPE_ORDER = ["triangle", "square", "rectangle", "pentagon", "hexagon", "circle"]


@register("SHAPE_LAB")
def grade_shape_lab(entry: dict, selection: Any) -> GradeOutcome:
    """Mirrors `shapeAnswer` in ShapeLabCanvas.tsx: sides and corners are counts, compose is a
    1-based index into the shape list, shares is the number of equal parts."""
    config = _config(entry)
    task = config.get("shapeTask", "sides")
    shape = config.get("shapeName", "triangle")
    if shape not in SHAPE_SIDES:
        raise GradingError(f"SHAPE_LAB: unknown shape {shape!r}")
    if task == "shares":
        expected = 4 if _to_int(config.get("shapeShares", 2)) == 4 else 2
    elif task == "compose":
        expected = SHAPE_ORDER.index(COMPOSED_FROM.get(shape, "triangle")) + 1
    elif task in ("sides", "corners"):
        expected = SHAPE_SIDES[shape]
    else:
        raise GradingError(f"SHAPE_LAB: unknown task {task!r}")
    return "correct" if _to_int(selection) == expected else "incorrect"


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
