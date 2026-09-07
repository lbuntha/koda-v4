"""Scheduled work: who may run it, when it fires, and that a retry is free.

The console driver is the default, so nothing here sends. That is not a
limitation — every claim this phase makes is about *deciding*, and the decision
leaves a record either way: `push.send` writes the in-app notification before it
ever reaches a transport, so `db.notifications` is what a test reads to find out
whether somebody was told.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.common import now
from app.repos import learners as learners_repo
from app.repos import push_runs
from app.services import tasks as task_service
from app.settings import settings
from app.system_defaults import DEFAULT_SETTINGS

TOKEN = "f" * 140

#: A Sunday. 18:00 in a family sitting at UTC+2 is 16:00 here.
SUNDAY_EVENING_UTC = datetime(2026, 8, 16, 16, 0, tzinfo=UTC)
PLUS_TWO = 120


@pytest.fixture
async def parent(client, signup_body):
    body = signup_body()
    body["installId"] = "i_phone"
    tokens = (await client.post("/auth/signup", json=body)).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def seeded(db):
    """The app seeds the switchboard at startup; the test fixture skips the lifespan."""
    from app.repos import system as system_repo

    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)


@pytest.fixture
async def family(client, parent, db):
    """A family with a child, a browser to ring, and a week of practice behind it."""
    learner = (
        await client.post(
            "/learners", headers=parent, json={"displayName": "Mia", "birthYear": 2017}
        )
    ).json()
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN, "platform": "Pixel"})
    row = await db.push_tokens.find_one({"token": TOKEN})
    return {"familyId": row["familyId"], "userId": row["userId"], "learnerId": learner["id"]}


async def practise(db, family, *, days: list[str], learner_id: str | None = None, offset=PLUS_TWO):
    """Put finished rounds in the log, on the learner's own days."""
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


# --- the door -------------------------------------------------------------


async def test_a_stranger_cannot_run_a_job(client, monkeypatch):
    """Configured, and therefore closed to everything without a scheduler token."""
    monkeypatch.setattr(settings(), "push_task_service_account", "scheduler@koda.iam.gserviceaccount.com")
    monkeypatch.setattr(settings(), "push_task_audience", "https://api.koda.example")

    response = await client.post("/tasks/token-sweep")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "task_auth_missing"


async def test_a_token_that_is_not_googles_is_refused(client, monkeypatch):
    monkeypatch.setattr(settings(), "push_task_service_account", "scheduler@koda.iam.gserviceaccount.com")
    monkeypatch.setattr(settings(), "push_task_audience", "https://api.koda.example")

    response = await client.post(
        "/tasks/token-sweep", headers={"Authorization": "Bearer not.a.real.token"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "task_auth_invalid"


async def test_another_service_account_is_refused(client, monkeypatch):
    """Audience alone is not enough: plenty of accounts can mint one for us."""
    monkeypatch.setattr(settings(), "push_task_service_account", "scheduler@koda.iam.gserviceaccount.com")
    monkeypatch.setattr(settings(), "push_task_audience", "https://api.koda.example")
    monkeypatch.setattr(
        "app.services.google_identity.verify_oidc",
        lambda token, audience: {"email": "someone-else@evil.iam.gserviceaccount.com", "email_verified": True},
    )

    response = await client.post(
        "/tasks/token-sweep", headers={"Authorization": "Bearer looks.fine.actually"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "task_auth_forbidden"


async def test_the_scheduler_is_let_through(client, monkeypatch):
    monkeypatch.setattr(settings(), "push_task_service_account", "scheduler@koda.iam.gserviceaccount.com")
    monkeypatch.setattr(settings(), "push_task_audience", "https://api.koda.example")
    monkeypatch.setattr(
        "app.services.google_identity.verify_oidc",
        lambda token, audience: {
            "email": "scheduler@koda.iam.gserviceaccount.com",
            "email_verified": True,
            "aud": audience,
        },
    )

    response = await client.post(
        "/tasks/token-sweep", headers={"Authorization": "Bearer a.real.one"}
    )

    assert response.status_code == 200
    assert response.json()["job"] == "token-sweep"


async def test_an_unconfigured_production_deployment_refuses_every_job(client, monkeypatch):
    """Fail closed. A deployment with no scheduler has no job to lose."""
    monkeypatch.setattr(settings(), "push_task_service_account", None)
    monkeypatch.setattr(settings(), "environment", "production")

    response = await client.post("/tasks/token-sweep")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "task_auth_unconfigured"


# --- the weekly summary ---------------------------------------------------


async def test_a_summary_goes_out_on_the_familys_own_sunday_evening(db, family, seeded):
    await practise(db, family, days=["2026-08-11", "2026-08-13", "2026-08-16"])

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["due"] == 1
    assert report["summaries"] == 1
    notices = await told(db, "learn.weekly_summary")
    assert len(notices) == 1
    assert "practised 3 days" in notices[0]["body"], notices[0]["body"]
    assert notices[0]["userId"] == family["userId"]


async def test_the_same_hour_in_another_timezone_is_not_sunday_evening(db, family, seeded):
    """UTC+2's Sunday evening is the middle of the afternoon in London."""
    await practise(db, family, days=["2026-08-16"], offset=0)

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["families"] == 1
    assert report["due"] == 0
    assert await told(db, "learn.weekly_summary") == []


async def test_a_monday_run_sends_nothing(db, family, seeded):
    await practise(db, family, days=["2026-08-16"])

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC + timedelta(days=1))

    assert report["due"] == 0
    assert await told(db, "learn.weekly_summary") == []


async def test_running_the_job_twice_tells_a_parent_once(db, family, seeded):
    """The whole reason `push_runs` is written before the send."""
    await practise(db, family, days=["2026-08-16"])

    first = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)
    second = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert (first["summaries"], second["summaries"]) == (1, 0)
    assert len(await told(db, "learn.weekly_summary")) == 1


async def test_a_child_who_did_nothing_is_not_reported_on(db, family, seeded):
    """A summary of an empty week is a nag, and §1 says this must not become one."""
    quiet = await learners_repo.create(db, family["familyId"], "Sam")
    await practise(db, family, days=["2026-08-16"])

    await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    notices = await told(db, "learn.weekly_summary")
    assert len(notices) == 1
    assert "Mia" in notices[0]["title"]
    assert not await push_runs.was_claimed(
        db, kind="learn.weekly_summary", recipient_id=quiet["_id"], date_key="2026-08-16"
    )


async def test_two_children_are_two_notifications_not_one(db, family, seeded):
    """Tagged per learner, because `weekly:{learnerId}` is what stops a collapse."""
    sam = await learners_repo.create(db, family["familyId"], "Sam")
    await practise(db, family, days=["2026-08-16"])
    await practise(db, family, days=["2026-08-15", "2026-08-16"], learner_id=sam["_id"])

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["summaries"] == 2
    bodies = sorted(n["title"] for n in await told(db, "learn.weekly_summary"))
    assert bodies == ["Mia's week", "Sam's week"]


async def test_the_operator_switch_stops_the_whole_run(db, family, seeded):
    await practise(db, family, days=["2026-08-16"])
    await db.system_settings.update_one(
        {"settingId": "push.weeklySummary"}, {"$set": {"value": False}}, upsert=True
    )

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["skipped"]
    assert await told(db, "learn.weekly_summary") == []


async def test_a_parent_who_turned_summaries_off_is_not_told(db, family, seeded):
    """The family's own half of the gate, under the operator's."""
    from app.repos import notify_prefs

    await practise(db, family, days=["2026-08-16"])
    await notify_prefs.set_pref(db, family["userId"], "learn.weekly_summary", False)

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["summaries"] == 1, "composed and claimed; simply not wanted"
    assert await told(db, "learn.weekly_summary") == []


async def test_a_family_with_no_browser_is_never_looked_at(db, family, seeded):
    """The job's cost is the number of people who asked, not the number of accounts."""
    await practise(db, family, days=["2026-08-16"])
    await db.push_tokens.delete_many({})

    report = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert report["families"] == 0
    assert await told(db, "learn.weekly_summary") == []


async def test_a_long_run_says_where_it_stopped(db, family, seeded):
    """Bounded per call and resumable, so a cold start is a slow job not a failed one."""
    for index in range(3):
        await db.push_tokens.insert_one(
            {
                "_id": f"pt_{index}",
                "token": f"{index}" * 140,
                "familyId": f"f_other_{index}",
                "userId": f"u_{index}",
                "deviceId": None,
                "disabledAt": None,
            }
        )

    first = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC, limit=2)
    assert first["families"] == 2
    assert first["cursor"] is not None

    second = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC, limit=2, cursor=first["cursor"])
    assert second["families"] == 2
    # A full page always offers a cursor: whether there is more behind it is the
    # next call's answer, not this one's. Four families is therefore two full
    # pages and one empty one, rather than a page that guesses it is the last.
    third = await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC, limit=2, cursor=second["cursor"])
    assert (third["families"], third["cursor"]) == (0, None)


# --- the nightly sweep ----------------------------------------------------


async def test_the_sweep_deletes_what_nothing_can_use_again(db):
    old = now() - timedelta(days=300)
    await db.push_tokens.insert_one(
        {"_id": "pt_stale", "token": "a" * 140, "familyId": "f_1", "userId": "u_1",
         "refreshedAt": old, "disabledAt": None}
    )
    await db.push_tokens.insert_one(
        {"_id": "pt_live", "token": "b" * 140, "familyId": "f_1", "userId": "u_1",
         "refreshedAt": now(), "disabledAt": None}
    )
    await db.notifications.insert_one(
        {"_id": "n_old", "userId": "u_1", "kind": "learn.goal_met", "title": "x", "body": "y",
         "createdAt": now() - timedelta(days=200), "readAt": None}
    )
    await db.push_runs.insert_one(
        {"_id": "learn.goal_met:l_1:2020-01-01", "kind": "learn.goal_met", "recipientId": "l_1",
         "dateKey": "2020-01-01", "claimedAt": now() - timedelta(days=90)}
    )

    report = await task_service.token_sweep(db)

    assert report == {"job": "token-sweep", "tokens": 1, "notifications": 1, "runs": 1}
    assert await db.push_tokens.count_documents({}) == 1


# --- the goal, noticed as it lands ----------------------------------------


def rounds(count: int, *, learner: str = "l_mia", day: str = "2026-08-16", first: int = 1) -> list[dict]:
    return [
        {
            "id": f"e_{learner}_{day}_{first + index}",
            "ts": f"2026-08-16T1{index}:00:00.000Z",
            "type": "lesson_completed",
            "sessionId": "s_1",
            "learnerId": learner,
            "seq": first + index,
            "skillId": "bottle-sort",
            "conceptKey": "pourer",
            "localDay": day,
            "tzOffsetMinutes": PLUS_TWO,
            "questionsAnswered": 3,
            "correctFirstTry": 3,
        }
        for index in range(count)
    ]


async def test_meeting_the_goal_tells_a_parent(client, db, family, parent, seeded):
    body = {"schemaVersion": 1, "events": rounds(5, learner=family["learnerId"])}

    response = await client.post("/sync/push", json=body, headers=parent)

    assert response.status_code == 200
    notices = await told(db, "learn.goal_met")
    assert len(notices) == 1
    assert "Mia" in notices[0]["title"]
    assert "Bottle Sort" in notices[0]["body"], notices[0]["body"]


async def test_four_rounds_of_five_is_not_a_goal(client, db, family, parent, seeded):
    await client.post("/sync/push", json={"schemaVersion": 1, "events": rounds(4, learner=family["learnerId"])}, headers=parent)

    assert await told(db, "learn.goal_met") == []


async def test_the_goal_is_congratulated_once_a_day(client, db, family, parent, seeded):
    """Rounds six through ten are a good afternoon, not five more notifications."""
    for batch in range(2):
        await client.post(
            "/sync/push",
            json={"schemaVersion": 1, "events": rounds(5, learner=family["learnerId"], first=1 + batch * 5)},
            headers=parent,
        )

    assert len(await told(db, "learn.goal_met")) == 1


async def test_a_replayed_batch_does_not_congratulate_twice(client, db, family, parent, seeded):
    """The offline case: the same rounds arrive again because the reply was lost."""
    batch = {"schemaVersion": 1, "events": rounds(5, learner=family["learnerId"])}
    await client.post("/sync/push", json=batch, headers=parent)
    await db.push_runs.delete_many({})  # even with the ledger wiped, the events are not new
    await client.post("/sync/push", json=batch, headers=parent)

    assert len(await told(db, "learn.goal_met")) == 1


async def test_the_familys_own_goal_is_the_one_that_counts(client, db, family, parent, seeded):
    """A parent who set three rounds is told at three, not at five."""
    await client.post(
        "/sync/push",
        json={
            "schemaVersion": 1,
            "mutations": [
                {
                    "opId": "m_1",
                    "kind": "goals",
                    "key": family["learnerId"],
                    "learnerId": family["learnerId"],
                    "body": {"dailyGoal": 3},
                    "baseRev": 0,
                }
            ],
        },
        headers=parent,
    )

    await client.post(
        "/sync/push",
        json={"schemaVersion": 1, "events": rounds(3, learner=family["learnerId"])},
        headers=parent,
    )

    assert len(await told(db, "learn.goal_met")) == 1


async def test_yesterdays_rounds_do_not_meet_todays_goal(client, db, family, parent, seeded):
    """A device that was offline overnight sends two days; each is its own goal."""
    events = rounds(3, learner=family["learnerId"], day="2026-08-15") + rounds(
        2, learner=family["learnerId"], day="2026-08-16", first=10
    )

    await client.post("/sync/push", json={"schemaVersion": 1, "events": events}, headers=parent)

    assert await told(db, "learn.goal_met") == [], "neither day reached five"


async def test_the_clock_can_be_moved_in_development_only(client, db, family, seeded, monkeypatch):
    """A job only provable on a Sunday is a job nobody checks before the first one."""
    await practise(db, family, days=["2026-08-16"])

    # In production, with a real scheduler at the door, the clock is still fixed.
    monkeypatch.setattr(settings(), "environment", "production")
    monkeypatch.setattr(settings(), "push_task_service_account", "scheduler@koda.iam.gserviceaccount.com")
    monkeypatch.setattr(settings(), "push_task_audience", "https://api.koda.example")
    monkeypatch.setattr(
        "app.services.google_identity.verify_oidc",
        lambda token, audience: {
            "email": "scheduler@koda.iam.gserviceaccount.com",
            "email_verified": True,
        },
    )
    scheduler = {"Authorization": "Bearer a.real.one"}

    refused = await client.post("/tasks/weekly-summary?at=2026-08-16T16:00:00Z", headers=scheduler)
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "task_time_travel_forbidden"
    assert await told(db, "learn.weekly_summary") == []

    # The same call, on a laptop, is how somebody proves this before Sunday.
    monkeypatch.setattr(settings(), "environment", "development")
    allowed = await client.post("/tasks/weekly-summary?at=2026-08-16T16:00:00Z", headers=scheduler)
    assert allowed.json()["summaries"] == 1
    assert len(await told(db, "learn.weekly_summary")) == 1


async def test_one_day_of_practice_is_one_day_not_one_days(db, family, seeded):
    """The most likely week there is, and the sentence a bare number gets wrong."""
    await practise(db, family, days=["2026-08-16"])

    await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    assert (await told(db, "learn.weekly_summary"))[0]["body"] == "Mia practised 1 day this week."
