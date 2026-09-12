"""Phase 4: the two kinds that could become a hook, and the rules that stop them.

Every test here is really about restraint. A reminder is the one notification in
this design that a child's evening can be organised around, so what is asserted
is mostly what does *not* get sent: not to somebody who already practised, not
twice in a day, not inside the hours a parent asked to be left alone, and not
about a streak that is neither real nor at stake.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.common import now
from app.repos import learners as learners_repo
from app.repos import notify_prefs, notify_schedule
from app.services import streaks
from app.services import tasks as task_service
from app.system_defaults import DEFAULT_SETTINGS

TOKEN = "f" * 140
PLUS_TWO = 120

#: 17:00 for a family at UTC+2 — the default reminder hour.
REMINDER_TIME_UTC = datetime(2026, 8, 18, 15, 0, tzinfo=UTC)


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
    """A family who has asked for reminders, with a browser to ring."""
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia", "birthYear": 2017})
    ).json()
    # The browser reports its own offset as it registers, which is how a job
    # knows what hour it is for a family that has never practised.
    await client.post(
        "/push/tokens",
        headers=parent,
        json={"token": TOKEN, "platform": "Pixel", "tzOffsetMinutes": PLUS_TWO},
    )
    row = await db.push_tokens.find_one({"token": TOKEN})
    # Reminders ship off. A family that has not asked for them is the subject of
    # exactly one test; every other test here is about a family that has.
    await notify_prefs.set_pref(db, row["userId"], "learn.practice_reminder", True)
    await notify_prefs.set_pref(db, row["userId"], "learn.streak_ending", True)
    return {"familyId": row["familyId"], "userId": row["userId"], "learnerId": learner["id"]}


async def practise(db, family, days: list[str], *, learner_id: str | None = None, offset=PLUS_TWO):
    for index, day in enumerate(days):
        await db.events.insert_one(
            {
                "_id": f"ev_{learner_id or family['learnerId']}_{day}_{index}",
                "familyId": family["familyId"],
                "eventId": f"e_{learner_id or family['learnerId']}_{day}",
                "learnerId": learner_id or family["learnerId"],
                "type": "lesson_completed",
                "localDay": day,
                "tzOffsetMinutes": offset,
                "skillId": "counting",
                "receivedAt": now(),
            }
        )


async def told(db, kind: str) -> list[dict]:
    return await db.notifications.find({"kind": kind}).to_list(length=50)


def days_before(anchor: str, count: int) -> list[str]:
    """`count` consecutive days ending the day before `anchor`."""
    start = datetime.fromisoformat(anchor).date()
    return [(start - timedelta(days=offset)).isoformat() for offset in range(1, count + 1)]


# --- the streak rule, on its own ------------------------------------------


def test_a_streak_counts_days_not_rounds():
    """Nine rounds on Tuesday is one Tuesday."""
    assert streaks.run_length(["2026-08-18", "2026-08-17", "2026-08-16"], today="2026-08-18") == 3


def test_yesterday_still_counts_as_a_live_streak():
    """Counting a streak dead at midnight makes every reminder a bereavement notice."""
    assert streaks.run_length(["2026-08-17", "2026-08-16"], today="2026-08-18") == 2


def test_a_gap_ends_the_run():
    assert streaks.run_length(["2026-08-17", "2026-08-15"], today="2026-08-18") == 1


def test_a_run_that_ended_days_ago_is_not_a_streak():
    """That streak is over, and counting it would be describing the past."""
    assert streaks.run_length(["2026-08-12", "2026-08-11"], today="2026-08-18") == 0


def test_nonsense_in_the_field_does_not_crash_a_job():
    """A client is entitled to be wrong about its own day; a job is not entitled
    to crash because of it."""
    assert streaks.run_length(["not-a-day", "2026-08-17"], today="2026-08-18") == 1
    assert streaks.run_length(["2026-08-17"], today="rubbish") == 0


# --- how long it has been -------------------------------------------------


def test_the_gap_is_counted_from_the_last_day_that_counted():
    assert streaks.days_away(["2026-08-15", "2026-08-14"], today="2026-08-18") == 3


def test_a_child_who_practised_today_is_no_days_away():
    assert streaks.days_away(["2026-08-18", "2026-08-11"], today="2026-08-18") == 0


def test_a_child_who_has_never_practised_has_no_gap_to_report():
    """`None`, not a large number: "away for 4,000 days" is a sentence about a
    child who signed up this morning."""
    assert streaks.days_away([], today="2026-08-18") is None
    assert streaks.days_away(["rubbish"], today="2026-08-18") is None


def test_a_clock_that_runs_ahead_does_not_produce_a_negative_gap():
    assert streaks.days_away(["2026-08-19"], today="2026-08-18") == 0


# --- quiet hours ----------------------------------------------------------


def test_quiet_hours_wrap_around_midnight():
    """21 to 7 is not "between 21 and 7" on a number line."""
    schedule = {"quietFrom": 21, "quietTo": 7}
    assert notify_schedule.is_quiet(schedule, 22) is True
    assert notify_schedule.is_quiet(schedule, 3) is True
    assert notify_schedule.is_quiet(schedule, 7) is False
    assert notify_schedule.is_quiet(schedule, 17) is False


def test_an_equal_window_means_no_quiet_hours():
    """Somebody setting both to the same time was switching the window off.

    Reading it as "always quiet" would silently stop every courtesy
    notification they had asked for — a preference that turns into its own
    opposite is worse than one that does nothing.
    """
    assert notify_schedule.is_quiet({"quietFrom": 9, "quietTo": 9}, 9) is False
    assert notify_schedule.is_quiet({"quietFrom": 9, "quietTo": 9}, 3) is False


async def test_an_account_kind_ignores_quiet_hours(db, seeded):
    """Two in the morning is precisely when somebody wants to know."""
    await notify_schedule.save(db, "u_1", quiet_from=21, quiet_to=7)

    assert await __import__("app.services.push", fromlist=["push"]).held_for(
        db, "device.new_signin", "u_1", local_hour=2
    ) is False


async def test_a_courtesy_kind_is_held_inside_the_window(db, seeded):
    from app.services import push

    await notify_schedule.save(db, "u_1", quiet_from=21, quiet_to=7)

    assert await push.held_for(db, "learn.goal_met", "u_1", local_hour=2) is True
    assert await push.held_for(db, "learn.goal_met", "u_1", local_hour=12) is False


# --- the job --------------------------------------------------------------


async def test_a_child_who_has_not_practised_is_reminded(db, family, seeded):
    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    assert report["due"] == 1
    assert report["reminders"] == 1
    assert "Mia" in (await told(db, "learn.practice_reminder"))[0]["body"]


async def test_a_child_who_already_practised_is_left_alone(db, family, seeded):
    """The whole point of the kind."""
    await practise(db, family, ["2026-08-18"])

    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    assert report["reminders"] == 0
    assert await told(db, "learn.practice_reminder") == []


async def test_it_is_the_hour_the_parent_chose_and_no_other(db, family, seeded):
    await notify_schedule.save(db, family["userId"], reminder_hour=20)

    at_five = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)
    at_eight = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC + timedelta(hours=3))

    assert at_five["reminders"] == 0
    assert at_eight["reminders"] == 1


async def test_quiet_hours_outrank_a_chosen_hour(db, family, seeded):
    """A parent who picks 22:00 with quiet hours from 21:00 has contradicted
    themselves, and the window is the half that says "not now" out loud."""
    await notify_schedule.save(db, family["userId"], reminder_hour=22, quiet_from=21, quiet_to=7)

    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC + timedelta(hours=5))

    assert report["reminders"] == 0
    assert await told(db, "learn.practice_reminder") == []


async def test_a_family_that_never_asked_is_never_reminded(db, family, seeded):
    """Reminders ship off. The operator switch is a ceiling, not a subscription."""
    await notify_prefs.set_pref(db, family["userId"], "learn.practice_reminder", False)
    await notify_prefs.set_pref(db, family["userId"], "learn.streak_ending", False)

    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    assert report["due"] == 0
    assert await told(db, "learn.practice_reminder") == []


async def test_one_reminder_a_day_however_often_the_job_runs(db, family, seeded):
    first = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)
    second = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    assert (first["reminders"], second["reminders"]) == (1, 0)
    assert len(await told(db, "learn.practice_reminder")) == 1


async def test_a_streak_at_stake_replaces_the_plain_reminder(db, family, seeded):
    """Same evening, better reason, and never both — two notifications about one
    evening is how a courtesy becomes a nag."""
    await practise(db, family, days_before("2026-08-18", 4))

    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    assert report["streaks"] == 1
    assert report["reminders"] == 0
    body = (await told(db, "learn.streak_ending"))[0]["body"]
    assert "4 days" in body, body
    assert await told(db, "learn.practice_reminder") == []


async def test_one_day_is_not_a_streak_worth_defending(db, family, seeded):
    """A child who practised once yesterday has not built anything a
    notification about losing it would be honest about."""
    await practise(db, family, days_before("2026-08-18", 1))

    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    assert report["streaks"] == 0
    assert report["reminders"] == 1


async def test_the_reminder_says_how_long_it_has_been(db, family, seeded):
    """A parent whose child has been away a week read "hasn't had a go today
    yet" on each of those days, which is true and tells them nothing."""
    await practise(db, family, ["2026-08-12"])

    await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    body = (await told(db, "learn.practice_reminder"))[0]["body"]
    assert "6 days" in body, body
    assert "Mia" in body, body


async def test_the_noun_travels_with_the_number(db, family, seeded):
    """"It's been 1 days" is the sort of thing a child reads aloud to a parent."""
    await practise(db, family, days_before("2026-08-18", 1))

    await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    body = (await told(db, "learn.practice_reminder"))[0]["body"]
    assert "a day" in body, body
    assert "1 days" not in body, body


async def test_a_child_who_has_never_started_is_not_given_a_number(db, family, seeded):
    """There is no gap to count, so the sentence says the one true thing it can."""
    await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    body = (await told(db, "learn.practice_reminder"))[0]["body"]
    assert "a while" in body, body


async def test_a_preview_shows_the_evening_without_sending_it(client, db, family, seeded):
    from app.repos import push_runs

    await practise(db, family, days_before("2026-08-18", 3))

    report = await task_service.daily_reminders(db, preview=True)

    lines = report.get("would_send", [])
    assert lines and lines[0]["learner"] == "Mia"
    assert await db.push_runs.count_documents({}) == 0
    assert await told(db, "learn.streak_ending") == []
    assert await push_runs.was_claimed(
        db, kind="learn.streak_ending", recipient_id=family["learnerId"], date_key="2026-08-18"
    ) is False


async def test_two_children_are_judged_separately(db, family, seeded):
    """One child's good afternoon is not the other's."""
    sam = await learners_repo.create(db, family["familyId"], "Sam")
    await practise(db, family, ["2026-08-18"], learner_id=sam["_id"])

    report = await task_service.daily_reminders(db, at=REMINDER_TIME_UTC)

    told_about = [n["body"] for n in await told(db, "learn.practice_reminder")]
    assert report["reminders"] == 1
    assert any("Mia" in body for body in told_about)
    assert not any("Sam" in body for body in told_about)


# --- the parent's own screen ----------------------------------------------


async def test_a_parent_sets_their_reminder_hour(client, parent):
    body = (await client.put("/push/schedule", headers=parent, json={"reminderHour": 19})).json()

    assert body["reminderHour"] == 19
    assert (await client.get("/push/schedule", headers=parent)).json()["reminderHour"] == 19


async def test_quiet_hours_ship_on(client, parent):
    """Every other preference here ships off and waits to be asked for. This one
    protects a child's evening from the feature itself."""
    body = (await client.get("/push/schedule", headers=parent)).json()

    assert (body["quietFrom"], body["quietTo"]) == (21, 7)


async def test_a_childs_device_cannot_set_a_schedule(client, db, parent):
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia", "birthYear": 2017})
    ).json()
    code = (await client.post(f"/learners/{learner['id']}/join-code", headers=parent)).json()
    tokens = (
        await client.post("/auth/join", json={"code": code["code"], "deviceName": "Mia's tablet"})
    ).json()
    child = {"Authorization": f"Bearer {tokens['accessToken']}"}

    response = await client.put("/push/schedule", headers=child, json={"reminderHour": 3})

    assert response.status_code == 403
