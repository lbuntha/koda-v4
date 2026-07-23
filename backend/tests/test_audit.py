"""Unit tests for the shared audit diff (core/audit.py).

Pure logic, no database. `diff_fields` records only what actually changed
(before → after), including added/removed keys, so an audit is a delta not a dump.
"""

from app.core.audit import AUDITED_RESOURCES, diff_fields


def test_only_changed_keys_are_recorded():
    d = diff_fields(
        {"ai_model": "gpt-4o-mini", "sound_enabled": True, "api_key_set": False},
        {"ai_model": "gpt-4o",      "sound_enabled": True, "api_key_set": True},
    )
    assert d["changed"] == ["ai_model", "api_key_set"]
    assert d["before"] == {"ai_model": "gpt-4o-mini", "api_key_set": False}
    assert d["after"] == {"ai_model": "gpt-4o", "api_key_set": True}


def test_no_change_is_empty_delta():
    d = diff_fields({"x": 1, "y": 2}, {"x": 1, "y": 2})
    assert d["changed"] == []
    assert d["before"] == {}
    assert d["after"] == {}


def test_added_and_removed_keys_count_as_changes():
    d = diff_fields({"a": 1}, {"a": 1, "b": 2})
    assert d["changed"] == ["b"]
    assert d["after"]["b"] == 2

    d2 = diff_fields({"a": 1, "b": 2}, {"a": 1})
    assert d2["changed"] == ["b"]
    assert d2["before"]["b"] == 2
    assert d2["after"]["b"] is None


def test_changed_keys_are_sorted_deterministically():
    d = diff_fields({"z": 1, "a": 1, "m": 1}, {"z": 2, "a": 2, "m": 2})
    assert d["changed"] == ["a", "m", "z"]


def test_audited_resources_cover_the_sensitive_surfaces():
    assert {"assignment", "roster", "scoring_config", "system_settings", "curriculum_release",
            "progression_override"} <= AUDITED_RESOURCES
