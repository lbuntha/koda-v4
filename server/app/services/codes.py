"""Short-lived, human-friendly child device codes."""

import hashlib
import hmac
import secrets

from app.settings import settings

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8
BUDDY_CODE_LENGTH = 6


def new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def new_buddy_code() -> str:
    """A read-aloud code with a namespace and about thirty bits of entropy."""
    return "KODA-" + "".join(secrets.choice(ALPHABET) for _ in range(BUDDY_CODE_LENGTH))


def hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()


def hash_buddy_code(code: str) -> str:
    """Peppered hash: a database leak cannot brute-force the short UI code."""
    return hmac.new(
        settings().jwt_secret.encode(),
        code.strip().upper().encode(),
        hashlib.sha256,
    ).hexdigest()
