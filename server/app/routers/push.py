"""Registering a browser to be rung, and forgetting one.

Two routes, and most of the design is in what they refuse.

A token arrives from a browser that has just been granted permission, and the
only account it may ever be attached to is the one presenting the request. There
is no route here that names a recipient — not for an operator, not for a parent
— because a token plus a chosen recipient is a way to put words on a stranger's
lock screen, and no screen in this product needs that.
"""

from fastapi import APIRouter
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db
from app.errors import Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import push_tokens
from app.repos.base import scoped

router = APIRouter(prefix="/push", tags=["push"], dependencies=[AUTHENTICATED])


class TokenIn(Model):
    """What a browser hands over after a parent says yes.

    `ua` and `platform` are stored so a device list can say "Chrome on a Pixel"
    rather than print 163 characters of token at somebody.
    """

    # FCM tokens are long and opaque; the bounds are a sanity check, not a
    # format — pinning the exact shape here would break the day Google changes
    # it, and the only thing that can really validate one is FCM.
    token: str = Field(min_length=32, max_length=4096)
    ua: str | None = Field(default=None, max_length=400)
    platform: str | None = Field(default=None, max_length=60)


def _adult(p: Principal) -> str:
    """The family this caller may register a token for — and never a child's.

    A learner-scoped session is refused outright rather than quietly ignored.
    A kid's tablet is where the app is played, not where it is advertised, and
    the promise is only worth making if it is the endpoint that keeps it rather
    than the screen that happens not to draw the switch.
    """
    if p.learner_id:
        raise Forbidden(
            "Koda does not send notifications to a child's device.",
            "push_learner_forbidden",
        )
    if p.kind != "user" or not p.subject_id:
        raise Forbidden("Only a signed-in account can be notified.", "push_no_account")
    return scoped(p)["familyId"]


@router.post("/tokens", status_code=204)
async def register(body: TokenIn, db: Db, p: CurrentPrincipal) -> None:
    """Remember this browser.

    Called on every launch, not only the first: FCM rotates a token on its own
    schedule, and a device that registered once and never again goes quiet
    without telling anybody. The client only sends when the value has changed,
    and this is an upsert, so the repeat is one row either way.
    """
    family_id = _adult(p)
    await push_tokens.save(
        db,
        token=body.token,
        family_id=family_id,
        user_id=p.subject_id,
        device_id=p.device_id,
        ua=body.ua,
        platform=body.platform,
    )


@router.delete("/tokens/{token}", status_code=204)
async def forget(token: str, db: Db, p: CurrentPrincipal) -> None:
    """Stop ringing this browser — a parent switching notifications off.

    Scoped by family rather than checked by permission: a token belonging to
    somebody else is simply not there, which is the same shape every other
    lookup in this service has.
    """
    family_id = _adult(p)
    found = await db.push_tokens.find_one({"token": token, "familyId": family_id})
    if not found:
        raise NotFound("No such notification token on this account.")
    await push_tokens.delete(db, token)
