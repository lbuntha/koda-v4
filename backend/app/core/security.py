"""Password/PIN hashing (argon2 via pwdlib) and JWT access/refresh tokens (PyJWT)."""

from datetime import datetime, timedelta, timezone
import base64
import hashlib

import jwt
from cryptography.fernet import Fernet, InvalidToken
from pwdlib import PasswordHash

from .config import settings

_hasher = PasswordHash.recommended()


def _secret_cipher() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(raw: str) -> str:
    return _secret_cipher().encrypt(raw.encode("utf-8")).decode("ascii")


def decrypt_secret(encrypted: str) -> str | None:
    try:
        return _secret_cipher().decrypt(encrypted.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


# ── Secret hashing (passwords + PINs) ────────────────────────────────────────

def hash_secret(raw: str) -> str:
    return _hasher.hash(raw)


def verify_secret(raw: str, hashed: str) -> bool:
    try:
        return _hasher.verify(raw, hashed)
    except Exception:
        return False


# ── JWT ──────────────────────────────────────────────────────────────────────

def _create_token(sub: str, role: str, token_type: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(sub: str, role: str) -> str:
    return _create_token(sub, role, "access", timedelta(minutes=settings.access_token_ttl_min))


def create_refresh_token(sub: str, role: str) -> str:
    return _create_token(sub, role, "refresh", timedelta(days=settings.refresh_token_ttl_days))


def decode_token(token: str) -> dict:
    """Raises jwt.PyJWTError on invalid/expired token."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
