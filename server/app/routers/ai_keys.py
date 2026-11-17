"""A person's own AI keys: Settings → My AI keys.

Content makers (`content:write`) can save a Gemini, OpenAI or Claude key of
their own; the Studio's AI then calls with it instead of Koda's, so their
books, quizzes, Trace and art are paid from their account. Without one, the
Studio uses the key in Admin → API keys as before.

What leaves this router:
- to the person: which providers they have a key for and its last four
  characters, never the key;
- to the app's own server (`/resolve`): the key itself, and only with both the
  person's sign-in and the server's `X-Service-Token`, the same pair that
  guards Koda's own keys. No admin route reads anyone's key.
"""

import secrets as stdlib_secrets
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model, now
from app.security.permissions import principal_can
from app.services import key_box
from app.settings import settings

router = APIRouter(prefix="/me/ai-keys", tags=["my ai keys"], dependencies=[AUTHENTICATED])

Provider = Literal["gemini", "openai", "anthropic"]
CanMake = Annotated[Principal, Depends(require("content:write"))]


def _id(user_id: str, provider: str) -> str:
    return f"{user_id}:{provider}"


class KeyIn(Model):
    key: str = Field(min_length=20, max_length=400)


class KeyOut(Model):
    provider: Provider
    last4: str
    updated_at: Any = Field(alias="updatedAt")


class KeysOut(Model):
    keys: list[KeyOut]
    #: False when this deployment has no AI_KEYS_SECRET: saving is refused.
    available: bool


def _out(row: dict[str, Any]) -> KeyOut:
    return KeyOut(provider=row["provider"], last4=row["last4"], updatedAt=row["updatedAt"])


@router.get("")
async def list_keys(db: Db, p: CanMake) -> KeysOut:
    rows = await db.user_ai_keys.find({"userId": p.subject_id}, {"sealed": 0}).sort("provider", 1).to_list(10)
    return KeysOut(keys=[_out(r) for r in rows], available=key_box.available())


@router.put("/{provider}")
async def save_key(provider: Provider, body: KeyIn, db: Db, p: CanMake) -> KeyOut:
    key = body.key.strip()
    if any(ch.isspace() for ch in key) or len(key) < 20:
        raise AppError(400, "invalid_key", "That does not look like an API key. Paste the whole key, with no spaces.")
    if not key_box.available():
        raise AppError(503, "keys_unavailable", "This Koda cannot keep personal keys yet. Ask an admin to set AI_KEYS_SECRET.")
    row = {
        "_id": _id(p.subject_id, provider),
        "userId": p.subject_id,
        "provider": provider,
        "sealed": key_box.seal(key),
        "last4": key[-4:],
        "updatedAt": now(),
    }
    await db.user_ai_keys.replace_one({"_id": row["_id"]}, row, upsert=True)
    return _out(row)


@router.delete("/{provider}", status_code=204)
async def delete_key(provider: Provider, db: Db, p: CanMake) -> None:
    await db.user_ai_keys.delete_one({"_id": _id(p.subject_id, provider)})


@router.post("/{provider}/resolve")
async def resolve_key(
    provider: Provider,
    db: Db,
    p: CurrentPrincipal,
    x_service_token: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """The caller's own key, for the app's server and nothing else (see the module notes)."""
    expected = settings().tutor_service_token
    if not expected or not x_service_token:
        raise Forbidden("This deployment has no tutor server configured.")
    if not stdlib_secrets.compare_digest(x_service_token, expected):
        raise Forbidden("Not the tutor server.")
    # Only a content maker's Studio work spends their key; anyone else has none to use.
    row = await db.user_ai_keys.find_one({"_id": _id(p.subject_id, provider)}) if principal_can(p, "content:write") else None
    value = key_box.unseal(row["sealed"]) if row else None
    if not value:
        raise NotFound("No personal key for this provider.", "no_personal_key")
    return {"value": value}
