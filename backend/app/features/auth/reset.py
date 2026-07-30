"""Password reset: issuing a link, and spending it.

A parent who forgot their password previously had no way back into their children's
accounts — there was no recovery path of any kind.

Three properties shape this:

* **The request endpoint reveals nothing.** It answers identically whether or not the address
  has an account, so it cannot be used to discover who is a customer.
* **A link is single-use and short-lived.** Password reset emails get forwarded, quoted in
  support threads, and left in shared inboxes.
* **Resetting evicts everyone else.** If someone else knew the old password, changing it has
  to end their session too, or the reset achieves nothing.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from ...core.config import settings
from ...core.logging import get_logger
from ...core.mail import Message, get_mailer
from ...models.password_reset import PasswordResetToken
from ...models.user import User

logger = get_logger("auth.reset")

TOKEN_TTL = timedelta(hours=1)
#: 256 bits. Long enough that guessing is not a threat model.
TOKEN_BYTES = 32


def _now() -> datetime:
    return datetime.now(timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def reset_link(token: str) -> str:
    return f"{settings.app_base_url.rstrip('/')}/reset-password?token={token}"


def compose(name: str, token: str) -> Message:
    link = reset_link(token)
    hours = int(TOKEN_TTL.total_seconds() // 3600)
    return Message(
        to="",  # filled by the caller; compose is pure so it can be asserted on
        subject="Reset your Koda password",
        body=(
            f"Hi {name},\n\n"
            "Someone asked to reset the password for your Koda account. "
            f"Open this link to choose a new one:\n\n{link}\n\n"
            f"The link works once and expires in {hours} hour"
            f"{'s' if hours != 1 else ''}.\n\n"
            "If this wasn't you, nothing has changed and you can ignore this email.\n"
        ),
    )


async def issue(user: User) -> str:
    """Create a token, invalidate any earlier one, and email the link. Returns the token."""
    # Only the newest link should work: an older one may be sitting in a shared inbox.
    async for stale in PasswordResetToken.find(
        PasswordResetToken.user_id == str(user.id), PasswordResetToken.used_at == None
    ):
        await stale.delete()

    token = secrets.token_urlsafe(TOKEN_BYTES)
    await PasswordResetToken(
        user_id=str(user.id), token_hash=hash_token(token), expires_at=_now() + TOKEN_TTL,
    ).insert()

    message = compose(user.name or "there", token)
    message.to = str(user.email)
    get_mailer().send(message)
    # Never the token or the link — this line ends up in shipped logs.
    logger.info("password reset requested user_id=%s", user.id)
    return token


async def consume(token: str) -> User | None:
    """Spend a token and return its owner, or None if it is unusable."""
    row = await PasswordResetToken.find_one(PasswordResetToken.token_hash == hash_token(token))
    if not row or row.used_at is not None:
        return None
    expires_at = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= _now():
        return None
    user = await User.get(row.user_id)
    if not user:
        return None
    # Marked spent before the password is written: a crash between the two must leave the
    # link dead rather than replayable.
    row.used_at = _now()
    await row.save()
    return user
