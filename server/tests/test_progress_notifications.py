"""Phases 3 and 4 of parent notifications: time limits, new devices, mastered and stuck.

Most tests drive `progress.after_sync` directly with the documents a sync
inserted and the statuses `progress.snapshot` read before the rollup moved —
exactly what `services/sync.py` hands it — so each rule is exercised without a
child's device in the loop. One test goes end to end through `/sync/push`.
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.models.common import now
from app.repos import progress_marks
from app.services import mail, mastery, progress, push
from app.services import tasks as task_service
from app.settings import settings
from app.system_defaults import DEFAULT_SETTINGS

CASES = json.loads((Path(__file__).parent / "fixtures" / "mastery_cases.json").read_text())
SUNDAY_EVENING_UTC = datetime(2026, 8, 16, 16, 0, tzinfo=UTC)
TOKEN = "m" * 140


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
    mia = (await client.post("/learners", headers=parent, json={"displayName": "Mia"})).json()
    member = await db.memberships.find_one({})
    return {"familyId": member["familyId"], "userId": member["userId"], "mia": mia["id"]}


async def set_totals(db, family, concept: str, **totals):
    await db.concept_totals.update_one(
        {"familyId": family["familyId"], "learnerId": family["mia"], "conceptKey": concept},
        {"$set": totals},
        upsert=True,
    )


def batch(family, day: str, **extra) -> list[dict]:
    return [{"familyId": family["familyId"], "learnerId": family["mia"], "localDay": day, "type": "lesson_completed", **extra}]


async def told(db, kind: str) -> list[dict]:
    return await db.notifications.find({"kind": kind}).to_list(length=50)


# --- the mastery rule --------------------------------------------------------


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_the_server_judges_a_concept_as_the_app_does(case):
    """The same fixture is asserted against `masteryFrom` in masteryParity.test.ts."""
    assert mastery.status_of(case["totals"]) == case["status"]


def test_a_concept_is_named_by_its_lesson():
    assert mastery.lesson_name("count-all") == "Count Them All"
    assert mastery.join_names(["A", "B", "A", "C"]) == "A, B and C"


# --- mastered ----------------------------------------------------------------


async def test_a_lesson_becoming_secure_is_told_once(db, family, seeded):
    await set_totals(db, family, "count-all", questionsAnswered=10, correctFirstTry=9, lessonsCompleted=1,
                     practisedOn=["2026-08-15", "2026-08-16"])
    before = {(family["mia"], "count-all"): "practising"}

    await progress.after_sync(db, family["familyId"], batch(family, "2026-08-16"), before)
    await progress.after_sync(db, family["familyId"], batch(family, "2026-08-16"), before)

    [row] = await told(db, "learn.mastered")
    assert row["title"] == "Mia mastered Count Them All"


async def test_an_already_secure_lesson_is_not_news(db, family, seeded):
    await set_totals(db, family, "count-all", questionsAnswered=10, correctFirstTry=9, lessonsCompleted=1,
                     practisedOn=["2026-08-15", "2026-08-16"])

    await progress.after_sync(
        db, family["familyId"], batch(family, "2026-08-16"), {(family["mia"], "count-all"): "mastered"}
    )

    assert await told(db, "learn.mastered") == []


async def test_several_lessons_on_one_day_are_one_message(db, family, seeded):
    for concept in ("count-all", "count-on"):
        await set_totals(db, family, concept, questionsAnswered=10, correctFirstTry=10, lessonsCompleted=1,
                         practisedOn=["2026-08-15", "2026-08-16"])
    before = {(family["mia"], "count-all"): "practising", (family["mia"], "count-on"): "practising"}

    await progress.after_sync(db, family["familyId"], batch(family, "2026-08-16"), before)

    [row] = await told(db, "learn.mastered")
    assert row["title"] == f"Mia mastered Count Them All and {mastery.lesson_name('count-on')}"
    marks = await progress_marks.for_days(db, family["familyId"], family["mia"], ["2026-08-16"])
    assert len([m for m in marks if m["kind"] == "mastered"]) == 2


# --- stuck -------------------------------------------------------------------


async def test_a_stuck_lesson_is_told_once_a_week_by_push_and_email(db, family, seeded, outbox):
    await set_totals(db, family, "count-all", questionsAnswered=10, correctFirstTry=3,
                     practisedOn=["2026-08-14", "2026-08-16"])
    before = {(family["mia"], "count-all"): "struggling"}

    await progress.after_sync(db, family["familyId"], batch(family, "2026-08-16"), before)
    await progress.after_sync(db, family["familyId"], batch(family, "2026-08-16"), before)

    [row] = await told(db, "learn.stuck")
    assert row["title"] == "Mia could use a hand"
    assert "Count Them All is tricky" in row["body"]
    [letter] = outbox
    assert letter["subject"] == "A tip for Mia's Count Them All"


async def test_one_bad_day_is_not_stuck(db, family, seeded, outbox):
    await set_totals(db, family, "count-all", questionsAnswered=10, correctFirstTry=3, practisedOn=["2026-08-16"])

    await progress.after_sync(
        db, family["familyId"], batch(family, "2026-08-16"), {(family["mia"], "count-all"): "learning"}
    )

    assert await told(db, "learn.stuck") == []


# --- the time limit ----------------------------------------------------------


async def test_a_spent_time_limit_is_told_once_a_day(db, family, seeded):
    events = batch(family, "2026-08-16", type="daily_limit_reached", limitMinutes=30)

    await progress.after_sync(db, family["familyId"], events, {})
    await progress.after_sync(db, family["familyId"], events, {})

    [row] = await told(db, "learn.time_limit")
    assert row["title"] == "Mia finished today's time"
    assert row["body"] == "30 minutes used. Koda opens again tomorrow."


async def test_a_limit_event_goes_through_sync_end_to_end(client, parent, db, family, seeded):
    body = {
        "deviceId": "d_test",
        "events": [
            {
                "id": "ev_limit_1",
                "ts": "2026-08-16T10:00:00Z",
                "type": "daily_limit_reached",
                "sessionId": "s1",
                "learnerId": family["mia"],
                "seq": 1,
                "tzOffsetMinutes": 120,
                "localDay": "2026-08-16",
                "limitMinutes": 45,
            }
        ],
        "mutations": [],
    }

    response = await client.post("/sync/push", headers=parent, json=body)

    assert response.status_code == 200, response.text
    [row] = await told(db, "learn.time_limit")
    assert row["body"].startswith("45 minutes used")


# --- a child's new device ----------------------------------------------------


async def test_a_child_joining_on_a_new_device_has_its_own_notice(client, parent, db, family, seeded, outbox):
    code = (await client.post(f"/learners/{family['mia']}/join-code", headers=parent)).json()

    await client.post("/auth/join", json={"code": code["code"], "deviceName": "Mia's tablet"})

    [row] = await told(db, "family.child_device_joined")
    assert row["title"] == "Mia is on a new device"
    assert await told(db, "device.new_signin") == []
    assert outbox[0]["subject"] == "Mia joined Koda on a new device"


# --- the daily cap -----------------------------------------------------------


async def test_the_daily_cap_quiets_the_lowest_priorities_but_keeps_the_record(client, parent, db, family, seeded):
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN})
    for _ in range(2):
        await push.send(db, to=push.Recipient(family_id=family["familyId"]), kind="learn.stuck", title="t", body="b")

    await push.send(db, to=push.Recipient(family_id=family["familyId"]), kind="learn.mastered", title="t", body="b")
    await push.send(db, to=push.Recipient(family_id=family["familyId"]), kind="learn.stuck", title="t", body="b")

    mastered = await db.push_log.find_one({"kind": "learn.mastered"})
    assert mastered["devices"] == 0, "capped: nothing rang"
    assert len(await told(db, "learn.mastered")) == 1, "but it is still under the bell"
    assert await db.push_log.count_documents({"kind": "learn.stuck", "devices": {"$gt": 0}}) == 3


# --- summaries and the overview ----------------------------------------------


async def test_the_weekly_email_says_what_was_mastered_and_what_is_next(db, family, seeded, outbox):
    await db.events.insert_one(
        {"_id": "ev1", "familyId": family["familyId"], "eventId": "e1", "learnerId": family["mia"],
         "type": "lesson_completed", "localDay": "2026-08-16", "tzOffsetMinutes": 120, "durationMs": 600_000,
         "receivedAt": now()}
    )
    await progress_marks.record(db, family_id=family["familyId"], learner_id=family["mia"], kind="mastered",
                                local_day="2026-08-15", concept_key="count-all")
    await set_totals(db, family, "count-on", questionsAnswered=10, correctFirstTry=8, practisedOn=["2026-08-16"])

    await task_service.weekly_summary(db, at=SUNDAY_EVENING_UTC)

    [letter] = outbox
    assert "mastered Count Them All" in letter["body"]
    assert f"next up: {mastery.lesson_name('count-on')}" in letter["body"]


async def test_a_stuck_child_outranks_an_absence_on_home(client, parent, db, family, seeded):
    local_today = (datetime.now(UTC) + timedelta(minutes=120)).date().isoformat()
    await progress_marks.record(db, family_id=family["familyId"], learner_id=family["mia"], kind="stuck",
                                local_day=local_today, concept_key="count-all")

    body = (await client.get("/learners/overview", headers=parent)).json()

    assert body["attention"]["kind"] == "learn.stuck"
    assert body["attention"]["title"] == "Mia could use a hand"
