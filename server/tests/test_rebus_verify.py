"""The server's copy of the answer and puzzle checks, on the same cases as the TypeScript tests."""

import json
from pathlib import Path

import pytest

from app import rebus_verify as v

ICONS = frozenset({"rebus-honey", "rebus-moon", "rebus-dog", "rebus-fire"})


def puzzle(**over):
    base = {
        "category": "food",
        "ages": [6, 12],
        "difficulty": 1,
        "pieces": [
            {"kind": "icon", "id": "rebus-honey", "name": "honey"},
            {"kind": "op", "op": "+"},
            {"kind": "icon", "id": "rebus-moon", "name": "moon"},
        ],
        "answer": "Honeymoon",
        "accepts": [],
        "explanation": "honey + moon = honeymoon.",
    }
    return {**base, **over}


def codes(p):
    return v.validate_puzzle(p, known_icons=ICONS)


def test_normalising_ignores_case_accents_apostrophes_punctuation_and_articles():
    assert v.normalize_answer("  The  Café!  ") == "cafe"
    assert v.normalize_answer("It's raining, cats & dogs") == "its raining cats dogs"
    assert v.normalize_answer("A piece of cake") == "piece of cake"


def test_khmer_is_left_alone():
    assert v.normalize_answer("ព្រះអាទិត្យ") == "ព្រះអាទិត្យ"


def test_a_word_with_and_without_its_space_is_the_same():
    assert v.compact_answer("hot dog") == v.compact_answer("hotdog")


def test_typos_are_forgiven_only_on_long_answers():
    assert [v.typo_allowance(n) for n in (3, 5, 6, 7, 8, 13, 14, 20)] == [0, 0, 0, 0, 1, 1, 2, 2]
    assert v.matches("Honeymoon", [], "honeymon")
    assert not v.matches("Hot dog", [], "hat dog")
    assert not v.matches("Spain", [], "spail")
    assert v.matches("Slice of cake", ["piece of cake"], "Piece of cake")
    assert not v.matches("Hot dog", [], "   !? ")


def test_a_good_puzzle_passes():
    assert codes(puzzle()) == []


@pytest.mark.parametrize(
    "over,code",
    [
        ({"category": "cars"}, "bad-category"),
        ({"ages": [3, 9]}, "bad-ages"),
        ({"ages": [12, 9]}, "bad-ages"),
        ({"difficulty": 4}, "bad-difficulty"),
        ({"pieces": [{"kind": "op", "op": "+"}]}, "no-picture"),
        ({"answer": "ab"}, "answer-short"),
        ({"explanation": "  nope "}, "no-explanation"),
        ({"pieces": [{"kind": "icon", "id": "rebus-yeti", "name": "yeti"}]}, "unknown-icon"),
        ({"pieces": [{"kind": "word", "text": "honey moon"}]}, "answer-in-puzzle"),
        ({"accepts": ["sweet"], "pieces": [{"kind": "word", "text": "SWEET"}]}, "answer-in-puzzle"),
    ],
)
def test_each_fault_is_named(over, code):
    assert code in codes(puzzle(**over))


def test_operators_must_sit_between_two_pieces():
    moon = {"kind": "icon", "id": "rebus-moon", "name": "moon"}
    plus = {"kind": "op", "op": "+"}
    for pieces in ([plus, moon], [moon, plus], [moon, plus, plus, moon]):
        assert "bad-operators" in codes(puzzle(pieces=pieces))


def test_too_many_pieces():
    one = {"kind": "icon", "id": "rebus-moon", "name": "moon"}
    assert "too-many-pieces" in codes(puzzle(pieces=[one] * 8))


def test_a_stack_holding_only_part_of_the_answer_is_not_giving_it_away():
    stack = {"kind": "stack", "top": "STAND", "bottom": "I"}
    assert codes(puzzle(pieces=[stack], answer="I understand", accepts=["understand"], explanation="I is under STAND.")) == []


def test_every_message_has_words():
    assert v.describe(["answer-in-puzzle", "duplicate"]).startswith("The answer is written")


def test_the_icon_list_is_the_one_the_app_draws():
    on_disk = set(json.loads((Path(v.__file__).parent / "rebus_icons.json").read_text()))
    assert on_disk == v.icon_ids()
    assert "rebus-germ" in on_disk


def test_khmer_numerals_are_the_digits_they_stand_for():
    assert v.compact_answer("១២") == "12"
    assert v.matches("42", [], "៤២", exact=True)
    assert not v.matches("42", [], "៤៣")


def test_a_worked_question_needs_no_picture_to_spell_and_a_number_is_a_fine_answer():
    quiz = puzzle(kind="quiz", pieces=[{"kind": "word", "text": "A pack has 6 pens. How many in 7 packs?"}], answer="42", explanation="6 × 7 = 42.")
    assert codes(quiz) == []
    assert v.answer_key(quiz) != v.answer_key({**quiz, "pieces": [{"kind": "word", "text": "A box has 7 pens. How many in 6 boxes?"}]})


def test_numbers_keep_the_marks_that_change_them():
    assert v.matches("-3", [], "−3", exact=True)
    assert not v.matches("-3", [], "3", exact=True)
    assert v.matches("3/4", [], "៣/៤", exact=True)
    assert not v.matches("3/4", [], "34", exact=True)
    assert v.matches("1.2", [], "1,2", exact=True)
    assert not v.matches("1.2", [], "12", exact=True)
    assert v.matches("1000", [], "1,000", exact=True)


def test_khmer_playable_leaves_out_english_wordplay():
    from app.rebus_verify import khmer_playable

    assert not khmer_playable({"kind": "picture", "pieces": [], "km": {"explanation": "ពន្យល់"}})
    assert not khmer_playable({"pieces": []})
    assert khmer_playable({"kind": "math"})
    assert khmer_playable({"km": {"pieces": [{"kind": "word", "text": "ស្វា"}]}})
    assert khmer_playable({"km": {"answer": "ស្វា"}})
    assert khmer_playable({"km": {"options": ["ក", "ខ"]}})
