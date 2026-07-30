"""Applying the throttle policy to real sign-in attempts.

Keeps the I/O here so `core/throttle.py` stays a pure, testable decision.

The messages are deliberately uninformative. "Incorrect email or password" never says which
was wrong, and a locked credential says the same thing whether or not the account exists —
otherwise the lockout itself becomes a way to discover who has an account.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status

from ...core.logging import get_logger
from ...core.throttle import (
    SOURCE_ADDRESS,
    ThrottlePolicy,
    ThrottleState,
    check,
    record_failure,
)
from ...models.throttle import LoginThrottle

logger = get_logger("auth")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def source_key(request: Request) -> str:
    """The caller's address. Behind a proxy this needs the forwarded header to be trusted."""
    forwarded = request.headers.get("x-forwarded-for", "")
    address = forwarded.split(",")[0].strip() if forwarded else (
        request.client.host if request.client else "unknown"
    )
    return f"ip:{address}"


async def _load(key: str) -> tuple[LoginThrottle | None, ThrottleState]:
    row = await LoginThrottle.find_one(LoginThrottle.key == key)
    if not row:
        return None, ThrottleState()
    return row, ThrottleState(
        attempts=row.attempts,
        window_started_at=_aware(row.window_started_at),
        locked_until=_aware(row.locked_until),
    )


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def enforce(keys: list[tuple[str, ThrottlePolicy]]) -> None:
    """Raise 429 if any scope has run out. Records nothing — call before verifying."""
    now = _now()
    for key, policy in keys:
        _, state = await _load(key)
        decision = check(state, policy, now)
        if not decision.allowed:
            logger.warning("login blocked key=%s retry_after=%s", key, decision.retry_after)
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many attempts. Please wait and try again.",
                headers={"Retry-After": str(decision.retry_after)},
            )


async def note_failure(keys: list[tuple[str, ThrottlePolicy]]) -> dict[str, datetime]:
    """Count a failed attempt against every scope it belongs to.

    Returns the scopes that *just* became locked, mapped to when they unlock, so a
    caller can tell someone about a lockout it caused. Already-locked scopes are not
    reported: `enforce` refuses those before a caller ever reaches this, and a
    repeat would mean alerting on every subsequent attempt rather than on the event.
    """
    now = _now()
    newly_locked: dict[str, datetime] = {}
    for key, policy in keys:
        row, state = await _load(key)
        nxt = record_failure(state, policy, now)
        if nxt.locked_until and state.locked_until is None:
            newly_locked[key] = nxt.locked_until
        # Keep the row only while it can still deny something.
        expires_at = (nxt.locked_until or now + policy.window) + timedelta(minutes=1)
        if row:
            row.attempts = nxt.attempts
            row.window_started_at = nxt.window_started_at or now
            row.locked_until = nxt.locked_until
            row.updated_at = now
            row.expires_at = expires_at
            await row.save()
        else:
            await LoginThrottle(
                key=key, attempts=nxt.attempts,
                window_started_at=nxt.window_started_at or now,
                locked_until=nxt.locked_until, updated_at=now, expires_at=expires_at,
            ).insert()
        if nxt.locked_until:
            logger.warning("login locked key=%s until=%s", key, nxt.locked_until.isoformat())
    return newly_locked


#: For a spend quota every call counts, not just the failures. Same counter, different
#: meaning — kept as an alias so the call site reads honestly.
note_use = note_failure


async def clear(keys: list[str]) -> None:
    """A success wipes the record — an honest user who finally remembers starts clean."""
    for key in keys:
        row = await LoginThrottle.find_one(LoginThrottle.key == key)
        if row:
            await row.delete()


def address_scope(request: Request) -> tuple[str, ThrottlePolicy]:
    return source_key(request), SOURCE_ADDRESS
