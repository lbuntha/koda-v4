"""Pictures from a child's own photo: the family's monthly allowance.

The picture itself is drawn by the web server (`/api/paint/photo-page` in
server.ts), which holds the model key. Before it calls the model it takes one
of the family's pictures here, and gives it back if the model fails — so the
allowance is counted in one place, on the server, where a tablet cannot skip it.

Every family member may ask, a child included: the child is who makes them.
The plan is checked here too (`ai.koda`), so a lapsed family cannot spend.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter

from app.deps import AUTHENTICATED, CurrentPrincipal, Db
from app.errors import AppError, Forbidden
from app.models.common import Model, now
from app.repos import photo_credits as credits_repo
from app.repos import system as system_repo
from app.security import principal_can
from app.services.entitlements import has_feature

router = APIRouter(prefix="/paint", tags=["paint"], dependencies=[AUTHENTICATED])

FEATURE = "ai.koda"
DEFAULT_PER_MONTH = 30


async def per_month(db) -> int:
    """The operator's monthly allowance. A blank or unreadable value falls back to the default; never negative."""
    raw = await system_repo.value_of(db, "paint.photoCreditsPerMonth", str(DEFAULT_PER_MONTH))
    try:
        return max(0, int(str(raw).strip()))
    except ValueError:
        return DEFAULT_PER_MONTH


def _resets_at(when: datetime) -> str:
    first = when.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    nxt = (first + timedelta(days=32)).replace(day=1)
    return nxt.isoformat()


class CreditsOut(Model):
    limit: int
    used: int
    left: int
    month: str
    resetsAt: str


async def _family(db, p) -> str:
    if not p.family_id:
        raise Forbidden("Pictures from photos belong to a family.", "no_family")
    if not await has_feature(db, p.family_id, FEATURE, staff=principal_can(p, "system:write")):
        raise AppError(402, "plan_required", "Pictures from photos are part of a paid plan.")
    return p.family_id


async def _state(db, family_id: str) -> CreditsOut:
    limit = await per_month(db)
    used = await credits_repo.used(db, family_id)
    return CreditsOut(limit=limit, used=used, left=max(0, limit - used), month=credits_repo.month_of(), resetsAt=_resets_at(now()))


@router.get("/photo-credits")
async def photo_credits(db: Db, p: CurrentPrincipal) -> CreditsOut:
    """How many this family has left this month."""
    return await _state(db, await _family(db, p))


@router.post("/photo-credits/spend")
async def spend_photo_credit(db: Db, p: CurrentPrincipal) -> CreditsOut:
    """Take one before drawing. 402 `no_credits` when the month's are used up."""
    family_id = await _family(db, p)
    if await credits_repo.spend(db, family_id, await per_month(db)) is None:
        raise AppError(402, "no_credits", "This month's pictures from photos are used up.")
    return await _state(db, family_id)


@router.post("/photo-credits/refund")
async def refund_photo_credit(db: Db, p: CurrentPrincipal) -> CreditsOut:
    """Give one back when the picture could not be drawn."""
    family_id = await _family(db, p)
    await credits_repo.refund(db, family_id)
    return await _state(db, family_id)
