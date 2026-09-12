"""Telling every family a skill exists, once, and never twice.

The restraint here is a different one from the reminders'. A reminder must not
become a hook; an announcement must not become a repeat — it goes to every
family on the deployment, so "once per family per skill" is the whole promise,
and an hourly job that could send it twice would be worse than one that never
sent it at all.

What is asserted is mostly the ledger: that a second run is silent, that a
preview does not spend the claim the run it is describing needs, and that a
skill published last month is not news today.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.common import now
from app.repos import notify_prefs, notify_schedule
from app.services import tasks as task_service
from app.system_defaults import DEFAULT_SETTINGS

TOKEN = "e" * 140
PLUS_TWO = 120

#: Mid-morning for a family at UTC+2 — outside anybody's quiet hours.
MORNING_UTC = datetime(2026, 8, 18, 8, 0, tzinfo=UTC)


@pytest.fixture
async def parent(client, signup_body):
    body = signup_body()
    body["installId"] = "i_phone"
    tokens = (await client.post("/auth/signup", json=body)).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def seeded(db):
    from app.repos import system as system_repo

    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)


@pytest.fixture
async def family(client, parent, db):
    """A family with a browser to ring. The kind ships on, so nothing is set."""
    await client.post(
        "/push/tokens",
        headers=parent,
        json={"token": TOKEN, "platform": "Pixel", "tzOffsetMinutes": PLUS_TWO},
    )
    row = await db.push_tokens.find_one({"token": TOKEN})
    return {"familyId": row["familyId"], "userId": row["userId"]}


async def publish(db, skill_id: str, title: str, *, at: datetime | None = None):
    await db.skill_registry.insert_one(
        {
            "id": skill_id,
            "title": title,
            "status": "published",
            "deletedAt": None,
            "publishedAt": (at or datetime(2026, 8, 18, 6, 0, tzinfo=UTC)).isoformat(),
            "updatedAt": now(),
        }
    )


async def told(db) -> list[dict]:
    return await db.notifications.find({"kind": "learn.skill_published"}).to_list(length=50)


async def test_a_published_skill_reaches_a_family(db, family, seeded):
    await publish(db, "color-sweeper", "Colour Sweeper")

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["skills"] == 1
    assert report["announcements"] == 1
    rows = await told(db)
    assert len(rows) == 1
    assert "Colour Sweeper" in rows[0]["body"]


async def test_a_second_run_says_nothing(db, family, seeded):
    """The hourly tick has to be harmless, and the ledger is what makes it so."""
    await publish(db, "color-sweeper", "Colour Sweeper")

    first = await task_service.skill_announcements(db, at=MORNING_UTC)
    second = await task_service.skill_announcements(db, at=MORNING_UTC + timedelta(hours=1))

    assert first["announcements"] == 1
    assert second["announcements"] == 0
    assert len(await told(db)) == 1


async def test_two_skills_released_together_are_two_notifications(db, family, seeded):
    """Tagged per skill, so the second does not replace the first on a phone."""
    await publish(db, "color-sweeper", "Colour Sweeper")
    await publish(db, "bottle-sort", "Bottle Sort")

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["announcements"] == 2
    assert {row["title"] for row in await told(db)} == {"New on Koda"}
    assert len(await told(db)) == 2


async def test_last_months_skill_is_not_news(db, family, seeded):
    """Or the first run after this job ships announces the whole back catalogue."""
    await publish(db, "counting", "Counting", at=MORNING_UTC - timedelta(days=30))

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["skills"] == 0
    assert report["announcements"] == 0
    assert await told(db) == []


async def test_a_draft_is_not_announced(db, family, seeded):
    await db.skill_registry.insert_one(
        {
            "id": "half-built",
            "title": "Half Built",
            "status": "draft",
            "deletedAt": None,
            "publishedAt": MORNING_UTC.isoformat(),
        }
    )

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["announcements"] == 0


async def test_the_operator_switch_stops_every_announcement(db, family, seeded):
    from app.repos import system as system_repo

    await publish(db, "color-sweeper", "Colour Sweeper")
    await system_repo.set_value(db, "push.skillPublished", False, "u_admin")

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["announcements"] == 0
    assert "does not announce" in report["skipped"]
    assert await told(db) == []


async def test_a_family_that_switched_it_off_is_not_told(db, family, seeded):
    """The kind ships on, so this is the family that has said otherwise."""
    await publish(db, "color-sweeper", "Colour Sweeper")
    await notify_prefs.set_pref(db, family["userId"], "learn.skill_published", False)

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    # Composed and claimed — the job decided to tell this household — and then
    # `push.send` found nobody in it who wanted telling. Two different numbers
    # for two different facts, exactly as the weekly summary reports them.
    assert report["announcements"] == 1
    assert report["sent"] == 0
    assert await told(db) == []


async def test_the_middle_of_the_night_waits_for_morning(db, family, seeded):
    await publish(db, "color-sweeper", "Colour Sweeper")
    # 23:00 for a family at UTC+2, inside the default 21:00–07:00 window.
    night = datetime(2026, 8, 18, 21, 0, tzinfo=UTC)

    at_night = await task_service.skill_announcements(db, at=night)
    in_the_morning = await task_service.skill_announcements(db, at=MORNING_UTC + timedelta(days=1))

    assert at_night["announcements"] == 0
    assert in_the_morning["announcements"] == 1


async def test_a_household_that_never_sleeps_is_still_reached(db, family, seeded):
    """Quiet hours are a preference, and an equal window means none."""
    await publish(db, "color-sweeper", "Colour Sweeper")
    await notify_schedule.save(db, family["userId"], quiet_from=0, quiet_to=0)
    night = datetime(2026, 8, 18, 21, 0, tzinfo=UTC)

    report = await task_service.skill_announcements(db, at=night)

    assert report["announcements"] == 1


async def test_a_preview_shows_the_wording_without_spending_the_claim(db, family, seeded):
    await publish(db, "color-sweeper", "Colour Sweeper")

    preview = await task_service.skill_announcements(db, at=MORNING_UTC, preview=True)

    assert preview["announcements"] == 1
    assert preview["sent"] == 0
    line = preview["would_send"][0]
    assert line["skill"] == "Colour Sweeper"
    assert "Colour Sweeper" in line["body"]
    assert line["alreadySent"] is False
    assert await told(db) == []

    # …and the real run that follows it still has something to do.
    real = await task_service.skill_announcements(db, at=MORNING_UTC)
    assert real["announcements"] == 1


async def test_a_deployment_with_nothing_new_says_so(db, family, seeded):
    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["announcements"] == 0
    assert "nothing has been published" in report["skipped"]
