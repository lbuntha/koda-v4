"""Nothing secret, and nothing personal, may reach a log line.

Logs get shipped to third parties, pasted into tickets, and read by people who have no
business seeing a child's name. `redact` is applied to every structure the app logs, so the
protection has to hold at the helper rather than at each call site — a future logging call
must not be able to leak a token by forgetting.
"""

import pytest

from app.core.logging import REDACTED, redact


@pytest.mark.parametrize(
    "key",
    [
        "password", "Password", "password_hash", "jwt_secret", "openai_api_key",
        "apiKey", "authorization", "Authorization", "refresh_token", "access_token",
        "pin", "pin_hash", "cookie", "credentials",
    ],
)
def test_secrets_are_removed_however_the_key_is_spelled(key):
    assert redact({key: "hunter2"})[key] == REDACTED


@pytest.mark.parametrize("key", ["email", "name", "student_name", "avatar", "family_code"])
def test_personal_detail_is_removed(key):
    assert redact({key: "Jutta"})[key] == REDACTED


@pytest.mark.parametrize("key", ["student_id", "id", "assignment_id", "release_id", "skill_id"])
def test_identifiers_survive_because_they_are_what_makes_a_log_useful(key):
    assert redact({key: "6a615084c8279f059c14ea46"})[key] == "6a615084c8279f059c14ea46"


def test_redaction_reaches_nested_structures():
    payload = {
        "student_id": "s1",
        "user": {"email": "a@b.com", "session": {"access_token": "abc"}},
        "events": [{"outcome": "correct", "pin": "1234"}],
    }
    cleaned = redact(payload)
    assert cleaned["student_id"] == "s1"
    assert cleaned["user"]["email"] == REDACTED
    assert cleaned["user"]["session"]["access_token"] == REDACTED
    assert cleaned["events"][0]["pin"] == REDACTED
    assert cleaned["events"][0]["outcome"] == "correct"


def test_a_cyclic_structure_cannot_hang_the_logger():
    node: dict = {"student_id": "s1"}
    node["self"] = node
    # Depth-capped rather than recursing forever; the point is that it returns at all.
    assert "[truncated]" in str(redact(node))


def test_long_lists_are_capped():
    assert len(redact([{"outcome": "correct"}] * 500)) == 50


def test_plain_values_pass_through_untouched():
    assert redact("just a message") == "just a message"
    assert redact(42) == 42
    assert redact(None) is None
