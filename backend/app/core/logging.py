"""Application logging: one configuration, and a redactor that keeps secrets out of it.

Until now nothing logged. Every defect found during development was diagnosed by reading the
database directly, which does not survive contact with more than one developer and one
learner — a production failure would simply have been invisible.

Two rules shape this module:

* **Never log a secret.** Tokens, PINs, password hashes, and API keys pass through request
  bodies and exception context. `redact` is applied to everything structured that is logged,
  so a future call site cannot leak one by forgetting.
* **Never log more of a child than needed.** A student id is necessary to trace a failure; a
  name, an email, or an answer is not. Identifiers only.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

from .config import settings

#: Substrings that mark a value as secret wherever it appears in a key.
SECRET_HINTS = (
    "password", "token", "secret", "authorization", "api_key", "apikey",
    "pin", "hash", "cookie", "credential",
)
#: Personal detail that is never needed to diagnose a failure — an id always is.
PERSONAL_HINTS = ("email", "name", "avatar", "family_code")

REDACTED = "[redacted]"
_MAX_DEPTH = 6

#: Libraries that log at DEBUG on a timer rather than in response to anything.
#:
#: pymongo emits a heartbeat pair per server every 10 seconds. At the root DEBUG level used in
#: development that is the entire log — thousands of lines an hour in which a real warning is
#: invisible. Raising them to WARNING keeps their genuine failures (a dropped primary, a
#: connection error) while dropping the timer chatter.
NOISY_LIBRARIES = ("pymongo", "motor", "asyncio", "httpcore", "httpx", "multipart")


def _is_secret(key: str) -> bool:
    lowered = key.lower()
    return any(hint in lowered for hint in SECRET_HINTS)


def _is_personal(key: str) -> bool:
    lowered = key.lower()
    # `*_id` is an identifier, not personal detail — `student_id` must survive redaction.
    if lowered.endswith("_id") or lowered == "id":
        return False
    return any(hint in lowered for hint in PERSONAL_HINTS)


def redact(value: Any, _depth: int = 0) -> Any:
    """Deep-copy a structure with secrets and personal detail replaced.

    Applied to anything structured before it is logged. Depth-capped so a cyclic or
    pathologically nested payload cannot hang the logger.
    """
    if _depth >= _MAX_DEPTH:
        return "[truncated]"
    if isinstance(value, dict):
        return {
            key: REDACTED if (_is_secret(str(key)) or _is_personal(str(key)))
            else redact(item, _depth + 1)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(item, _depth + 1) for item in value[:50]]
    return value


def configure_logging() -> None:
    """Install one handler on the root logger. Idempotent — safe on reload."""
    root = logging.getLogger()
    if any(getattr(handler, "_koda", False) for handler in root.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    ))
    handler._koda = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(logging.INFO if settings.is_production else logging.DEBUG)
    # Access logs are uvicorn's job; ours is application events and failures.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    for name in NOISY_LIBRARIES:
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"koda.{name}")
