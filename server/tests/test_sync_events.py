"""Events up: idempotent, rolled up, and scoped to the family that sent them."""

import pytest


@pytest.fixture
async def parent(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


def event(event_id: str, **overrides) -> dict:
    base = {
        "id": event_id,
        "ts": "2026-08-19T09:00:00.000Z",
        "type": "answer_submitted",
        "sessionId": "s_1",
        "learnerId": "l_mia",
        "seq": 1,
        "skillId": "counting",
        "activityId": "counting-quest",
        "lessonId": "count-in-a-row",
        "conceptKey": "corresponder",
        "localDay": "2026-08-19",
        "correct": True,
        "attempt": 1,
        "responseMs": 2400,
        "supportsUsed": 0,
    }
    base.update(overrides)
    return base


async def test_a_batch_lands_and_rolls_up(client, parent):
    body = {
        "schemaVersion": 1,
        "events": [
            event("e_1"),
            event("e_2", correct=False, errorKind="off_by_one", responseMs=5200),
            event("e_3", type="support_used", support="hint"),
            event("e_4", type="lesson_completed", questionsAnswered=2, correctFirstTry=1),
        ],
    }
    r = await client.post("/sync/push", json=body, headers=parent)
    assert r.status_code == 200, r.text
    assert r.json()["accepted"] == 4
    assert r.json()["duplicates"] == 0

    profile = (await client.get("/sync/profile/l_mia", headers=parent)).json()
    assert profile["eventsStored"] == 4

    totals = profile["concepts"][0]
    assert totals["conceptKey"] == "corresponder"
    assert totals["questionsAnswered"] == 2
    assert totals["correctFirstTry"] == 1
    assert totals["supportsUsed"] == 1
    assert totals["lessonsCompleted"] == 1
    assert totals["errors"] == {"off_by_one": 1}
    assert totals["practisedOn"] == ["2026-08-19"]
    assert totals["skillIds"] == ["counting"]


async def test_replaying_a_batch_changes_nothing(client, parent):
    """The acceptance test for the whole design: a retry must not inflate totals."""
    body = {"schemaVersion": 1, "events": [event("e_1"), event("e_2")]}

    first = await client.post("/sync/push", json=body, headers=parent)
    assert first.json()["accepted"] == 2

    second = await client.post("/sync/push", json=body, headers=parent)
    assert second.json()["accepted"] == 0
    assert second.json()["duplicates"] == 2

    profile = (await client.get("/sync/profile/l_mia", headers=parent)).json()
    assert profile["eventsStored"] == 2
    assert profile["concepts"][0]["questionsAnswered"] == 2


async def test_a_partly_seen_batch_only_counts_the_new_half(client, parent):
    await client.post("/sync/push", json={"events": [event("e_1")]}, headers=parent)
    r = await client.post(
        "/sync/push", json={"events": [event("e_1"), event("e_2")]}, headers=parent
    )
    assert r.json()["accepted"] == 1
    assert r.json()["duplicates"] == 1

    profile = (await client.get("/sync/profile/l_mia", headers=parent)).json()
    assert profile["concepts"][0]["questionsAnswered"] == 2


async def test_out_of_order_arrival_does_not_move_last_seen_backwards(client, parent):
    await client.post(
        "/sync/push",
        json={"events": [event("e_late", ts="2026-08-19T12:00:00.000Z")]},
        headers=parent,
    )
    await client.post(
        "/sync/push",
        json={"events": [event("e_early", ts="2026-08-19T08:00:00.000Z")]},
        headers=parent,
    )
    profile = (await client.get("/sync/profile/l_mia", headers=parent)).json()
    assert profile["concepts"][0]["lastSeenTs"] == "2026-08-19T12:00:00.000Z"


async def test_unknown_fields_ride_along_instead_of_being_refused(client, parent):
    """An older server must never lock out a newer tablet."""
    r = await client.post(
        "/sync/push",
        json={"events": [event("e_new", somethingAddedLater={"nested": True})]},
        headers=parent,
    )
    assert r.status_code == 200
    assert r.json()["accepted"] == 1


async def test_one_family_cannot_read_another_learner(client, signup_body):
    a = (await client.post("/auth/signup", json=signup_body("a@example.com"))).json()
    b = (await client.post("/auth/signup", json=signup_body("b@example.com"))).json()

    await client.post(
        "/sync/push",
        json={"events": [event("e_1")]},
        headers={"Authorization": f"Bearer {a['accessToken']}"},
    )

    seen_by_b = await client.get(
        "/sync/profile/l_mia", headers={"Authorization": f"Bearer {b['accessToken']}"}
    )
    assert seen_by_b.status_code == 200
    assert seen_by_b.json()["eventsStored"] == 0
    assert seen_by_b.json()["concepts"] == []


async def test_staff_cannot_push_into_a_family(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(db, "admin@example.com", passwords.hash_password("123456"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "admin@example.com", "password": "123456"})
    ).json()

    r = await client.post(
        "/sync/push",
        json={"events": [event("e_1")]},
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
    )
    assert r.status_code == 403


async def test_retries_do_not_count_as_new_questions(client, parent):
    """The client folds first attempts only; the server must agree exactly."""
    body = {
        "events": [
            event("e_try1", correct=False, attempt=1, errorKind="off_by_one", responseMs=3000),
            event("e_try2", correct=True, attempt=2, responseMs=1500),
        ]
    }
    await client.post("/sync/push", json=body, headers=parent)

    totals = (await client.get("/sync/profile/l_mia", headers=parent)).json()["concepts"][0]
    assert totals["questionsAnswered"] == 1, "a retry is not a second question"
    assert totals["correctFirstTry"] == 0, "right on the second go is not first-try"
    assert totals["totalResponseMs"] == 3000, "only the first attempt's time counts"
    assert totals["errors"] == {"off_by_one": 1}


async def test_a_correct_answer_after_a_hint_is_not_first_try(client, parent):
    await client.post(
        "/sync/push",
        json={"events": [event("e_1", correct=True, attempt=1, supportsUsed=1)]},
        headers=parent,
    )
    totals = (await client.get("/sync/profile/l_mia", headers=parent)).json()["concepts"][0]
    assert totals["questionsAnswered"] == 1
    assert totals["correctFirstTry"] == 0
