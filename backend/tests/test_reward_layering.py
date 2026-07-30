"""Where the value of playing comes from.

Rewards used to be authored per curriculum with a zero fallback. A curriculum whose author
never filled the form awarded nothing — no error, no warning, a counter that never moved
while a child kept playing. Two of the three curricula on the first real database were in
that state, and it was only discoverable by reading the collection.

They now layer like the streak and recommendation settings: a system-wide default that every
curriculum inherits, overridable per curriculum when a course genuinely needs different
economics.
"""

from __future__ import annotations

from app.core.scoring_config import DEFAULT_SCORING_CONFIG
from app.features.learning.rewards import DEFAULT_REWARDS, reward_config

SYSTEM = DEFAULT_SCORING_CONFIG["rewards"]


def test_a_curriculum_that_authored_nothing_inherits_working_values():
    """The bug this design removes: silence used to mean zero."""
    config = reward_config({}, SYSTEM)
    assert config["xp"]["correctAnswer"] == SYSTEM["xp"]["correctAnswer"]
    assert config["xp"]["activityCompletion"] == SYSTEM["xp"]["activityCompletion"]
    assert config["level"]["xpPerLevel"] == SYSTEM["level"]["xpPerLevel"]


def test_a_curriculum_may_still_set_its_own_economics():
    tree = {"rewards": {"xp": {"correctAnswer": 50}}}
    config = reward_config(tree, SYSTEM)
    assert config["xp"]["correctAnswer"] == 50
    # Fields it did not mention still come from the system, not from zero.
    assert config["xp"]["activityCompletion"] == SYSTEM["xp"]["activityCompletion"]


def test_with_nothing_configured_anywhere_nothing_is_minted():
    """The floor still holds: XP nobody chose is XP the product invented."""
    config = reward_config({})
    assert config["xp"] == DEFAULT_REWARDS["xp"]
    assert config["level"] == {}


def test_a_curriculum_cannot_be_dragged_below_zero_by_a_broken_system_setting():
    config = reward_config({"rewards": {"xp": {"correctAnswer": 4}}}, {"xp": {}})
    assert config["xp"]["correctAnswer"] == 4


def test_achievements_are_taken_whole_rather_than_merged():
    """Half of one ladder and half of another is not a ladder."""
    system = {**SYSTEM, "achievements": [{"id": "shared", "target": 1}]}
    own = {"rewards": {"achievements": [{"id": "mine", "target": 5}]}}

    assert [a["id"] for a in reward_config(own, system)["achievements"]] == ["mine"]
    assert [a["id"] for a in reward_config({}, system)["achievements"]] == ["shared"]


def test_the_shipped_default_is_a_level_per_completed_session():
    """The number that decides how a learner experiences progress, kept honest.

    5 questions x (correct + first try) + completion, three activities to a session.
    """
    xp = SYSTEM["xp"]
    per_skill = 5 * xp["correctAnswer"] + 5 * xp["firstTryBonus"] + xp["activityCompletion"]
    per_session = per_skill * 3
    assert per_session == SYSTEM["level"]["xpPerLevel"] * 1.05  # one level, near enough
