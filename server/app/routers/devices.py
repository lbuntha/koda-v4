"""The tablets and phones signed into a family."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import AUTHENTICATED, Db, require
from app.errors import Forbidden, NotFound
from app.models.auth import Principal
from app.repos import devices, learners
from app.repos.base import scoped

# Every route here needs a signed-in caller; the permission each one needs
# is on the route itself.
router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[AUTHENTICATED])

CanList = Annotated[Principal, Depends(require("device:list"))]
CanRevoke = Annotated[Principal, Depends(require("device:revoke"))]


@router.get("")
async def list_devices(
    db: Db,
    p: CanList,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=5, le=100)] = 10,
) -> dict:
    """One page of live sessions, most recently used first.

    Paged because this list is not naturally short: a family that has been
    signing in since before an install could be recognised holds a row per
    sign-in, and twenty-six of them on one screen is a wall, not a list.
    """
    # Raises for a staff account, which belongs to no family: sweeping or
    # counting on a `familyId` of `None` would reach across every one of them.
    family_id = scoped(p)["familyId"]

    # Read time is when the count has to be honest, so aged-out rows are
    # retired here rather than left to a sweep that may never run. Doing it
    # before the query is what keeps `total` and the page agreeing.
    await devices.expire_stale(db, family_id)

    if p.learner_id:
        # A child sees their own row and nothing else. Asked for directly
        # rather than filtered out of a page of the family's: their row is not
        # reliably on the first page, and paging a list down to nothing would
        # show a child an empty screen on the device they are holding.
        own = await db.devices.find_one(
            {"_id": p.device_id, "revokedAt": None}, {"refreshHash": 0}
        )
        rows = [own] if own else []
        total = len(rows)
    else:
        rows, total = await devices.for_family(
            db, family_id, page=page, page_size=page_size
        )

    # Whose tablet each one is. A list that says "This device" eight times is
    # not something a parent can act on; "Mia's tablet" is.
    names: dict[str, str] = {}
    for learner in await learners.for_family(db, family_id):
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
                "createdAt": r.get("createdAt"),
                "revokedAt": r.get("revokedAt"),
                "current": r["_id"] == p.device_id,
            }
            for r in rows
        ],
        "page": page,
        "pageSize": page_size,
        "total": total,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.delete("", status_code=200)
async def revoke_others(db: Db, p: CanRevoke) -> dict:
    """Sign out everything in this family except the device asking.

    The way out of a list somebody no longer recognises: rather than tapping
    through twenty rows deciding which are theirs, end them all and let the
    machines still in use sign in again. The caller is spared, so they are left
    looking at the result instead of at the sign-in screen.
    """
    if p.learner_id:
        raise Forbidden(
            "A child can only sign out their own device.", "child_bulk_revoke_forbidden"
        )
    family_id = scoped(p)["familyId"]
    signed_out = await devices.revoke_others_in_family(db, family_id, p.device_id)
    return {"signedOut": signed_out}


@router.delete("/{device_id}", status_code=204)
async def revoke_device(device_id: str, db: Db, p: CanRevoke) -> None:
    # Tenancy, not permission: the id is looked up inside this family's rows, so
    # an id borrowed from another family is simply not there.
    found = await db.devices.find_one(scoped(p, {"_id": device_id}))
    if not found or (p.learner_id and device_id != p.device_id):
        raise NotFound("No such device on this account.")
    await devices.revoke(db, device_id)
