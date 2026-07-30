"""The login throttle's decision logic.

Both sign-in endpoints previously accepted unlimited attempts, which made a short student PIN
guessable. These pin the behaviour that keeps it honest without punishing a real child who
mistypes: the window rolling over, a lock serving out, and a success clearing the record.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.throttle import (
    ADULT_LOGIN,
    SOURCE_ADDRESS,
    STUDENT_PIN,
    ThrottlePolicy,
    ThrottleState,
    check,
    record_failure,
)

NOW = datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc)
POLICY = ThrottlePolicy(max_attempts=3, window=timedelta(minutes=10), lockout=timedelta(minutes=5))


def fail(times: int, state: ThrottleState | None = None, at: datetime = NOW) -> ThrottleState:
    for _ in range(times):
        state = record_failure(state, POLICY, at)
    return state


def test_a_fresh_credential_is_allowed_with_its_full_budget():
    decision = check(None, POLICY, NOW)
    assert decision.allowed
    assert decision.remaining == 3


def test_remaining_counts_down_with_each_failure():
    assert check(fail(1), POLICY, NOW).remaining == 2
    assert check(fail(2), POLICY, NOW).remaining == 1


def test_running_out_locks_the_credential():
    decision = check(fail(3), POLICY, NOW)
    assert not decision.allowed
    assert decision.retry_after == 5 * 60


def test_the_lock_serves_out_and_then_forgives():
    locked = fail(3)
    assert not check(locked, POLICY, NOW + timedelta(minutes=4)).allowed
    after = check(locked, POLICY, NOW + timedelta(minutes=5, seconds=1))
    assert after.allowed
    # A served lock starts over rather than resuming at the limit.
    assert after.remaining == 3


def test_the_window_rolls_so_scattered_typos_never_accumulate():
    """Three failures spread over half an hour must not lock anyone out."""
    state = fail(1, at=NOW)
    state = fail(1, state, at=NOW + timedelta(minutes=11))
    state = fail(1, state, at=NOW + timedelta(minutes=22))
    assert check(state, POLICY, NOW + timedelta(minutes=22)).allowed


def test_failures_inside_the_window_do_accumulate():
    state = fail(1, at=NOW)
    state = fail(1, state, at=NOW + timedelta(minutes=3))
    state = fail(1, state, at=NOW + timedelta(minutes=6))
    assert not check(state, POLICY, NOW + timedelta(minutes=6)).allowed


def test_retry_after_never_reports_zero_seconds():
    """A caller told to wait 0 would retry instantly and hammer the endpoint."""
    locked = fail(3)
    decision = check(locked, POLICY, NOW + timedelta(minutes=4, seconds=59, milliseconds=999))
    assert not decision.allowed
    assert decision.retry_after >= 1


def test_a_child_gets_fewer_tries_than_an_adult_because_a_pin_is_shorter():
    assert STUDENT_PIN.max_attempts < ADULT_LOGIN.max_attempts
    # …and one address may not simply switch accounts to keep going.
    assert SOURCE_ADDRESS.max_attempts >= ADULT_LOGIN.max_attempts


@pytest.mark.parametrize("policy", [ADULT_LOGIN, STUDENT_PIN, SOURCE_ADDRESS])
def test_every_shipped_policy_actually_locks(policy):
    state = None
    for _ in range(policy.max_attempts):
        state = record_failure(state, policy, NOW)
    assert not check(state, policy, NOW).allowed
