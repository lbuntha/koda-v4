"""Phase 2 of parent notifications: what a parent hears about their children.

The weekly summary by email, the absence message once per gap, the daily digest
for a parent who asked, new skills by email, and the "Your children" overview.
The console drivers are the default, so `mail.send` is an outbox and
`db.notifications` is what a push would have said.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.common import now
from app.repos import notify_jobs, notify_prefs
from app.services import mail
from app.services import tasks as task_service
from app.settings import settings
from app.system_defaults import DEFAULT_SETTINGS

PLUS_TWO = 120
#: A Sunday. 18:00 in a family at UTC+2.
SUNDAY_EVENING_UTC = datetime(2026, 8, 16, 16, 0, tzinfo=UTC)
#: The same Sunday at 17:00 their time — the default reminder hour.
SUNDAY_FIVE_UTC = datetime(2026, 8, 16, 15, 0, tzinfo=UTC)
#: 19:00 their time — the default digest hour.
SUNDAY_SEVEN_UTC = datetime(2026, 8, 16, 17, 0, tzinfo=UTC)
TEN_MINUTES = 600_000


@pytest.fixture
def outbox(monkeypatch):
    monkeypatch.setattr(settings(), "mail_driver", "console")
    sent: list[dict] = []

    async def fake_send(to, subject, body, headers=None):
        sent.append({"to": to, "subject": subject, "body": body})
        return True

    monkeypatch.setattr(mail, "send", fake_send)
    return sent


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
    """Two children and no browser: every Phase 2 message must reach them by email.

    The second child is written straight to the repo — the free plan's limit is
    one child through the API, and the limit is not what these tests are about.
    """
    from app.repos import learners as learners_repo

    mia = (await client.post("/learners", headers=parent, json={"displayName": "Mia"})).json()
    member = await db.memberships.find_one({})
    leo = await learners_repo.create(db, member["familyId"], "Leo")
    return {"familyId": member["familyId"], "userId": member["userId"], "mia": mia["id"], "leo": leo["_id"]}


async def practise(db, family, learner_id: str, days: list[str], *, duration=TEN_MINUTES):
    for index, day in enumerate(days):
        await db.events.insert_one(
            {
                "_id": f"ev_{learner_id}_{day}_{index}",
                "familyId": family["familyId"],
                "eventId": f"e_{learner_id}_{day}_{index}",
                "learnerId": learner_id,
                "type": "lesson_completed",
                "localDay": day,
                "tzOffsetMinutes": PLUS_TWO,
                "durationMs": duration,
                "skillId": "counting",
                "receivedAt": now(),
            }
        )


async def told(db, kind: str) -> list[dict]:
    return await db.notifications.find({"kind": kind}).to_list(length=50)


# --- the weekly summary ------------------------------------------------------


async def test_one_weekly_email_per_parent_covers_every_child(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-16", "2026-08-15"])
    await practise(db, family, family["leo"], ["2026-08-14"], duration=90_000)

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["families"] == 1
    [letter] = outbox
    assert letter["to"] == "parent@example.com"
    assert letter["subject"] == "Your family's week on Koda"
    assert "• Mia: practised on 2 days — 2 rounds, 20 minutes" in letter["body"]
    assert "• Leo: practised on 1 day — 1 round, 2 minutes" in letter["body"]
    bodies = {row["body"] for row in await told(db, "learn.weekly_summary")}
    assert "Mia practised 2 days this week — 2 rounds, 20 minutes." in bodies


async def test_the_weekly_email_is_never_sent_twice(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-16"])

    await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)
    await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert len(outbox) == 1


async def test_a_parent_can_turn_the_weekly_email_off(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-16"])
    await notify_prefs.set_pref(db, family["userId"], "learn.weekly_summary", False, channel="email")

    await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert outbox == []
    assert len(await told(db, "learn.weekly_summary")) == 1, "the push half is a separate choice"


# --- the absence message -----------------------------------------------------


async def test_a_long_absence_is_told_once(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-05"])

    first = await task_service.absence_check(db, at=SUNDAY_FIVE_UTC)
    await task_service.absence_check(db, at=SUNDAY_FIVE_UTC + timedelta(days=1))

    assert first["absences"] == 1
    [row] = await told(db, "learn.absence")
    assert row["title"] == "Mia hasn't practised in 11 days"
    [letter] = outbox
    assert letter["subject"] == "Mia hasn't practised in 11 days"


async def test_the_absence_threshold_is_the_operators(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-05"])
    await notify_jobs.save(db, "absence-check", days=14)

    report = await task_service.absence_check(db, at=SUNDAY_FIVE_UTC)

    assert report["absences"] == 0
    assert outbox == []


async def test_a_child_who_never_practised_is_not_away(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-05"])

    report = await task_service.absence_check(db, at=SUNDAY_FIVE_UTC)

    assert report["absences"] == 1, "Mia is away; Leo, who never started, is not"


async def test_the_absence_waits_for_the_parents_hour(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-05"])

    report = await task_service.absence_check(db, at=SUNDAY_EVENING_UTC)

    assert report["due"] == 0
    assert outbox == []


# --- the daily digest --------------------------------------------------------


async def test_the_daily_digest_goes_only_to_a_parent_who_asked(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-16"] * 5)

    silent = await task_service.daily_digest(db, at=SUNDAY_SEVEN_UTC)
    assert silent["due"] == 0 and outbox == []

    await notify_prefs.set_pref(db, family["userId"], "learn.daily_digest", True, channel="email")
    report = await task_service.daily_digest(db, at=SUNDAY_SEVEN_UTC)

    assert report["digests"] == 1
    [letter] = outbox
    assert "• Mia: 5 rounds, 50 minutes — today's goal met" in letter["body"]
    assert "Leo" not in letter["body"], "a child with nothing today is left out"


async def test_a_day_with_no_practice_sends_no_digest(db, family, seeded, outbox):
    await notify_prefs.set_pref(db, family["userId"], "learn.daily_digest", True, channel="email")
    await practise(db, family, family["mia"], ["2026-08-10"])

    await task_service.daily_digest(db, at=SUNDAY_SEVEN_UTC)

    assert outbox == []


# --- new skills --------------------------------------------------------------


async def test_a_new_skill_can_be_emailed_to_a_family_without_a_browser(db, family, seeded, outbox):
    await practise(db, family, family["mia"], ["2026-08-15"])
    await notify_prefs.set_pref(db, family["userId"], "learn.skill_published", True, channel="email")
    await db.skill_registry.insert_one(
        {
            "id": "colour-sweeper",
            "title": "Colour Sweeper",
            "status": "published",
            "deletedAt": None,
            "publishedAt": datetime(2026, 8, 16, 6, 0, tzinfo=UTC),
            "updatedAt": now(),
        }
    )

    await task_service.skill_announcements(db, at=datetime(2026, 8, 16, 8, 0, tzinfo=UTC))

    [letter] = outbox
    assert letter["subject"] == "New on Koda: Colour Sweeper"


# --- "Your children" ---------------------------------------------------------


async def test_the_overview_says_each_childs_day_and_gap(client, parent, db, family, seeded):
    local_today = (datetime.now(UTC) + timedelta(minutes=PLUS_TWO)).date()
    today, yesterday = local_today.isoformat(), (local_today - timedelta(days=1)).isoformat()
    await practise(db, family, family["mia"], [today, today, yesterday])
    await practise(db, family, family["leo"], [(local_today - timedelta(days=10)).isoformat()])

    body = (await client.get("/learners/overview", headers=parent)).json()

    children = {child["displayName"]: child for child in body["children"]}
    assert children["Mia"]["today"] == {"rounds": 2, "minutes": 20, "goal": 5, "goalMet": False}
    assert children["Mia"]["streak"] == 2
    assert children["Mia"]["daysAway"] == 0
    assert children["Leo"]["daysAway"] == 10
    assert body["attention"]["learnerId"] == family["leo"]
    assert body["attention"]["title"] == "Leo hasn't practised in 10 days"


async def test_the_events_screen_shows_the_new_kinds_and_jobs(client, db, seeded):
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})
    ).json()
    admin = {"Authorization": f"Bearer {tokens['accessToken']}"}

    body = (await client.get("/system/notify/events", headers=admin)).json()

    events = {row["id"]: row for row in body["events"]}
    assert events["learn.daily_digest"]["push"]["available"] is False
    assert events["learn.daily_digest"]["email"]["settingId"] == "email.dailyDigest"
    assert events["learn.absence"]["job"] == "absence-check"
    absence = next(job for job in body["jobs"] if job["id"] == "absence-check")
    assert absence["days"] == 7

    moved = await client.patch("/system/notify/jobs/absence-check", headers=admin, json={"days": 10})
    assert next(job for job in moved.json()["jobs"] if job["id"] == "absence-check")["days"] == 10
