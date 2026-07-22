"""AI generation proxy. The frontend already builds the OpenAI chat payload from
its schema registry; this forwards it to OpenAI with the server-held key so the
key never ships to the browser. Adults only."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ...core.config import settings
from ...models.user import User
from ...core.deps import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate")
async def generate(payload: dict, user: User = Depends(get_current_user)):
    if not settings.openai_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI generation is not configured")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Upstream AI request failed: {exc}")
    if resp.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"AI provider error: {resp.text}")
    return resp.json()
