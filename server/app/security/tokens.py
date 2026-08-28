"""Issuing, reading and rotating tokens.

Access tokens are short-lived JWTs the service can verify without a round trip.
Refresh tokens are opaque random strings whose SHA-256 lives on the device row —
so they can be revoked, which a stateless JWT cannot be.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.errors import Unauthorized
from app.models.auth import Principal
from app.settings import settings

ACCESS_AUDIENCE = "koda-app"
ADMIN_AUDIENCE = "koda-admin"


def new_refresh_token() -> tuple[str, str]:
    """Returns (token, hash). Only the hash is ever stored."""
    token = secrets.token_urlsafe(32)
    return token, hash_refresh(token)


def hash_refresh(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_access(principal: Principal, audience: str = ACCESS_AUDIENCE) -> tuple[str, int]:
    cfg = settings()
    ttl = timedelta(minutes=cfg.access_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": principal.subject_id,
        "typ": principal.kind,
        "familyId": principal.family_id,
        "role": principal.role,
        "platformRole": principal.platform_role,
        "aud": audience,
        "iat": datetime.now(UTC),
        "exp": datetime.now(UTC) + ttl,
    }
    if principal.learner_id:
        payload["learnerId"] = principal.learner_id
    if principal.permissions is not None:
        # Carried on the token so a check costs nothing, and short-lived so a
        # rights change reaches a device within the access token's 15 minutes.
        payload["perms"] = principal.permissions
    if principal.device_id:
        payload["deviceId"] = principal.device_id
    token = jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)
    return token, int(ttl.total_seconds())


def read_access(token: str, audience: str = ACCESS_AUDIENCE) -> Principal:
    cfg = settings()
    try:
        claims = jwt.decode(
            token, cfg.jwt_secret, algorithms=[cfg.jwt_algorithm], audience=audience
        )
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("That session has expired. Sign in again.", "token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("That sign-in could not be read.", "token_invalid") from exc

    return Principal(
        subject_id=claims["sub"],
        kind=claims.get("typ", "user"),
        family_id=claims.get("familyId"),
        role=claims["role"],
        learner_id=claims.get("learnerId"),
        platform_role=claims.get("platformRole", "none"),
        device_id=claims.get("deviceId"),
        permissions=claims.get("perms"),
    )
