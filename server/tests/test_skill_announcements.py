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
            # A datetime, because that is what `repos.skills` writes and what
            # Mongo therefore stores. Written as ISO text here, these fixtures
            # agreed with a query that compared a string against a date — so
            # every test passed while the job matched nothing on a real
            # deployment and no family was ever told about a new skill.
            "publishedAt": at or datetime(2026, 8, 18, 6, 0, tzinfo=UTC),
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


async def test_announcing_on_publish_reaches_a_family_and_leaves_the_tick_nothing(
    db, family, seeded
):
    await publish(db, "color-sweeper", "Colour Sweeper")

    # Counted by what the parent can read rather than by `sent`, which is how
    # many browsers FCM accepted — and is 0 wherever there is no real FCM.
    await task_service.announce_new_skills(db, at=MORNING_UTC)
    assert len(await told(db)) == 1

    # The hourly tick shares the ledger, so the family is not told twice.
    report = await task_service.skill_announcements(db, at=MORNING_UTC)
    assert report["announcements"] == 0
    assert len(await told(db)) == 1


async def test_announcing_on_publish_reads_every_page(db, family, seeded, monkeypatch):
    calls: list[str | None] = []
    real = task_service.skill_announcements

    async def counted(db, *, at=None, cursor=None, limit=task_service.FAMILY_PAGE, preview=False):
        calls.append(cursor)
        return await real(db, at=at, cursor=cursor, limit=1, preview=preview)

    monkeypatch.setattr(task_service, "skill_announcements", counted)
    await publish(db, "color-sweeper", "Colour Sweeper")

    await task_service.announce_new_skills(db, at=MORNING_UTC)

    # One family fills a page of one, so the run must ask again with its cursor.
    assert len(calls) == 2
    assert calls[1] is not None
    assert len(await told(db)) == 1


async def test_announcing_on_publish_never_raises(db, monkeypatch):
    async def broken(*args, **kwargs):
        raise RuntimeError("mongo went away")

    monkeypatch.setattr(task_service, "skill_announcements", broken)

    assert await task_service.announce_new_skills(db) == 0


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
            "publishedAt": MORNING_UTC,
        }
    )

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["announcements"] == 0


async def test_the_operator_switch_stops_every_announcement(db, family, seeded):
    from app.repos import system as system_repo

    await publish(db, "color-sweeper", "Colour Sweeper")
    # Both channels: with only push off, a parent who asked would still be emailed.
    await system_repo.set_value(db, "push.skillPublished", False, "u_admin")
    await system_repo.set_value(db, "email.skillPublished", False, "u_admin")

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


# --- books and Rebus releases ride the same job -------------------------------


async def test_a_published_book_and_a_rebus_release_are_announced_once(db, family, seeded):
    published = datetime(2026, 8, 18, 6, 0, tzinfo=UTC)
    await db.library_books.insert_one(
        {"id": "market", "deletedAt": None, "publishedAt": published, "published": {"title": "The Market"}}
    )
    await db.rebus_releases.insert_many([
        {"number": 4, "at": published, "puzzleIds": ["a", "b"], "rolledBack": False},
        {"number": 3, "at": published, "puzzleIds": ["c"], "rolledBack": True},
    ])

    first = await task_service.skill_announcements(db, at=MORNING_UTC)
    # A republished book is the same news, not a second piece of it.
    await db.library_books.update_one({"id": "market"}, {"$set": {"publishedAt": MORNING_UTC}})
    second = await task_service.skill_announcements(db, at=MORNING_UTC + timedelta(hours=1))

    assert first["announcements"] == 2
    assert second["announcements"] == 0
    bodies = sorted(row["body"] for row in await told(db))
    assert len(bodies) == 2
    assert any("The Market" in body for body in bodies)
    assert any("2 new Rebus puzzles" in body for body in bodies)


def test_new_content_is_emailed_unless_a_parent_turned_it_off():
    from app.services import email_notify

    assert email_notify.wanted_by("learn.skill_published", None)
    assert not email_notify.wanted_by("learn.skill_published", {"learn.skill_published": False})


# --- only families with a child the item is for -------------------------------


async def add_child(db, family_id: str, birth_year: int | None):
    from app.repos import learners as learners_repo

    await learners_repo.create(db, family_id, "Kid", birth_year)


async def test_an_age_ranged_skill_skips_a_family_whose_children_are_outside_it(db, family, seeded):
    await add_child(db, family["familyId"], 2026 - 6)
    await db.skill_registry.insert_one(
        {"id": "algebra", "title": "Algebra", "status": "published", "deletedAt": None,
         "publishedAt": datetime(2026, 8, 18, 6, 0, tzinfo=UTC), "audience": {"ages": [10, 14]}}
    )
    await db.library_books.insert_one(
        {"id": "market", "deletedAt": None, "publishedAt": datetime(2026, 8, 18, 6, 0, tzinfo=UTC),
         "published": {"title": "The Market", "ages": [5, 7]}}
    )

    report = await task_service.skill_announcements(db, at=MORNING_UTC)

    assert report["announcements"] == 1
    assert ["The Market" in row["body"] for row in await told(db)] == [True]
    # Not claimed, so a matching child added later still hears about it.
    await add_child(db, family["familyId"], 2026 - 12)
    later = await task_service.skill_announcements(db, at=MORNING_UTC + timedelta(hours=1))
    assert later["announcements"] == 1


def test_who_an_age_range_reaches():
    assert task_service._for_family(None, [])
    assert task_service._for_family([5, 7], [6])
    assert task_service._for_family([5, 7], [12, None])
    assert not task_service._for_family([5, 7], [12])
    assert not task_service._for_family([5, 7], [])


def test_the_greeting_skips_a_title():
    from app.services.email_notify import first_name

    assert first_name({"displayName": "Mr. លី"}) == "លី"
    assert first_name({"displayName": "Dara Sok"}) == "Dara"
    assert first_name({"displayName": "Mrs."}) == "there"
