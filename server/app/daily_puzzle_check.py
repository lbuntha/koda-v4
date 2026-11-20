"""Whether a word can be a Word Guess puzzle — the server's copy of `src/puzzles/wordGuess.ts`.

The Studio checks as the author types; this is the check that counts, because a
draft is saved whatever the editor said, but nothing reaches a child's screen
unless it passes here.
"""

from __future__ import annotations

import re

from app.khmer_spelling import khmer_problem, normalize_khmer, spelling_units

MIN_TILES = 2
MAX_TILES = 6


def clean_word(word: str, lang: str) -> str:
    return normalize_khmer(word.strip()) if lang == "km" else word.strip().lower()


def tiles_of(word: str, lang: str) -> list[str]:
    return spelling_units(word) if lang == "km" else list(word.strip().lower())


def word_problem(word: str, lang: str) -> str | None:
    """Why a word cannot be a puzzle, as the same codes the app uses; None when it can."""
    w = clean_word(word, lang)
    if not w:
        return "empty"
    if lang == "km":
        if not all(0x1780 <= ord(ch) <= 0x17FF for ch in w):
            return "not_khmer"
        if khmer_problem(w):
            return "spelling"
    elif not re.fullmatch(r"[a-z]+", w):
        return "not_letters"
    n = len(tiles_of(w, lang))
    if n < MIN_TILES:
        return "too_short"
    if n > MAX_TILES:
        return "too_long"
    return None


PROBLEM_TEXT = {
    "empty": "Type a word.",
    "not_khmer": "Use Khmer letters only, with no spaces.",
    "not_letters": "Use the letters a to z only, with no spaces.",
    "spelling": "This Khmer spelling does not look right. Check the vowel and the feet.",
    "too_short": "A puzzle word needs at least 2 tiles.",
    "too_long": "A puzzle word can have at most 6 tiles.",
    "duplicate": "This word is already a puzzle.",
}
