"""The tablets and phones signed into a family."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import AUTHENTICATED, Db, require
from app.errors import NotFound
from app.models.auth import Principal
from app.repos import devices, learners
from app.repos.base import scoped

# Every route here needs a signed-in caller; the permission each one needs
# is on the route itself.
router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[AUTHENTICATED])

CanList = Annotated[Principal, Depends(require("device:list"))]
CanRevoke = Annotated[Principal, Depends(require("device:revoke"))]


@router.get("")
async def list_devices(db: Db, p: CanList) -> dict:
    rows = await devices.for_family(db, p.family_id)
    if p.learner_id:
        rows = [r for r in rows if r["_id"] == p.device_id]

    # Whose tablet each one is. A list that says "This device" eight times is
    # not something a parent can act on; "Mia's tablet" is.
    names: dict[str, str] = {}
    if p.family_id:
        for learner in await learners.for_family(db, p.family_id):
            names[learner["_id"]] = learner["displayName"]

    return {
        "devices": [
            {
                "id": r["_id"],
                "name": r["name"],
                "kind": r["kind"],
                "learnerId": r.get("learnerId"),
                "learnerName": names.get(r.get("learnerId") or ""),
                "lastSeenAt": r.get("lastSeenAt"),
                "revokedAt": r.get("revokedAt"),
                "current": r["_id"] == p.device_id,
            }
            for r in rows
        ]
    }


@router.delete("/{device_id}", status_code=204)
async def revoke_device(device_id: str, db: Db, p: CanRevoke) -> None:
    # Tenancy, not permission: the id is looked up inside this family's rows, so
    # an id borrowed from another family is simply not there.
    found = await db.devices.find_one(scoped(p, {"_id": device_id}))
    if not found or (p.learner_id and device_id != p.device_id):
        raise NotFound("No such device on this account.")
    await devices.revoke(db, device_id)
