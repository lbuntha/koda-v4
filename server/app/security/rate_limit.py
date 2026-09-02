"""How often a caller may try.

Sign-in and anything else guessable needs a ceiling, or a weak password and an
eight-character join code are both a script away. Two windows, because they stop
different things:

* **per IP** — one machine grinding through accounts.
* **per subject** (an email, later a join code) — a distributed attempt at one
  account, which the IP limit alone would not see.

Counters live in Mongo with a TTL index rather than in memory: two API
containers behind a load balancer must share one count, and a limiter that
resets on deploy is a limiter an attacker waits out.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.errors import AppError


class TooManyAttempts(AppError):
    def __init__(self, retry_after_seconds: int):
        super().__init__(
            429,
            "too_many_attempts",
            f"Too many attempts. Try again in {max(1, retry_after_seconds // 60)} minute(s).",
        )
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class RateLimit:
    """A budget of `attempts` within `window_seconds`."""

    attempts: int
    window_seconds: int


# Deliberately generous for a person who forgot their password, and useless for
# a script: ten guesses a minute will not find `123456` in any reasonable time,
# while nobody types their own password ten times in sixty seconds.
LOGIN_PER_IP = RateLimit(attempts=20, window_seconds=60)
LOGIN_PER_ACCOUNT = RateLimit(attempts=10, window_seconds=60)
SIGNUP_PER_IP = RateLimit(attempts=5, window_seconds=300)
JOIN_CODE_PER_IP = RateLimit(attempts=5, window_seconds=60)
JOIN_CODE_PER_VALUE = RateLimit(attempts=5, window_seconds=60)
# A four-digit PIN is ten thousand possibilities, which is nothing to a script
# and plenty for the person it is actually keeping out. Five a minute makes
# exhausting it take a fortnight of uninterrupted guessing, and still lets a
# parent fumble it twice at bedtime.
FAMILY_PIN_PER_FAMILY = RateLimit(attempts=5, window_seconds=60)
# Reset requests. Tighter than a login because each one sends mail: an unbudgeted
# endpoint here is a way to use the service to post a stranger a hundred emails.
FORGOT_PER_IP = RateLimit(attempts=5, window_seconds=300)
FORGOT_PER_ACCOUNT = RateLimit(attempts=3, window_seconds=900)
# Resending verification also sends mail. A person may reasonably ask again
# after checking spam, but not turn the endpoint into a mail flood.
VERIFY_RESEND_PER_IP = RateLimit(attempts=5, window_seconds=300)
VERIFY_RESEND_PER_ACCOUNT = RateLimit(attempts=3, window_seconds=900)
# The link is 256 random bits and cannot realistically be guessed. Keep a broad
# abuse ceiling without locking several families behind one school/public IP.
VERIFY_TOKEN_PER_IP = RateLimit(attempts=30, window_seconds=300)
# Redeeming an invite. Eight characters from a 32-letter alphabet is a large
# space, but a budget is what keeps it large in practice.
INVITE_PER_IP = RateLimit(attempts=10, window_seconds=300)


class Limiter:
    """Counts attempts. Nothing here decides *what* is limited — routes do."""

    COLLECTION = "rate_limits"

    async def hit(
        self,
        db: AsyncIOMotorDatabase,
        bucket: str,
        key: str,
        limit: RateLimit,
    ) -> None:
        """Record one attempt, or raise if the budget is already spent."""
        now = datetime.now(UTC)
        window_start = now - timedelta(seconds=limit.window_seconds)

        doc = await db[self.COLLECTION].find_one_and_update(
            {"_id": f"{bucket}:{key}"},
            {
                # Keep one *more* than the budget: capping the list at exactly
                # the budget means the count can never exceed it, and the limit
                # never trips. Attempts older than the window are ignored when
                # counted, so a burst an hour ago cannot lock somebody out now.
                "$push": {"attempts": {"$each": [now], "$slice": -(limit.attempts + 1)}},
                "$set": {"expiresAt": now + timedelta(seconds=limit.window_seconds)},
            },
            upsert=True,
            return_document=True,
        )

        recent = [at for at in doc.get("attempts", []) if _aware(at) > window_start]
        if len(recent) > limit.attempts:
            oldest = min(recent)
            retry_after = limit.window_seconds - int((now - _aware(oldest)).total_seconds())
            raise TooManyAttempts(max(retry_after, 1))

    async def clear(self, db: AsyncIOMotorDatabase, bucket: str, key: str) -> None:
        """Forget a subject's attempts — called after a *successful* sign-in."""
        await db[self.COLLECTION].delete_one({"_id": f"{bucket}:{key}"})


def _aware(value: datetime) -> datetime:
    """Mongo hands back naive datetimes unless the client is tz-aware."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


limiter = Limiter()
