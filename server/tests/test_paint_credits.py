"""Pictures from photos: the family's monthly allowance.

What money depends on: no plan, no pictures; the allowance is shared by the
family and stops at the operator's number; a failed drawing gives its picture
back; and a new month starts again without anybody running a job.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.common import now
from app.plan_defaults import DEFAULT_PLANS
from app.repos import photo_credits
from app.repos import plans as plans_repo
from app.repos import subscriptions as subs_repo
from app.repos import system as system_repo
from app.system_defaults import DEFAULT_SETTINGS


async def _paid_family(db, client, signup_body, email="parent@example.com", *, paid=True):
    for plan in DEFAULT_PLANS:
        await plans_repo.seed_default(db, plan)
    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)
    tokens = (await client.post("/auth/signup", json=signup_body(email=email))).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}
    family_id = (await client.get("/auth/me", headers=auth)).json()["familyId"]
    if paid:
        await subs_repo.set_plan(
            db, family_id, plan_id="family", status="active", current_period_end=now() + timedelta(days=30), actor_id="test"
        )
    return auth, family_id


@pytest.mark.asyncio
async def test_a_family_without_ai_gets_no_pictures(db, client, signup_body):
    auth, _ = await _paid_family(db, client, signup_body, paid=False)
    assert (await client.get("/paint/photo-credits", headers=auth)).status_code == 402
    spent = await client.post("/paint/photo-credits/spend", headers=auth)
    assert spent.status_code == 402
    assert spent.json()["error"]["code"] == "plan_required"


@pytest.mark.asyncio
async def test_a_paid_family_spends_down_to_the_operators_number(db, client, signup_body):
    auth, _ = await _paid_family(db, client, signup_body)
    await system_repo.set_value(db, "paint.photoCreditsPerMonth", "2", "test")

    state = (await client.get("/paint/photo-credits", headers=auth)).json()
    assert (state["limit"], state["used"], state["left"]) == (2, 0, 2)

    assert (await client.post("/paint/photo-credits/spend", headers=auth)).json()["left"] == 1
    assert (await client.post("/paint/photo-credits/spend", headers=auth)).json()["left"] == 0
    out = await client.post("/paint/photo-credits/spend", headers=auth)
    assert out.status_code == 402
    assert out.json()["error"]["code"] == "no_credits"


@pytest.mark.asyncio
async def test_a_failed_drawing_gives_its_picture_back(db, client, signup_body):
    auth, _ = await _paid_family(db, client, signup_body)
    await client.post("/paint/photo-credits/spend", headers=auth)
    after = (await client.post("/paint/photo-credits/refund", headers=auth)).json()
    assert after["used"] == 0
    # Never below zero, however many times it is asked.
    assert (await client.post("/paint/photo-credits/refund", headers=auth)).json()["used"] == 0


@pytest.mark.asyncio
async def test_zero_switches_it_off_and_nonsense_falls_back_to_the_default(db, client, signup_body):
    auth, _ = await _paid_family(db, client, signup_body)
    await system_repo.set_value(db, "paint.photoCreditsPerMonth", "0", "test")
    assert (await client.post("/paint/photo-credits/spend", headers=auth)).status_code == 402

    await system_repo.set_value(db, "paint.photoCreditsPerMonth", "lots", "test")
    assert (await client.get("/paint/photo-credits", headers=auth)).json()["limit"] == 30


@pytest.mark.asyncio
async def test_each_month_starts_again_and_families_do_not_share(db):
    may = "2026-05"
    june = "2026-06"
    assert await photo_credits.spend(db, "fam-a", 1, may) == 1
    assert await photo_credits.spend(db, "fam-a", 1, may) is None
    assert await photo_credits.spend(db, "fam-a", 1, june) == 1
    assert await photo_credits.spend(db, "fam-b", 1, may) == 1
    assert photo_credits.month_of(datetime(2026, 10, 16, tzinfo=UTC)) == "2026-10"
