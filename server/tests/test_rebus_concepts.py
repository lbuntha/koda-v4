"""Rebus Rush in the progress messages: a game, not a first-try measure."""

from app.services import mastery


def test_a_rebus_round_never_raises_mastered_or_stuck():
    assert mastery.is_ladder_concept("rebus-decoder")
    assert mastery.is_ladder_concept("trace-write-khmer")
    assert not mastery.is_ladder_concept("counting.one-to-one")


def test_a_parent_reads_the_concept_by_name():
    assert mastery.lesson_name("rebus-decoder") == "Solving picture puzzles"
