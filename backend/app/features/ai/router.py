"""AI generation proxy. The frontend already builds the OpenAI chat payload from
its schema registry; this forwards it to OpenAI with the server-held key so the
key never ships to the browser.

Two things guard the spend, because this endpoint bills a real account per call:

* **Authoring roles only.** It was reachable by any authenticated account, which included a
  child's device — the least trusted place a token lives — and a parent who has no authoring
  UI at all. Curriculum and artwork generation belongs to admins and teachers.
* **A per-user hourly quota.** The payload caps a single call (8 messages, 30k characters
  each, 4k output tokens); nothing capped how many calls. One token could run the account dry.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ...core.config import settings
from ...core.logging import get_logger
from ...core.runtime_settings import get_system_settings, resolve_openai_api_key
from ...core.throttle import AI_GENERATION
from ...models.user import User
from ...core.deps import get_current_author
from ..auth.guard import enforce, note_use
from .schemas import AiGenerateIn

router = APIRouter(prefix="/ai", tags=["ai"])
logger = get_logger("ai")


@router.post("/generate")
async def generate(payload: AiGenerateIn, user: User = Depends(get_current_author)):
    # Per account only, deliberately not per IP. `address_scope` shares one counter with
    # sign-in attempts, so metering generations against it would let a busy authoring session
    # lock everyone at that address out of logging in — and a whole school or office is one
    # address. Authoring already requires an account, so the account is the right axis.
    scopes = [(f"ai:{user.id}", AI_GENERATION)]
    await enforce(scopes)
    await note_use(scopes)

    runtime = await get_system_settings()
    api_key = await resolve_openai_api_key(runtime)
    if not api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI generation is not configured")
    provider_payload = payload.model_dump()
    provider_payload["model"] = runtime.ai_model
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=provider_payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Upstream AI request failed: {exc}")
    if resp.status_code >= 400:
        # The provider's own message can carry key or account detail, so it is not passed on.
        logger.warning("ai provider rejected request user_id=%s status=%s", user.id, resp.status_code)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "AI provider rejected the generation request")
    usage = (resp.json() or {}).get("usage") or {}
    # Spend is invisible until the invoice arrives; this makes it greppable per user.
    logger.info(
        "ai generation user_id=%s prompt_tokens=%s completion_tokens=%s",
        user.id, usage.get("prompt_tokens"), usage.get("completion_tokens"),
    )
    return resp.json()
