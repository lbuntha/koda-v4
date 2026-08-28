"""Parent-managed child profiles and device pairing."""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, Db, require
from app.errors import Conflict, NotFound, PaymentRequired
from app.models.auth import Principal
from app.models.common import Model, now
from app.repos import learners
from app.services.codes import hash_code, new_code
from app.services.entitlements import entitlements

router = APIRouter(prefix="/learners", tags=["learners"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("learner:read"))]
CanCreate = Annotated[Principal, Depends(require("learner:create"))]
CanUpdate = Annotated[Principal, Depends(require("learner:update"))]
CanDelete = Annotated[Principal, Depends(require("learner:delete"))]


class LearnerIn(Model):
    display_name: str = Field(min_length=1, max_length=80, alias="displayName")
    birth_year: int | None = Field(default=None, ge=1900, le=2100, alias="birthYear")


class LearnerOut(Model):
    id: str
    display_name: str = Field(alias="displayName")
    avatar_seed: str = Field(alias="avatarSeed")
    birth_year: int | None = Field(default=None, alias="birthYear")
    created_at: str = Field(alias="createdAt")
    has_active_code: bool = Field(alias="hasActiveCode")


class JoinCodeOut(Model):
    learner: LearnerOut
    code: str
    expires_at: str = Field(alias="expiresAt")


def _out(row: dict) -> LearnerOut:
    return LearnerOut(
        id=row["_id"],
        displayName=row["displayName"],
        avatarSeed=row.get("avatarSeed") or row["_id"],
        birthYear=row.get("birthYear"),
        createdAt=row["createdAt"].isoformat(),
        hasActiveCode=bool(row.get("joinCodeExpiresAt") and row["joinCodeExpiresAt"] > now()),
    )


@router.get("")
async def listing(db: Db, p: CanRead) -> dict[str, list[LearnerOut]]:
    if p.family_id is None:
        return {"learners": []}
    rows = await learners.for_family(db, p.family_id)
    if p.learner_id:
        rows = [row for row in rows if row["_id"] == p.learner_id]
    for row in rows:
        row["avatarSeed"] = await learners.ensure_avatar_seed(db, row["_id"], p.family_id)
    return {"learners": [_out(row) for row in rows]}


@router.post("", status_code=201)
async def create_learner(body: LearnerIn, db: Db, p: CanCreate) -> LearnerOut:
    if p.family_id is None:
        raise Conflict("This account is not part of a family.", "no_family")

    # The plan's child limit, checked here rather than only in the UI. A hidden
    # "Add child" button is a hint; this is the rule, and it is the one place a
    # family can grow, so it is the only place the limit has to hold.
    state = await entitlements(db, p.family_id)
    if not state["canAddLearner"]:
        raise PaymentRequired(
            f"The {state['planName']} plan covers {state['learnerLimit']} "
            f"{'child' if state['learnerLimit'] == 1 else 'children'}. "
            "Upgrade to add another.",
            "plan_learner_limit",
        )

    return _out(await learners.create(db, p.family_id, body.display_name, body.birth_year))


@router.patch("/{learner_id}")
async def update_learner(learner_id: str, body: LearnerIn, db: Db, p: CanUpdate) -> LearnerOut:
    if p.family_id is None:
        raise NotFound("No such child.")
    row = await learners.update(
        db,
        learner_id,
        p.family_id,
        {"displayName": body.display_name.strip(), "birthYear": body.birth_year},
    )
    if not row:
        raise NotFound("No such child.")
    return _out(row)


@router.delete("/{learner_id}", status_code=204)
async def delete_learner(learner_id: str, db: Db, p: CanDelete) -> None:
    if p.family_id is None or not await learners.remove(db, learner_id, p.family_id):
        raise NotFound("No such child.")
    await db.devices.update_many(
        {"familyId": p.family_id, "learnerId": learner_id, "revokedAt": None},
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    await db.events.delete_many({"familyId": p.family_id, "learnerId": learner_id})
    await db.docs.delete_many({"familyId": p.family_id, "learnerId": learner_id})
    await db.concept_totals.delete_many({"familyId": p.family_id, "learnerId": learner_id})


@router.post("/{learner_id}/join-code")
async def create_join_code(learner_id: str, db: Db, p: CanUpdate) -> JoinCodeOut:
    if p.family_id is None:
        raise NotFound("No such child.")
    code = new_code()
    expires_at = now() + timedelta(minutes=15)
    row = await learners.issue_code(db, learner_id, p.family_id, hash_code(code), expires_at)
    if not row:
        raise NotFound("No such child.")
    return JoinCodeOut(learner=_out(row), code=code, expiresAt=expires_at.isoformat())
