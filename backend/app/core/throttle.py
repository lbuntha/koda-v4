"""Login throttling: how many failures a credential gets before it stops answering.

Both sign-in endpoints accepted unlimited attempts. That matters most for the kid flow: a
student PIN is short by design, so an unbounded guesser reaches a child's account in minutes.

The decision is a pure function of stored counters and the clock, so the interesting cases —
the window rolling over, a lock expiring, a success clearing the record — are testable
without a database or a running clock.

Two scopes are counted independently and both must pass:

* the **credential** (an email, or one child's PIN), which stops a single account being
  ground down; and
* the **source address**, which stops one attacker sweeping many accounts from one place.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class ThrottlePolicy:
    """How forgiving a scope is. Kid PINs are shorter, so they get a tighter rule."""

    max_attempts: int
    window: timedelta
    lockout: timedelta


#: An adult typo-ing a password a few times is normal; ten in five minutes is not.
ADULT_LOGIN = ThrottlePolicy(max_attempts=8, window=timedelta(minutes=15), lockout=timedelta(minutes=15))
#: A 4-digit PIN has 10,000 combinations. Five tries per 15 minutes makes guessing useless
#: while still forgiving a child who forgets which of two PINs is theirs.
STUDENT_PIN = ThrottlePolicy(max_attempts=5, window=timedelta(minutes=15), lockout=timedelta(minutes=15))
#: Per source address, across every account it touches.
SOURCE_ADDRESS = ThrottlePolicy(max_attempts=30, window=timedelta(minutes=15), lockout=timedelta(minutes=10))
#: AI generation spends real money per call, so every call counts — not just failed ones.
#: Sized for a person authoring a curriculum, not for a script.
AI_GENERATION = ThrottlePolicy(max_attempts=40, window=timedelta(hours=1), lockout=timedelta(minutes=15))


@dataclass(frozen=True)
class ThrottleState:
    """What is stored for one key. `None` means nothing has failed yet."""

    attempts: int = 0
    window_started_at: datetime | None = None
    locked_until: datetime | None = None


@dataclass(frozen=True)
class Decision:
    allowed: bool
    #: Seconds until the caller may try again. Only meaningful when `allowed` is False.
    retry_after: int = 0
    #: Tries left in this window, for a message that helps an honest user.
    remaining: int = 0


def check(state: ThrottleState | None, policy: ThrottlePolicy, now: datetime) -> Decision:
    """Whether an attempt may proceed, without recording anything."""
    state = state or ThrottleState()
    if state.locked_until and state.locked_until > now:
        return Decision(allowed=False, retry_after=_seconds_until(state.locked_until, now))
    attempts = _attempts_in_window(state, policy, now)
    return Decision(allowed=True, remaining=max(0, policy.max_attempts - attempts))


def record_failure(state: ThrottleState | None, policy: ThrottlePolicy, now: datetime) -> ThrottleState:
    """The state to store after a failed attempt, locking the key if it has run out."""
    state = state or ThrottleState()
    # A lock that has expired starts a fresh window rather than resuming an old count.
    attempts = _attempts_in_window(state, policy, now) + 1
    window_started_at = (
        state.window_started_at
        if state.window_started_at and now - state.window_started_at < policy.window
        and not _lock_expired(state, now)
        else now
    )
    locked_until = now + policy.lockout if attempts >= policy.max_attempts else None
    return ThrottleState(
        attempts=attempts, window_started_at=window_started_at, locked_until=locked_until,
    )


def _lock_expired(state: ThrottleState, now: datetime) -> bool:
    return bool(state.locked_until and state.locked_until <= now)


def _attempts_in_window(state: ThrottleState, policy: ThrottlePolicy, now: datetime) -> int:
    """Failures still counted: zero once the window has rolled or a lock has served out."""
    if _lock_expired(state, now):
        return 0
    if not state.window_started_at or now - state.window_started_at >= policy.window:
        return 0
    return state.attempts


def _seconds_until(moment: datetime, now: datetime) -> int:
    return max(1, int((moment - now).total_seconds()))
