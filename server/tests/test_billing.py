"""Plans, and what they actually let a family do.

The rules worth asserting are the ones money depends on: a free family gets one
child and no AI, a paid one gets what it paid for, and a grant that has run out
stops counting the moment it does — without anybody running a job at midnight.
"""

from datetime import timedelta

import pytest

from app.models.common import now
from app.plan_defaults import DEFAULT_PLANS, PLAN_FEATURES
from app.repos import plans as plans_repo
from app.repos import platform_roles as platform_roles_repo
from app.repos import subscriptions as subs_repo
from app.role_defaults import DEFAULT_PLATFORM_ROLES
from app.services.entitlements import entitlements, has_feature


def _shipped(plan_id: str) -> dict:
    """The plan as the code ships it.

    For tests about *granting* rather than about which features exist this
    month: a literal list of features turns every new one into a failure in a
    test that is not about features at all.
    """
    return next(plan for plan in DEFAULT_PLANS if plan["planId"] == plan_id)


async def _seed_plans(db):
    for plan in DEFAULT_PLANS:
        await plans_repo.seed_default(db, plan)


async def _operator(db, client):
    """A staff account with no family — the only kind that runs the service.

    Not a family owner with `platformRole: admin`: signing in through a family
    deliberately drops platform rights (`auth.py`), so an operator has no
    membership at all. Which is also why the Billing tab is invisible to the
    account that owns a family, however senior they are inside it.
    """
    from app.repos import users
    from app.security import passwords

    # The fixture skips the app's lifespan, so the roles a real deployment
    # seeds at boot have to be put here before one can be held.
    for role in DEFAULT_PLATFORM_ROLES:
        await platform_roles_repo.seed_default(db, role)

    await users.create(
        db, "operator@example.com", passwords.hash_password("123456"), platform_role="admin"
    )
    tokens = (
        await client.post(
            "/auth/login", json={"email": "operator@example.com", "password": "123456"}
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def _family(client, signup_body, email="parent@example.com"):
    """A signed-up owner, and the family they now own."""
    tokens = (await client.post("/auth/signup", json=signup_body(email=email))).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}
    me = (await client.get("/auth/me", headers=auth)).json()
    return auth, me["familyId"]


@pytest.mark.asyncio
async def test_a_family_with_no_subscription_is_on_the_free_plan(db, client, signup_body):
    await _seed_plans(db)
    _, family_id = await _family(client, signup_body)

    state = await entitlements(db, family_id)
    assert state["planId"] == "free"
    assert state["learnerLimit"] == 1
    assert state["features"] == []
    assert await has_feature(db, family_id, "ai.koda") is False


@pytest.mark.asyncio
async def test_free_plan_allows_one_child_and_refuses_the_second(db, client, signup_body):
    await _seed_plans(db)
    auth, _ = await _family(client, signup_body)

    first = await client.post("/learners", headers=auth, json={"displayName": "Thana"})
    assert first.status_code == 201, first.text

    second = await client.post("/learners", headers=auth, json={"displayName": "Jutta"})
    # 402 rather than 403: they may add children, their plan does not cover one.
    assert second.status_code == 402, second.text
    assert second.json()["error"]["code"] == "plan_learner_limit"


@pytest.mark.asyncio
async def test_a_paid_plan_lifts_the_limit_and_turns_koda_on(db, client, signup_body):
    await _seed_plans(db)
    auth, family_id = await _family(client, signup_body)
    await subs_repo.set_plan(
        db,
        family_id,
        plan_id="family",
        status="active",
        current_period_end=now() + timedelta(days=30),
        actor_id="test",
    )

    state = await entitlements(db, family_id)
    assert state["planId"] == "family"
    assert state["learnerLimit"] == 3
    assert await has_feature(db, family_id, "ai.koda") is True

    for name in ("Thana", "Jutta", "Mia"):
        created = await client.post("/learners", headers=auth, json={"displayName": name})
        assert created.status_code == 201, created.text

    # Three is what was bought, so the fourth is refused just as the second was.
    fourth = await client.post("/learners", headers=auth, json={"displayName": "Sam"})
    assert fourth.status_code == 402


@pytest.mark.asyncio
async def test_a_grant_stops_counting_when_its_period_passes(db, client, signup_body):
    await _seed_plans(db)
    _, family_id = await _family(client, signup_body)
    await subs_repo.set_plan(
        db,
        family_id,
        plan_id="family",
        status="active",
        # Yesterday. Nothing ran to expire it; it simply is not honoured.
        current_period_end=now() - timedelta(days=1),
        actor_id="test",
    )

    state = await entitlements(db, family_id)
    assert state["planId"] == "free"
    assert await has_feature(db, family_id, "ai.koda") is False
    # The row still says what it was sold as, which is what an operator needs
    # to see to know the difference between "never paid" and "lapsed".
    assert state["status"] == "active"


@pytest.mark.asyncio
async def test_a_cancelled_subscription_is_not_honoured_even_inside_its_period(
    db, client, signup_body
):
    await _seed_plans(db)
    _, family_id = await _family(client, signup_body)
    await subs_repo.set_plan(
        db,
        family_id,
        plan_id="family",
        status="cancelled",
        current_period_end=now() + timedelta(days=30),
        actor_id="test",
    )

    assert (await entitlements(db, family_id))["planId"] == "free"


@pytest.mark.asyncio
async def test_a_grant_with_no_end_date_never_lapses(db, client, signup_body):
    await _seed_plans(db)
    _, family_id = await _family(client, signup_body)
    await subs_repo.set_plan(
        db,
        family_id,
        plan_id="family",
        status="active",
        current_period_end=None,
        actor_id="test",
    )

    state = await entitlements(db, family_id)
    assert state["planId"] == "family"
    assert state["renewsAt"] is None


@pytest.mark.asyncio
async def test_a_family_reads_its_own_plan_but_cannot_run_the_catalogue(
    db, client, signup_body
):
    await _seed_plans(db)
    auth, _ = await _family(client, signup_body)

    mine = await client.get("/billing/me", headers=auth)
    assert mine.status_code == 200
    assert mine.json()["planName"] == "Free"

    # Readable: a family being asked to upgrade has to see what they would buy.
    catalogue = await client.get("/billing/plans", headers=auth)
    assert catalogue.status_code == 200
    assert {p["planId"] for p in catalogue.json()["plans"]} == {"free", "family"}

    # Not theirs to change — an owner runs a family, not the service.
    edit = await client.patch("/billing/plans/family", headers=auth, json={"priceCents": 0})
    assert edit.status_code == 403

    grants = await client.get("/billing/subscriptions", headers=auth)
    assert grants.status_code == 403


@pytest.mark.asyncio
async def test_an_operator_holds_every_feature_without_buying_one(db, client, signup_body):
    """The account that runs the deployment can try what it sells.

    Staff have no family and so no subscription, which read as the free plan and
    left the one person who has to be able to test Ask Koda as the only one who
    could not. `system:write` answers for it — the same right that grants a
    family the feature outright.
    """
    await _seed_plans(db)
    admin = await _operator(db, client)

    mine = await client.get("/billing/me", headers=admin)
    assert mine.status_code == 200
    body = mine.json()
    assert "ai.koda" in body["features"]
    # Not "Free with Ask Koda included", which reads as a broken billing screen.
    assert body["planId"] == "staff"
    assert body["planName"] == "Staff"
    assert body["source"] == "staff"

    assert await has_feature(db, None, "ai.koda", staff=True) is True
    # And nothing changed for anybody who is not staff.
    assert await has_feature(db, None, "ai.koda") is False


@pytest.mark.asyncio
async def test_staff_access_does_not_leak_to_a_family_owner(db, client, signup_body):
    """However senior an adult is inside a family, they still have to pay.

    Signing in through a family drops platform rights, so this is the shape of
    mistake the staff path could make: an owner is not an operator.
    """
    await _seed_plans(db)
    auth, _ = await _family(client, signup_body)

    mine = await client.get("/billing/me", headers=auth)
    assert mine.status_code == 200
    assert mine.json()["planName"] == "Free"
    assert mine.json()["features"] == []


@pytest.mark.asyncio
async def test_the_free_plan_cannot_be_given_paid_features(db, client, signup_body):
    """The floor every lapsed subscription falls back to.

    If free could include `ai.koda`, an expired grant would keep working and
    nobody would ever need to pay — the failure would be silent and total.
    """
    await _seed_plans(db)
    admin = await _operator(db, client)

    refused = await client.patch(
        "/billing/plans/free", headers=admin, json={"features": ["ai.koda"]}
    )
    assert refused.status_code == 409, refused.text
    assert refused.json()["error"]["code"] == "free_plan_features"

    # And a feature nothing enforces cannot be promised at all.
    unknown = await client.patch(
        "/billing/plans/family", headers=admin, json={"features": ["ai.telepathy"]}
    )
    assert unknown.status_code == 409
    assert unknown.json()["error"]["code"] == "unknown_feature"


@pytest.mark.asyncio
async def test_an_operator_grants_a_plan_and_the_family_feels_it(db, client, signup_body):
    await _seed_plans(db)
    admin = await _operator(db, client)
    family_auth, family_id = await _family(client, signup_body)

    before = (await client.get("/billing/me", headers=family_auth)).json()
    assert before["planId"] == "free"
    assert before["canAddLearner"] is True

    granted = await client.put(
        f"/billing/subscriptions/{family_id}",
        headers=admin,
        json={"planId": "family", "months": 1, "status": "active"},
    )
    assert granted.status_code == 200, granted.text
    assert granted.json()["live"] is True

    after = (await client.get("/billing/me", headers=family_auth)).json()
    assert after["planId"] == "family"
    assert after["learnerLimit"] == 3
    # What the family plan ships, read from the plan rather than restated here:
    # the point of this test is that granting a plan hands over what that plan
    # carries, and a literal list turns every new feature into a failure in a
    # test that is not about features at all.
    assert after["features"] == _shipped("family")["features"]
    assert "ai.koda" in after["features"]
    assert after["renewsAt"] is not None


@pytest.mark.asyncio
async def test_the_subscription_list_names_the_person_and_is_found_by_them(
    db, client, signup_body
):
    """An operator arrives holding a person, not a family id.

    The family name is often something a parent typed once and never thought
    about again, so a list keyed only on it cannot answer "upgrade the account
    for lbuntha@example.com" — which is the only question anybody actually asks
    of this screen.
    """
    await _seed_plans(db)
    admin = await _operator(db, client)
    await _family(client, signup_body, email="mia.parent@example.com")

    listing = await client.get("/billing/subscriptions", headers=admin)
    assert listing.status_code == 200
    row = listing.json()["subscriptions"][0]
    assert row["ownerEmail"] == "mia.parent@example.com"

    # Found by the address, not only by whatever the family got called.
    by_email = await client.get(
        "/billing/subscriptions", headers=admin, params={"query": "mia.parent@"}
    )
    assert [r["familyId"] for r in by_email.json()["subscriptions"]] == [row["familyId"]]

    # And somebody else's address does not match it.
    miss = await client.get(
        "/billing/subscriptions", headers=admin, params={"query": "someone-else@example.com"}
    )
    assert miss.json()["subscriptions"] == []


@pytest.mark.asyncio
async def test_an_operator_can_add_a_plan_and_reprice_one(db, client, signup_body):
    """The two numbers an operator actually changes, and a fourth tier."""
    await _seed_plans(db)
    admin = await _operator(db, client)

    repriced = await client.patch(
        "/billing/plans/family", headers=admin, json={"priceCents": 700, "learnerLimit": 4}
    )
    assert repriced.status_code == 200, repriced.text
    assert repriced.json()["priceCents"] == 700
    assert repriced.json()["learnerLimit"] == 4

    added = await client.post(
        "/billing/plans",
        headers=admin,
        json={
            "planId": "school",
            "name": "School",
            "priceCents": 5000,
            "learnerLimit": 30,
            "features": ["ai.koda"],
        },
    )
    assert added.status_code == 201, added.text
    assert added.json()["learnerLimit"] == 30

    catalogue = (await client.get("/billing/plans", headers=admin)).json()
    assert {p["planId"] for p in catalogue["plans"]} == {"free", "family", "school"}
    # Every feature a plan can carry is declared in code, so the editor can only
    # ever offer things something enforces — which is the property worth
    # asserting, rather than today's list of them.
    assert [f["featureId"] for f in catalogue["features"]] == [
        feature["featureId"] for feature in PLAN_FEATURES
    ]


@pytest.mark.asyncio
async def test_user_management_shows_the_plan_the_family_was_granted(db, client, signup_body):
    """The plan an operator grants is the plan User Management shows.

    It showed "Free" for every family however they had been granted. The
    subscriptions collection is keyed by `_id`, and the admin listing had its
    own copy of the lookup that queried a `familyId` field the documents do not
    have — so it matched nothing, and an empty result is indistinguishable from
    "nobody is paying". Silent, and wrong on every row.

    Asserted against `/billing/subscriptions` in the same test, because the real
    fault was two endpoints disagreeing about one family: billing said Family,
    user management said Free.
    """
    await _seed_plans(db)
    admin = await _operator(db, client)
    _, family_id = await _family(client, signup_body, email="granted@example.com")

    granted = await client.put(
        f"/billing/subscriptions/{family_id}",
        headers=admin,
        json={"planId": "family", "months": 1, "status": "active"},
    )
    assert granted.status_code == 200, granted.text

    listed = await client.get("/admin/users?q=granted", headers=admin)
    assert listed.status_code == 200, listed.text
    memberships = listed.json()["users"][0]["memberships"]
    assert memberships[0]["planId"] == "family"
    assert memberships[0]["planName"] == "Family"
    assert memberships[0]["live"] is True

    # The two endpoints must not disagree about the same family.
    subs = (await client.get("/billing/subscriptions", headers=admin)).json()
    row = next(r for r in subs["subscriptions"] if r["familyId"] == family_id)
    assert row["planId"] == memberships[0]["planId"]
    assert row["live"] == memberships[0]["live"]


@pytest.mark.asyncio
async def test_a_lapsed_grant_reads_as_free_in_user_management(db, client, signup_body):
    """And the fix must not make every family look paid.

    A grant whose period has passed is not honoured, so the list has to say
    Free — the same lapse rule the tutor proxy applies, not a second copy of it.
    """
    await _seed_plans(db)
    admin = await _operator(db, client)
    _, family_id = await _family(client, signup_body, email="lapsed@example.com")

    await client.put(
        f"/billing/subscriptions/{family_id}",
        headers=admin,
        json={"planId": "family", "months": 1, "status": "active"},
    )
    # Wind the grant back past its end date, the way time would.
    await db.subscriptions.update_one(
        {"_id": family_id},
        {"$set": {"currentPeriodEnd": now() - timedelta(days=1)}},
    )

    listed = await client.get("/admin/users?q=lapsed", headers=admin)
    membership = listed.json()["users"][0]["memberships"][0]
    assert membership["planId"] == "free"
    assert membership["live"] is False


# ---- Asking for a plan ---------------------------------------------------
#
# The rule every one of these is circling: asking is not buying. Until a card
# is charged or an operator agrees, a family that pressed Upgrade must be on
# exactly the plan they were on before they pressed it.


@pytest.mark.asyncio
async def test_asking_for_a_plan_does_not_grant_it(db, client, signup_body):
    """The whole safety property of an upgrade button with no checkout behind it."""
    await _seed_plans(db)
    auth, _ = await _family(client, signup_body, email="asks@example.com")

    asked = await client.post("/billing/upgrade", headers=auth, json={"planId": "family"})
    assert asked.status_code == 200
    assert asked.json()["request"]["planName"] == "Family"

    # Nothing moved: still free, still one child, still no Ask Koda.
    mine = (await client.get("/billing/me", headers=auth)).json()
    assert mine["planId"] == "free"
    assert mine["features"] == []
    assert mine["learnerLimit"] == 1


@pytest.mark.asyncio
async def test_a_family_reads_back_the_plan_it_asked_for(db, client, signup_body):
    """So a second parent sees the ask instead of an Upgrade button."""
    await _seed_plans(db)
    auth, _ = await _family(client, signup_body, email="reads@example.com")

    assert (await client.get("/billing/upgrade", headers=auth)).json()["request"] is None

    await client.post("/billing/upgrade", headers=auth, json={"planId": "family"})
    again = (await client.get("/billing/upgrade", headers=auth)).json()["request"]
    assert again["planId"] == "family"

    await client.delete("/billing/upgrade", headers=auth)
    assert (await client.get("/billing/upgrade", headers=auth)).json()["request"] is None


@pytest.mark.asyncio
async def test_asking_twice_replaces_the_ask_rather_than_stacking_one(db, client, signup_body):
    """An operator answers one want per family, not a queue of them."""
    await _seed_plans(db)
    await plans_repo.seed_default(
        db,
        {
            "planId": "school",
            "name": "School",
            "description": "",
            "priceCents": 2000,
            "currency": "USD",
            "learnerLimit": 30,
            "features": ["ai.koda"],
            "order": 30,
        },
    )
    auth, family_id = await _family(client, signup_body, email="twice@example.com")

    await client.post("/billing/upgrade", headers=auth, json={"planId": "family"})
    await client.post("/billing/upgrade", headers=auth, json={"planId": "school"})

    assert await db.upgrade_requests.count_documents({"_id": family_id}) == 1
    assert (await client.get("/billing/upgrade", headers=auth)).json()["request"]["planId"] == "school"


@pytest.mark.asyncio
async def test_asking_for_free_or_for_the_plan_already_held_is_refused(db, client, signup_body):
    """Neither is an upgrade, and both would leave an operator a no-op to action."""
    await _seed_plans(db)
    admin = await _operator(db, client)
    auth, family_id = await _family(client, signup_body, email="silly@example.com")

    free = await client.post("/billing/upgrade", headers=auth, json={"planId": "free"})
    assert free.status_code == 409
    assert free.json()["error"]["code"] == "free_plan"

    missing = await client.post("/billing/upgrade", headers=auth, json={"planId": "nope"})
    assert missing.status_code == 404

    await client.put(
        f"/billing/subscriptions/{family_id}",
        headers=admin,
        json={"planId": "family", "months": 1, "status": "active"},
    )
    same = await client.post("/billing/upgrade", headers=auth, json={"planId": "family"})
    assert same.status_code == 409
    assert same.json()["error"]["code"] == "already_on_plan"


@pytest.mark.asyncio
async def test_an_operator_sees_the_ask_and_granting_it_clears_it(db, client, signup_body):
    """The delivery mechanism, until a card processor is the one answering."""
    await _seed_plans(db)
    admin = await _operator(db, client)
    auth, family_id = await _family(client, signup_body, email="wants@example.com")

    await client.post("/billing/upgrade", headers=auth, json={"planId": "family"})

    listed = (await client.get("/billing/subscriptions", headers=admin)).json()["subscriptions"]
    row = next(item for item in listed if item["familyId"] == family_id)
    assert row["wantsPlanId"] == "family"
    assert row["wantsPlanName"] == "Family"

    await client.put(
        f"/billing/subscriptions/{family_id}",
        headers=admin,
        json={"planId": "family", "months": 1, "status": "active"},
    )

    # Answered: the family is on the plan and nothing is still outstanding.
    assert (await client.get("/billing/me", headers=auth)).json()["planId"] == "family"
    assert (await client.get("/billing/upgrade", headers=auth)).json()["request"] is None


@pytest.mark.asyncio
async def test_granting_a_different_plan_leaves_the_ask_standing(db, client, signup_body):
    """It is the record of what the family wanted, and they did not get it."""
    await _seed_plans(db)
    await plans_repo.seed_default(
        db,
        {
            "planId": "school",
            "name": "School",
            "description": "",
            "priceCents": 2000,
            "currency": "USD",
            "learnerLimit": 30,
            "features": ["ai.koda"],
            "order": 30,
        },
    )
    admin = await _operator(db, client)
    auth, family_id = await _family(client, signup_body, email="other@example.com")

    await client.post("/billing/upgrade", headers=auth, json={"planId": "school"})
    await client.put(
        f"/billing/subscriptions/{family_id}",
        headers=admin,
        json={"planId": "family", "months": 1, "status": "active"},
    )

    still = (await client.get("/billing/upgrade", headers=auth)).json()["request"]
    assert still["planId"] == "school"
