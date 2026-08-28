"""What a family may actually do, right now.

One function, because the alternative is every route deciding for itself what
"subscribed" means — and the day the learner route and the tutor proxy disagree
is the day a family pays for something they cannot use, or uses something they
have not paid for.

The rule it applies, in order:

1. No subscription row, or a plan that no longer exists → the free plan.
2. A row whose status is not live (cancelled, past_due) → the free plan.
3. A row whose `currentPeriodEnd` has passed → the free plan.
4. Otherwise the plan on the row.

With one account outside all of it: a member of staff, who has no family and
therefore no row, and holds every feature on the strength of `system:write`.

Lapsing rather than deleting is deliberate: the row stays, so an operator can
see what a family had and when it ran out, and re-granting is one write rather
than an archaeology exercise.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now
from app.plan_defaults import FEATURE_IDS, FREE_PLAN, LIVE_STATUSES
from app.repos import learners as learners_repo
from app.repos import plans as plans_repo
from app.repos import subscriptions as subs_repo


async def _free_plan(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """The floor. Hard-coded values only if even the catalogue is missing, which
    would mean a half-seeded database — an app that still runs beats one that
    500s on every page."""
    plan = await plans_repo.by_id(db, FREE_PLAN)
    return plan or {
        "_id": FREE_PLAN,
        "name": "Free",
        "description": "",
        "priceCents": 0,
        "currency": "USD",
        "learnerLimit": 1,
        "features": [],
    }


def is_live(row: dict[str, Any] | None) -> bool:
    """Whether a subscription row is actually being honoured, right now.

    Pulled out of `effective_plan` so the one place that decides "is this family
    paying" is the one place every caller asks — the admin lists resolve a whole
    page of families at once and cannot call `effective_plan` per row without a
    query each, and a second copy of this rule is how a page comes to show
    "Family" beside a grant that ran out last week.
    """
    if row is None or row.get("status") not in LIVE_STATUSES:
        return False
    ends = row.get("currentPeriodEnd")
    # No end date means an open-ended grant — a school, or the deployment's own
    # account — which is honoured until somebody says otherwise.
    return ends is None or ends > now()


async def effective_plan(
    db: AsyncIOMotorDatabase, family_id: str | None
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """The plan in force for a family, and the subscription row behind it.

    Staff have no family, so they get the free plan and no row — their access to
    the app's admin surfaces comes from platform rights, never from a purchase.
    """
    if family_id is None:
        return await _free_plan(db), None

    row = await subs_repo.for_family(db, family_id)
    if row is None:
        return await _free_plan(db), None
    if not is_live(row):
        # Lapsed, cancelled or past due. The row stays so an operator can see
        # what a family had and when it ran out — see the module docstring.
        return await _free_plan(db), row

    plan = await plans_repo.by_id(db, row.get("planId", FREE_PLAN))
    return plan or await _free_plan(db), row


#: What an operator's own account is called, since it is not on a plan.
STAFF_PLAN = "staff"


async def entitlements(
    db: AsyncIOMotorDatabase, family_id: str | None, *, staff: bool = False
) -> dict[str, Any]:
    """Everything a caller needs to decide what to allow or draw.

    `staff` is whoever runs the deployment — the `system:write` right, the same
    one that owns the switchboard and the plan catalogue. They belong to no
    family and so buy nothing, which used to mean the one person who has to be
    able to try Ask Koda before selling it was the only person who never could.
    They get every feature the catalogue can carry, and no learner allowance,
    because their access is to the *product*, not to anybody's children.
    """
    plan, row = await effective_plan(db, family_id)
    used = len(await learners_repo.for_family(db, family_id)) if family_id else 0
    limit = int(plan.get("learnerLimit", 1))
    ends = row.get("currentPeriodEnd") if row else None

    # An operator with no family is not on the free plan, they are off the
    # catalogue entirely — saying "Free" and then showing Ask Koda included
    # reads as a bug in the billing screen rather than as a staff account.
    staff_only = staff and family_id is None

    return {
        "planId": STAFF_PLAN if staff_only else plan.get("_id", FREE_PLAN),
        "planName": "Staff" if staff_only else plan.get("name", "Free"),
        "description": "Everything the product does, for whoever runs it."
        if staff_only
        else plan.get("description", ""),
        "priceCents": int(plan.get("priceCents", 0)),
        "currency": plan.get("currency", "USD"),
        # What this family has bought — or, for staff, everything there is to
        # buy. Callers ask "is `x` in here" rather than reading a named flag, so
        # a plan gaining a feature needs no change to anything that consumes
        # this, and neither does an operator's account.
        "features": sorted(set(plan.get("features", [])) | FEATURE_IDS)
        if staff
        else list(plan.get("features", [])),
        "learnerLimit": limit,
        "learnersUsed": used,
        # The question every "Add child" button is really asking.
        "canAddLearner": used < limit,
        # What the row *says*, which is not always what is being honoured — an
        # expired row still reads "active" until somebody changes it, and the
        # billing screen should be able to show that difference.
        "status": "staff" if staff_only else (row or {}).get("status", "none"),
        "renewsAt": ends.isoformat() if ends else None,
        "source": "staff" if staff_only else (row or {}).get("source"),
    }


async def has_feature(
    db: AsyncIOMotorDatabase, family_id: str | None, feature_id: str, *, staff: bool = False
) -> bool:
    """Whether this family's plan includes a feature.

    The question every gate asks, so no route has to know what a plan is — only
    what it needs. A family with no subscription has no features, which is why
    the free plan ships with an empty list rather than a set of `False` flags.
    """
    if staff:
        # Same rule as `entitlements` above, and stated once more rather than
        # left implied: an operator holds every feature there is.
        return feature_id in FEATURE_IDS
    plan, _ = await effective_plan(db, family_id)
    return feature_id in set(plan.get("features", []))
