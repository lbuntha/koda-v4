"""Encrypts what a person trusts Koda to keep secret for them: their own AI keys.

Fernet (AES-128-CBC + HMAC-SHA256) under a key derived from `AI_KEYS_SECRET`.
The database holds only the sealed text and the last four characters, so a
leaked backup or a stray query shows nobody's key.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.settings import settings

# Development may run without the secret: a fixed, labelled key keeps local
# work simple and is useless anywhere real.
_DEV_SECRET = "koda-dev-only-ai-keys-secret-not-for-production"


def _secret() -> str | None:
    if settings().ai_keys_secret:
        return settings().ai_keys_secret
    return _DEV_SECRET if settings().is_dev else None


def available() -> bool:
    """Whether keys can be sealed here at all."""
    return _secret() is not None


def _box() -> Fernet:
    secret = _secret()
    if secret is None:
        raise RuntimeError("AI_KEYS_SECRET is not set")
    return _box_for(secret)


def _box_for(secret: str) -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


def seal(text: str, *, secret: str | None = None) -> str:
    box = _box() if secret is None else _box_for(secret)
    return box.encrypt(text.encode()).decode()


def unseal(token: str, *, secret: str | None = None) -> str | None:
    """The key, or None when it cannot be read (the secret changed): the person adds it again."""
    try:
        box = _box() if secret is None else _box_for(secret)
        return box.decrypt(token.encode()).decode()
    except (InvalidToken, RuntimeError):
        return None
