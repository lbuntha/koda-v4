"""Settings sections added after a database already exists.

The settings document is written once and then only ever patched by an admin. A key added to
DEFAULT_SCORING_CONFIG afterwards therefore never reaches an existing install — it only shows
up on a brand new one, which is the least likely place anyone notices.

That is not a hypothetical. `rewards` was added so a curriculum with no authored economics
would inherit working values instead of silently awarding nothing; on the real database, whose
settings document predated it, every such curriculum carried on resolving XP to zero. The fix
and its test both exist because the feature shipped inert.
"""

from __future__ import annotations

import pytest_asyncio

from app.core.runtime_settings import get_system_settings
from app.core.scoring_config import DEFAULT_SCORING_CONFIG
from app.features.learning.rewards import reward_config
from app.models.content import SystemSettings


@pytest_asyncio.fixture
async def legacy_settings(database) -> SystemSettings:
    """A document from before `rewards` existed: real sections, one of them missing."""
    doc = SystemSettings(scoring={
        "streak": {"counts": "attempt", "min_events_per_day": 1, "grace_days": 1},
        "recommendation": {"skills_per_session": 3},
    })
    await doc.insert()
    return doc


async def test_a_section_the_document_predates_is_supplied(legacy_settings):
    resolved = (await get_system_settings()).scoring
    assert resolved["rewards"] == DEFAULT_SCORING_CONFIG["rewards"]


async def test_a_curriculum_with_no_override_earns_the_default_not_zero(legacy_settings):
    """The bug in one line: this resolved to zeros on every existing install."""
    system = (await get_system_settings()).scoring["rewards"]
    assert reward_config({}, system)["xp"]["correctAnswer"] > 0


async def test_what_the_admin_chose_is_never_overwritten(legacy_settings):
    resolved = (await get_system_settings()).scoring
    assert resolved["recommendation"]["skills_per_session"] == 3
    assert resolved["streak"]["counts"] == "attempt"


async def test_a_partly_filled_section_gains_only_the_keys_it_lacks(database):
    doc = SystemSettings(scoring={"rewards": {"xp": {"correctAnswer": 99}}})
    await doc.insert()

    rewards = (await get_system_settings()).scoring["rewards"]
    assert rewards["xp"] == {"correctAnswer": 99}          # the admin's section, untouched
    assert rewards["level"] == DEFAULT_SCORING_CONFIG["rewards"]["level"]


async def test_a_fresh_install_already_has_everything(database):
    resolved = (await get_system_settings()).scoring
    assert set(DEFAULT_SCORING_CONFIG) <= set(resolved)


async def test_filling_in_defaults_does_not_rewrite_the_stored_document(legacy_settings):
    """An admin's document is not edited behind their back — the merge is in memory."""
    await get_system_settings()
    stored = await SystemSettings.find_one(SystemSettings.key == "global")
    assert "rewards" not in stored.scoring
