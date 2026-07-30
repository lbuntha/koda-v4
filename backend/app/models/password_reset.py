"""Single-use password reset tokens.

Only a SHA-256 digest of the token is stored, never the token. A leaked database backup
therefore cannot be used to take over accounts — the digest is not a credential.

SHA-256 rather than argon2 on purpose: argon2 exists to make *low-entropy* secrets expensive
to guess. These tokens are 256 bits of `secrets.token_urlsafe`, so there is nothing to guess,
and a slow hash would only add latency to every lookup.
"""

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PasswordResetToken(Document):
    user_id: str
    #: SHA-256 of the token that was emailed.
    token_hash: str
    expires_at: datetime
    #: Set the moment it is spent, so a link in a forwarded email cannot be replayed.
    used_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "password_reset_tokens"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)]),
            # Swept once expired; a spent or stale token has no reason to persist.
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
