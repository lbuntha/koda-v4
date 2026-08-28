"""What a device sends up, and what it can read back."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import AUTHENTICATED, Db, require
from app.errors import Forbidden
from app.models.auth import Principal
from app.models.events import ProfileOut, PushIn, PushOut
from app.models.sync import ChangesOut
from app.repos import events as events_repo
from app.repos import rollups
from app.repos import system as system_repo
from app.services import sync as sync_service

# Every route here needs a signed-in caller; the permission each one needs
# is on the route itself.
router = APIRouter(prefix="/sync", tags=["sync"], dependencies=[AUTHENTICATED])

CanAppend = Annotated[Principal, Depends(require("learner_data:append"))]
CanRead = Annotated[Principal, Depends(require("learner_data:read"))]


def _family_of(principal: Principal) -> str:
    if principal.family_id is None:
        # Staff. They have no family to write into, and inventing one here is
        # how a support account starts owning a child's record.
        raise Forbidden("This account is not part of a family.", "no_family")
    return principal.family_id


@router.post("/push")
async def push(body: PushIn, db: Db, p: CanAppend) -> PushOut:
    _family_of(p)

    # Two deployment switches, and refusing here is safe in a way it would not
    # be elsewhere: the client keeps its queue on a refusal and sends it again
    # later, so a maintenance window costs a delay and never a round.
    if not await system_repo.value_of(db, "sync.enabled", True):
        raise Forbidden("Sync is switched off on this deployment.", "sync_disabled")
    if await system_repo.value_of(db, "system.readOnly", False):
        raise Forbidden("The service is in maintenance mode.", "read_only")

    return await sync_service.push(db, p, body)


@router.get("/changes")
async def changes(
    db: Db, p: CanRead, since: int = 0, limit: int = 500, kinds: str | None = None
) -> ChangesOut:
    """Documents changed after `since`.

    `kinds=skill,scoring` narrows it — art is orders of magnitude larger than a
    setting, and a device fetching a toggle should not pull the picture library.
    """
    _family_of(p)
    wanted = [k.strip() for k in kinds.split(",") if k.strip()] if kinds else None
    return await sync_service.changes(db, p, cursor=since, limit=min(limit, 500), kinds=wanted)


@router.get("/profile/{learner_id}")
async def profile(learner_id: str, db: Db, p: CanRead) -> ProfileOut:
    family_id = _family_of(p)

    # A learner device reads its own record and nobody else's. Tenancy, not
    # permission — which is why it is a filter rather than a check.
    if p.learner_id and learner_id != p.learner_id:
        raise Forbidden("That is not this device's learner.", "not_your_learner")

    concepts = await rollups.for_learner(db, family_id, learner_id)
    return ProfileOut(
        learnerId=learner_id,
        concepts=concepts,
        eventsStored=await events_repo.count_for_learner(db, family_id, learner_id),
    )
