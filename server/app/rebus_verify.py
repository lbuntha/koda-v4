"""Is a rebus puzzle fit to put in front of a child, and is this the answer?

The server's copy of `src/rebus/answer.ts` and `src/rebus/puzzle.ts`. The same
checks run in the maker's builder, in the Studio before a person reviews a
batch, and here before anything is approved or published, so a client that
skips them (or is out of date) cannot get a bad puzzle onto a child's screen.

Kept to the same shape and the same codes as the TypeScript, and the same test
cases are repeated in `tests/test_rebus_verify.py`, because two languages
drift silently otherwise.
"""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from app import rebus_choice, rebus_math
from app.ages import is_age_range

#: What a deployment starts with. The real list is data (`repos/rebus_categories.py`), passed to `validate_puzzle`.
BUILT_IN_CATEGORIES = frozenset({"countries", "food", "sayings", "animals", "sports", "school", "science", "khmer", "math"})
TRICKS = ("compound", "sound-alike", "position", "size", "style", "add-remove")
MAX_PIECES = 7
MIN_ANSWER_LETTERS = 3
MIN_EXPLANATION_CHARS = 8

_ARTICLES = re.compile(r"(^|\s)(a|an|the)(?=\s|$)")


@lru_cache(maxsize=1)
def icon_ids() -> frozenset[str]:
    """Every drawing the app has, from `rebus_icons.json` (written by `scripts/generate-rebus-icons.ts`)."""
    return frozenset(json.loads((Path(__file__).parent / "rebus_icons.json").read_text()))


def normalize_answer(text: str) -> str:
    """Lower-case, accents and punctuation gone, articles dropped, spaces single.

    Only Latin diacritics are stripped: the marks that make up a Khmer syllable
    sit elsewhere in Unicode and must survive.
    """
    t = unicodedata.normalize("NFD", text)
    t = re.sub(r"[̀-ͯ]", "", t)
    t = unicodedata.normalize("NFC", t).lower()
    t = re.sub(r"['’`]", "", t)
    t = "".join(ch if unicodedata.category(ch)[0] in "LMN" or ch.isspace() else " " for ch in t)
    t = _ARTICLES.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def compact_answer(text: str) -> str:
    return re.sub(r"\s", "", normalize_answer(text))


def edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        row = [i]
        for j, cb in enumerate(b, 1):
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = row
    return prev[-1]


def typo_allowance(length: int) -> int:
    """Nothing below 8 letters: on a short answer one changed letter is another word."""
    return 2 if length >= 14 else 1 if length >= 8 else 0


def matches(answer: str, accepts: list[str], typed: str, *, exact: bool = False) -> bool:
    """Is what was typed the answer? `exact` (multiple choice) allows no slipped key: one wrong option is not another."""
    got = compact_answer(typed)
    if not got:
        return False
    for candidate in [answer, *accepts]:
        target = compact_answer(candidate)
        if target and (got == target or (not exact and edit_distance(got, target) <= typo_allowance(len(target)))):
            return True
    return False


def answer_key(puzzle: dict[str, Any]) -> str:
    """What makes two puzzles the same one. A math question is its numbers, not its answer: many sums come to 13."""
    spec = puzzle.get("math")
    if puzzle.get("kind") == "math" and isinstance(spec, dict) and rebus_math.problem(spec) is None:
        return "math|" + rebus_math.prompt(spec)
    if puzzle.get("kind") == "choice":
        # The same answer under a different question is a different puzzle ("Paris" is the answer to many).
        asked = "".join(piece_names(puzzle.get("pieces") or []))
        return "choice|" + compact_answer(asked) + "|" + compact_answer(str(puzzle.get("answer", "")))
    return compact_answer(str(puzzle.get("answer", "")))


def _piece_name(piece: dict[str, Any]) -> str:
    kind = piece.get("kind")
    if kind in ("icon", "photo"):
        return str(piece.get("name", ""))
    if kind == "word":
        return str(piece.get("text", ""))
    if kind == "stack":
        return f"{piece.get('top', '')} over {piece.get('bottom', '')}"
    return ""


def piece_names(pieces: list[dict[str, Any]]) -> list[str]:
    """What the pictures and words read as, in order, without the signs between them."""
    return [name for p in pieces if p.get("kind") != "op" and (name := _piece_name(p))]


def _written_text(piece: dict[str, Any]) -> list[str]:
    if piece.get("kind") == "word":
        return [str(piece.get("text", ""))]
    if piece.get("kind") == "stack":
        top, bottom = str(piece.get("top", "")), str(piece.get("bottom", ""))
        return [top, bottom, top + bottom, bottom + top]
    return []


def _math_issues(puzzle: dict[str, Any]) -> list[str]:
    """What is wrong with a math question: its numbers, or its prompt and answer drifting from them."""
    spec = puzzle.get("math")
    if not isinstance(spec, dict):
        return ["math-missing"]
    wrong = rebus_math.problem(spec)
    if wrong:
        return [wrong]
    pieces = puzzle.get("pieces") or []
    in_step = (
        pieces == [{"kind": "word", "text": rebus_math.prompt(spec)}]
        and str(puzzle.get("answer", "")) == str(rebus_math.answer(spec))
        and not puzzle.get("accepts")
    )
    return [] if in_step else ["math-out-of-step"]


def _choice_issues(puzzle: dict[str, Any]) -> list[str]:
    """What is wrong with a multiple-choice question: its answers, or its answer drifting from the right one."""
    spec = puzzle.get("choice")
    wrong = rebus_choice.problem(spec)
    if wrong:
        return [wrong]
    in_step = str(puzzle.get("answer", "")) == rebus_choice.answer(spec) and not puzzle.get("accepts")
    return [] if in_step else ["choice-out-of-step"]


def validate_puzzle(
    puzzle: dict[str, Any], *, known_icons: frozenset[str] | None = None, known_photos: frozenset[str] | None = None,
    known_categories: frozenset[str] | None = None,
) -> list[str]:
    """The codes of everything wrong with a puzzle; empty means it can be reviewed."""
    issues: list[str] = []
    pieces: list[dict[str, Any]] = puzzle.get("pieces") or []

    if puzzle.get("category") not in (known_categories if known_categories is not None else BUILT_IN_CATEGORIES):
        issues.append("bad-category")
    if not is_age_range(puzzle.get("ages")):
        issues.append("bad-ages")
    if puzzle.get("difficulty") not in (1, 2, 3):
        issues.append("bad-difficulty")

    math_kind = puzzle.get("kind") == "math"
    choice_kind = puzzle.get("kind") == "choice"
    if math_kind:
        issues.extend(_math_issues(puzzle))
    if choice_kind:
        issues.extend(_choice_issues(puzzle))

    if not math_kind and not any(p.get("kind") != "op" for p in pieces):
        issues.append("no-picture")
    if len(pieces) > MAX_PIECES:
        issues.append("too-many-pieces")

    # An operator joins two things: it cannot start, end, or sit beside another.
    is_op = [p.get("kind") == "op" for p in pieces]
    if any(op and (i == 0 or i == len(is_op) - 1 or is_op[i - 1] or is_op[i + 1]) for i, op in enumerate(is_op)):
        issues.append("bad-operators")

    answer = compact_answer(str(puzzle.get("answer", "")))
    # A number is short by nature, and a math prompt is not a picture that could spell its answer.
    if not (math_kind or choice_kind) and len(answer) < MIN_ANSWER_LETTERS:
        issues.append("answer-short")

    every = {compact_answer(a) for a in [str(puzzle.get("answer", "")), *map(str, puzzle.get("accepts") or [])]}
    every.discard("")
    if not (math_kind or choice_kind) and any(compact_answer(t) in every for p in pieces for t in _written_text(p)):
        issues.append("answer-in-puzzle")

    if len(str(puzzle.get("explanation", "")).strip()) < MIN_EXPLANATION_CHARS:
        issues.append("no-explanation")

    icons = known_icons if known_icons is not None else icon_ids()
    if any(p.get("kind") == "icon" and p.get("id") not in icons for p in pieces):
        issues.append("unknown-icon")

    photos = [p for p in pieces if p.get("kind") == "photo"]
    if any(not str(p.get("name", "")).strip() for p in photos):
        issues.append("photo-no-name")
    # A photo that was never uploaded (or was cleaned away) would show as an empty frame to every child.
    if known_photos is not None and any(str(p.get("id", "")).removeprefix("photo-") not in known_photos for p in photos):
        issues.append("unknown-photo")

    return issues


#: What an author reads for each code, as `src/rebus/puzzle.ts` words them.
ISSUE_MESSAGES: dict[str, str] = {
    "bad-category": "Pick one of the categories.",
    "bad-ages": "Ages must be a whole-year range between 4 and 18.",
    "bad-difficulty": "Difficulty is 1, 2 or 3.",
    "no-picture": "Add at least one picture or word.",
    "too-many-pieces": f"Use at most {MAX_PIECES} pieces.",
    "bad-operators": "A + or & must sit between two pieces.",
    "answer-short": f"The answer needs at least {MIN_ANSWER_LETTERS} letters.",
    "answer-in-puzzle": "The answer is written in the puzzle. Show it with pictures instead.",
    "no-explanation": "Say why the pieces give that answer.",
    "unknown-icon": "A picture is not in the icon library.",
    "photo-no-name": "Say what each photo is read as.",
    "unknown-photo": "A photo was not uploaded. Upload it again.",
    "choice-missing": "A multiple-choice question needs its answers.",
    "choice-options": "Give two to four answers.",
    "choice-blank": "Every answer needs some text (up to 40 characters).",
    "choice-duplicate": "Two answers say the same thing. Make each one different.",
    "choice-correct": "Mark which answer is the right one.",
    "choice-out-of-step": "The answer does not match the answer you marked as right. Save it again.",
    "math-missing": "A math question needs its numbers.",
    "bad-math-numbers": "Use whole numbers from 0 to 9999.",
    "bad-math-op": "Pick +, −, × or ÷, and which part is missing.",
    "bad-math-result": "The sum must come out as a whole number from 0 to 9999 (division must be exact).",
    "bad-math-missing": "That sum has no single missing number. Use numbers other than 0.",
    "math-out-of-step": "The question and its answer do not match its numbers. Save it again.",
    "duplicate": "Another puzzle already has this answer.",
}


def describe(codes: list[str]) -> str:
    return " ".join(ISSUE_MESSAGES.get(code, code) for code in codes)
