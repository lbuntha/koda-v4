"""Plans, subscriptions and what a family may use.

Three audiences, three shapes of route:

* **A family** reads its own entitlements — no permission named, because the
  token decides whose they are. This is what the app draws its "Ask Koda is on
  the Family plan" notices from.
* **An operator** edits the plan catalogue and grants subscriptions. Behind
  `system:write`, the same right as the deployment switchboard, because this is
  the same job: running the service rather than running one family.
* **The tutor proxy** asks whether a family may use a feature. It holds the
  caller's own token, so it is answered by the same route the family uses.

There is no payment here. A grant has an end date and lapses when it passes —
see `plan_defaults` for why that is the design and not an omission.
"""

import re
from datetime import datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import Conflict, NotFound
from app.models.auth import Principal
from app.models.common import Model, now
from app.plan_defaults import FEATURE_IDS, FREE_PLAN, PLAN_FEATURES
from app.repos import families as families_repo
from app.repos import plans as plans_repo
from app.repos import subscriptions as subs_repo
from app.security import principal_can
from app.services.entitlements import entitlements

router = APIRouter(prefix="/billing", tags=["billing"], dependencies=[AUTHENTICATED])

CanOperate = Annotated[Principal, Depends(require("system:write"))]


class FeatureOut(Model):
    feature_id: str = Field(alias="featureId")
    label: str
    description: str


class PlanOut(Model):
    plan_id: str = Field(alias="planId")
    name: str
    description: str
    price_cents: int = Field(alias="priceCents")
    currency: str
    learner_limit: int = Field(alias="learnerLimit")
    features: list[str]
    order: int


class PlanIn(Model):
    """A plan's numbers. Absent fields are left as they are."""

    name: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = Field(default=None, max_length=200)
    price_cents: int | None = Field(default=None, ge=0, le=1_000_00, alias="priceCents")
    learner_limit: int | None = Field(default=None, ge=1, le=100, alias="learnerLimit")
    features: list[str] | None = Field(default=None, max_length=50)
    order: int | None = Field(default=None, ge=0, le=1000)


class PlanCreate(PlanIn):
    plan_id: str = Field(min_length=2, max_length=32, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", alias="planId")


class EntitlementsOut(Model):
    plan_id: str = Field(alias="planId")
    plan_name: str = Field(alias="planName")
    description: str
    price_cents: int = Field(alias="priceCents")
    currency: str
    features: list[str]
    learner_limit: int = Field(alias="learnerLimit")
    learners_used: int = Field(alias="learnersUsed")
    can_add_learner: bool = Field(alias="canAddLearner")
    status: str
    renews_at: str | None = Field(default=None, alias="renewsAt")
    source: str | None = None


class SubscriptionRow(Model):
    family_id: str = Field(alias="familyId")
    family_name: str = Field(alias="familyName")
    #: Who owns this family, so an operator can tell two "Smith Family" rows
    #: apart — and find the one belonging to an account they have the email for,
    #: which is the only handle anybody actually has when testing. Both, because
    #: a name is what somebody says on a support call and an address is what
    #: identifies the account: neither alone is enough to act on.
    owner_email: str | None = Field(default=None, alias="ownerEmail")
    owner_name: str | None = Field(default=None, alias="ownerName")
    plan_id: str = Field(alias="planId")
    plan_name: str = Field(alias="planName")
    status: str
    renews_at: str | None = Field(default=None, alias="renewsAt")
    learners_used: int = Field(alias="learnersUsed")
    learner_limit: int = Field(alias="learnerLimit")
    #: What is being honoured, which an expired row's `status` does not say.
    live: bool


class GrantIn(Model):
    plan_id: str = Field(alias="planId")
    status: Literal["active", "trialing", "cancelled", "past_due"] = "active"
    #: How long to grant it for. `None` never expires — for a school or a
    #: deployment's own account.
    months: int | None = Field(default=1, ge=0, le=120)
    note: str | None = Field(default=None, max_length=200)


def _plan_out(row: dict[str, Any]) -> PlanOut:
    return PlanOut(
        planId=row["_id"],
        name=row.get("name", row["_id"]),
        description=row.get("description", ""),
        priceCents=int(row.get("priceCents", 0)),
        currency=row.get("currency", "USD"),
        learnerLimit=int(row.get("learnerLimit", 1)),
        features=list(row.get("features", [])),
        order=int(row.get("order", 100)),
    )


# ---- What this family may use -------------------------------------------


@router.get("/me")
async def my_entitlements(db: Db, p: CurrentPrincipal) -> EntitlementsOut:
    """What the caller may use — including the tutor proxy, which asks this.

    Operators are answered as staff: they run the deployment, they have no
    family to put on a plan, and they still have to be able to open Ask Koda
    and see what a paying family gets. It is the same right that already lets
    them grant a family the feature outright, two routes below.
    """
    return EntitlementsOut(
        **await entitlements(db, p.family_id, staff=principal_can(p, "system:write"))
    )


@router.get("/plans")
async def plan_catalogue(db: Db, p: CurrentPrincipal) -> dict[str, Any]:
    """Every plan, and every feature a plan can carry.

    Readable by anyone signed in: a family being asked to upgrade has to be able
    to see what they would be buying, and none of it is a secret.
    """
    return {
        "plans": [_plan_out(row) for row in await plans_repo.listing(db)],
        "features": [
            FeatureOut(
                featureId=feature["featureId"],
                label=feature["label"],
                description=feature["description"],
            )
            for feature in sorted(PLAN_FEATURES, key=lambda f: f["order"])
        ],
    }


# ---- Running the catalogue ----------------------------------------------


@router.patch("/plans/{plan_id}")
async def edit_plan(plan_id: str, body: PlanIn, db: Db, p: CanOperate) -> PlanOut:
    patch = body.model_dump(by_alias=True, exclude_unset=True)
    if "features" in patch:
        # A plan may only promise what something enforces.
        unknown = set(patch["features"]) - FEATURE_IDS
        if unknown:
            raise Conflict(f"No such feature: {', '.join(sorted(unknown))}.", "unknown_feature")
        patch["features"] = sorted(set(patch["features"]))
    if plan_id == FREE_PLAN and patch.get("features"):
        # The floor every lapsed subscription falls back to. A free plan that
        # includes a paid feature means nobody ever needs to subscribe.
        raise Conflict("The free plan cannot include paid features.", "free_plan_features")

    row = await plans_repo.update(db, plan_id, patch)
    if not row:
        raise NotFound("No such plan.")
    return _plan_out(row)


@router.post("/plans", status_code=201)
async def add_plan(body: PlanCreate, db: Db, p: CanOperate) -> PlanOut:
    """A fourth plan — a school tier, an annual price.

    Safe to allow because a plan is only a price, a limit and a set of features
    the code already enforces; there is no way to express one nothing honours.
    """
    if await plans_repo.by_id(db, body.plan_id):
        raise Conflict("A plan with that id already exists.", "plan_exists")
    features = sorted(set(body.features or []))
    unknown = set(features) - FEATURE_IDS
    if unknown:
        raise Conflict(f"No such feature: {', '.join(sorted(unknown))}.", "unknown_feature")

    await plans_repo.seed_default(
        db,
        {
            "planId": body.plan_id,
            "name": body.name or body.plan_id.title(),
            "description": body.description or "",
            "priceCents": body.price_cents or 0,
            "currency": "USD",
            "learnerLimit": body.learner_limit or 1,
            "features": features,
            "order": body.order if body.order is not None else 100,
        },
    )
    row = await plans_repo.by_id(db, body.plan_id)
    assert row is not None
    return _plan_out(row)


# ---- Granting a subscription --------------------------------------------


@router.get("/subscriptions")
async def subscription_listing(
    db: Db,
    p: CanOperate,
    query: str = Query(default="", max_length=80),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, list[SubscriptionRow]]:
    """Every family and what they are on, newest first.

    Searchable by family name, by the owner's name, or by their email address —
    all three, because they are the handles an operator actually has. A support
    request names the person; the deployment's own test account is easiest to
    find by the address it was signed up with; and neither is the family name,
    which is often something a parent typed once and never thought about again.
    """
    needle = query.strip()
    selector: dict[str, Any] = {}
    if needle:
        # An email match is resolved to owner ids first: `families` holds an
        # `ownerId`, not an address, so there is nothing to regex against here.
        pattern = {"$regex": re.escape(needle), "$options": "i"}
        owner_ids = await db.users.distinct(
            "_id", {"$or": [{"email": pattern}, {"displayName": pattern}]}
        )
        selector["$or"] = [
            {"name": pattern},
            {"ownerId": {"$in": owner_ids}},
        ]

    family_rows = await db.families.find(selector).sort("createdAt", -1).to_list(length=limit)
    plans = {row["_id"]: row for row in await plans_repo.listing(db)}

    # One query for every owner rather than one per row: this list is fifty
    # families wide and a lookup inside the loop would be fifty round trips.
    owner_ids = [row["ownerId"] for row in family_rows if row.get("ownerId")]
    owners = {
        row["_id"]: {"email": row.get("email"), "name": row.get("displayName")}
        for row in (
            await db.users.find({"_id": {"$in": owner_ids}}).to_list(length=len(owner_ids))
            if owner_ids
            else []
        )
    }

    out: list[SubscriptionRow] = []
    for family in family_rows:
        state = await entitlements(db, family["_id"])
        row = await subs_repo.for_family(db, family["_id"])
        named = plans.get((row or {}).get("planId", FREE_PLAN), {})
        ends = (row or {}).get("currentPeriodEnd")
        out.append(
            SubscriptionRow(
                familyId=family["_id"],
                familyName=family.get("name", "Family"),
                ownerEmail=(owners.get(family.get("ownerId")) or {}).get("email"),
                ownerName=(owners.get(family.get("ownerId")) or {}).get("name"),
                # What they were sold, beside what is being honoured — an
                # expired grant reads "active" on the row and free in practice.
                planId=(row or {}).get("planId", FREE_PLAN),
                planName=named.get("name", "Free"),
                status=state["status"],
                renewsAt=ends.isoformat() if ends else None,
                learnersUsed=state["learnersUsed"],
                learnerLimit=state["learnerLimit"],
                live=state["planId"] != FREE_PLAN,
            )
        )
    return {"subscriptions": out}


@router.put("/subscriptions/{family_id}")
async def grant(family_id: str, body: GrantIn, db: Db, p: CanOperate) -> SubscriptionRow:
    """Put a family on a plan for a number of months, or take them off one."""
    family = await families_repo.by_id(db, family_id)
    if not family:
        raise NotFound("No such family.")
    plan = await plans_repo.by_id(db, body.plan_id)
    if not plan:
        raise NotFound("No such plan.")

    # `months=0` or no months means open-ended: granted until somebody says
    # otherwise, which is what a deployment's own account wants.
    ends: datetime | None = None
    if body.months:
        ends = now() + timedelta(days=30 * body.months)

    await subs_repo.set_plan(
        db,
        family_id,
        plan_id=body.plan_id,
        status=body.status,
        current_period_end=ends,
        actor_id=p.subject_id,
        note=body.note,
    )
    state = await entitlements(db, family_id)
    return SubscriptionRow(
        familyId=family_id,
        familyName=family.get("name", "Family"),
        planId=body.plan_id,
        planName=plan.get("name", body.plan_id),
        status=state["status"],
        renewsAt=ends.isoformat() if ends else None,
        learnersUsed=state["learnersUsed"],
        learnerLimit=state["learnerLimit"],
        live=state["planId"] != FREE_PLAN,
    )
