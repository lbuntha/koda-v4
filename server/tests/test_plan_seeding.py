"""Seeding a plan: what a row already sold, and what the code has since added.

The bug this pins is quiet and expensive. `course.premium` joined the Family
plan in code after the first deployments had written their rows, and seeding
only ever inserted — so a family paying for Family kept meeting the padlock on
lesson eleven, with the upgrade dialog naming the very plan they were on.
"""

from app.plan_defaults import DEFAULT_PLANS
from app.repos import plans as plans_repo

FAMILY = next(plan for plan in DEFAULT_PLANS if plan["planId"] == "family")


async def test_seeding_creates_a_plan_that_is_not_there(db):
    created = await plans_repo.seed_default(db, FAMILY)

    row = await db.plans.find_one({"_id": "family"})
    assert created is True
    assert set(row["features"]) == set(FAMILY["features"])
    assert set(row["knownFeatures"]) == set(FAMILY["features"]), "what this row has been offered"


async def test_a_feature_added_later_reaches_a_plan_already_sold(db):
    """The row as a deployment seeded before `course.premium` existed."""
    await db.plans.insert_one(
        {"_id": "family", "name": "Family", "priceCents": 500, "features": ["ai.koda"]}
    )

    created = await plans_repo.seed_default(db, FAMILY)

    row = await db.plans.find_one({"_id": "family"})
    assert created is False
    assert set(row["features"]) == set(FAMILY["features"])


async def test_a_feature_an_operator_removed_stays_removed(db):
    await plans_repo.seed_default(db, FAMILY)
    await db.plans.update_one({"_id": "family"}, {"$set": {"features": ["course.premium"]}})

    await plans_repo.seed_default(db, FAMILY)

    row = await db.plans.find_one({"_id": "family"})
    assert row["features"] == ["course.premium"], "an operator's removal is a decision, not drift"


async def test_seeding_twice_changes_nothing(db):
    await plans_repo.seed_default(db, FAMILY)
    before = await db.plans.find_one({"_id": "family"})

    await plans_repo.seed_default(db, FAMILY)

    assert (await db.plans.find_one({"_id": "family"})) == before
