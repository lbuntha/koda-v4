"""The deployment's reward rules: what a round pays, and what a badge takes.

Read by everybody, written by an operator. A child's device has to know what a
star is worth before it can score a round, so the GET names no permission — and
none of it is a secret. The PUT is `system:write`, the same right as the
switchboard and for the same reason: one answer for every family.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import defaults as defaults_repo

router = APIRouter(prefix="/defaults", tags=["defaults"], dependencies=[AUTHENTICATED])

CanOperate = Annotated[Principal, Depends(require("system:write"))]


class RuleIn(Model):
    """Whatever the owning store's config looks like.

    Deliberately untyped: `scoring.ts` and `badges.ts` already sanitise on read,
    so a second schema here would be a second opinion about the same thing — and
    the one that drifts is always the one further from the code that uses it.
    """

    value: dict[str, Any]


@router.get("")
async def listing(db: Db, p: CurrentPrincipal) -> dict[str, Any]:
    return {"defaults": await defaults_repo.all_defaults(db)}


@router.put("/{kind}")
async def save(kind: str, body: RuleIn, db: Db, p: CanOperate) -> dict[str, Any]:
    if kind not in defaults_repo.DEFAULT_KINDS:
        raise NotFound(f"No such rule: {kind}.")
    return {"kind": kind, "value": await defaults_repo.put(db, kind, body.value, p.subject_id)}
