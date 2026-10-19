"""Multiple-choice questions on the server: the same rules as `src/rebus/choice.ts`, tested against the same cases.

The author writes a question (pieces: words, pictures, photos), two to four
answers and says which one is right. The puzzle's `answer` is that option's
text, worked out here, so the answer a child must give and the answer on the
screen can never disagree.
"""

from __future__ import annotations

import unicodedata
from typing import Any

MIN_OPTIONS = 2
MAX_OPTIONS = 4
MAX_OPTION_CHARS = 40


def _key(text: str) -> str:
    """An option as it is compared: case, spacing and punctuation do not make two options different."""
    folded = unicodedata.normalize("NFC", str(text)).lower()
    # Letters, marks and numbers only: the marks matter, because they are what make one Khmer word another.
    return "".join(ch for ch in folded if unicodedata.category(ch)[0] in "LMN")


def problem(spec: Any) -> str | None:
    """What is wrong with these answers, as a code, or None when the question is sound."""
    if not isinstance(spec, dict) or not isinstance(spec.get("options"), list):
        return "choice-missing"
    options = spec["options"]
    if not MIN_OPTIONS <= len(options) <= MAX_OPTIONS:
        return "choice-options"
    if any(not isinstance(o, str) or not _key(o) for o in options) or any(len(o) > MAX_OPTION_CHARS for o in options):
        return "choice-blank"
    if len({_key(o) for o in options}) != len(options):
        return "choice-duplicate"
    correct = spec.get("correct")
    if isinstance(correct, bool) or not isinstance(correct, int) or not 0 <= correct < len(options):
        return "choice-correct"
    return None


def answer(spec: dict[str, Any]) -> str:
    return str(spec["options"][spec["correct"]]).strip()


def normalise(puzzle: dict[str, Any]) -> dict[str, Any]:
    """A multiple-choice puzzle with its answer worked out from the right option. Others are untouched."""
    spec = puzzle.get("choice")
    if puzzle.get("kind") != "choice" or problem(spec) is not None:
        return puzzle
    cleaned = {"options": [str(o).strip() for o in spec["options"]], "correct": spec["correct"]}
    return {**puzzle, "choice": cleaned, "answer": answer(cleaned), "accepts": []}
