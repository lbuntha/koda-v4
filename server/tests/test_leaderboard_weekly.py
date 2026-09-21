"""Phase 3: weekly scores never widen the Phase 1/2 privacy boundary."""

from datetime import UTC, datetime, timedelta

from app.models.common import now
from app.services.leaderboard import sanitise_rules, week_bounds, xp_for_event


def auth(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def family_with_child(client, signup_body, email: str, name: str):
    parent = (await client.post("/auth/signup", json=signup_body(email))).json()
    learner = (
        await client.post(
            "/learners", headers=auth(parent), json={"displayName": name}
        )
    ).json()
    child = (
        await client.post(f"/auth/switch/{learner['id']}", headers=auth(parent))
    ).json()
    return parent, learner, child


async def opt_in(client, family, nickname: str):
    parent, learner, _ = family
    response = await client.patch(
        f"/leaderboard/privacy/{learner['id']}",
        headers=auth(parent),
        json={"sharingEnabled": True, "nickname": nickname, "confirmed": True},
    )
    assert response.status_code == 200, response.text


async def opt_in_public(client, family, nickname: str):
    parent, learner, _ = family
    response = await client.patch(
        f"/leaderboard/privacy/{learner['id']}",
        headers=auth(parent),
        json={
            "visibility": "public",
            "nickname": nickname,
            "confirmed": True,
            "publicConfirmed": True,
        },
    )
    assert response.status_code == 200, response.text


async def connect(client, first, second):
    invite = (
        await client.post(
            f"/leaderboard/buddies/{first[1]['id']}/invites",
            headers=auth(first[0]),
        )
    ).json()
    response = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(second[0]),
        json={"learnerId": second[1]["id"], "code": invite["code"]},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def completed(db, family, *, day: str, correct: int, total: int, **extra):
    parent, learner, _ = family
    row = {
        "familyId": parent["familyId"],
        "learnerId": learner["id"],
        "eventId": f"e_{learner['id']}_{await db.events.count_documents({})}",
        "type": "lesson_completed",
        "localDay": day,
        "questionsAnswered": total,
        "correctFirstTry": correct,
        "receivedAt": now(),
        **extra,
    }
    await db.events.insert_one(row)


async def test_private_requester_gets_an_empty_board(client, signup_body):
    first = await family_with_child(client, signup_body, "one@example.com", "Mia")
    second = await family_with_child(client, signup_body, "two@example.com", "Sam")
    await connect(client, first, second)
    await opt_in(client, second, "SunnySam")

    response = await client.get(
        f"/leaderboard/{first[1]['id']}", headers=auth(first[0])
    )

    assert response.status_code == 200, response.text
    assert response.json()["sharingEnabled"] is False
    assert response.json()["rows"] == []


async def test_public_requires_separate_confirmation(client, db, signup_body):
    family = await family_with_child(client, signup_body, "one@example.com", "Mia")
    response = await client.patch(
        f"/leaderboard/privacy/{family[1]['id']}",
        headers=auth(family[0]),
        json={"visibility": "public", "nickname": "StarFox", "confirmed": True},
    )
    assert response.status_code == 422
    assert await db.leaderboard_privacy.count_documents({}) == 0


async def test_public_board_is_top_twenty_plus_self(client, db, signup_body):
    family = await family_with_child(client, signup_body, "one@example.com", "Mia")
    await opt_in_public(client, family, "ZedSelf")
    start, _ = week_bounds(now(), 0)
    await completed(db, family, day=start.isoformat(), correct=5, total=5)

    for index in range(21):
        family_id = f"f_public_{index:02d}"
        learner_id = f"l_public_{index:02d}"
        nickname = f"Alpha{index:02d}"
        await db.learners.insert_one(
            {
                "_id": learner_id,
                "familyId": family_id,
                "displayName": f"Real {index}",
                "avatarSeed": f"avatar_{index}",
                "createdAt": now(),
                "updatedAt": now(),
            }
        )
        await db.leaderboard_privacy.insert_one(
            {
                "_id": learner_id,
                "familyId": family_id,
                "learnerId": learner_id,
                "sharingEnabled": True,
                "visibility": "public",
                "nickname": nickname,
            }
        )
        await db.events.insert_one(
            {
                "familyId": family_id,
                "learnerId": learner_id,
                "eventId": f"public_{index}",
                "type": "lesson_completed",
                "localDay": start.isoformat(),
                "questionsAnswered": 5,
                "correctFirstTry": 5,
                "receivedAt": now(),
            }
        )

    body = (
        await client.get(
            f"/leaderboard/public/{family[1]['id']}", headers=auth(family[0])
        )
    ).json()
    assert body["scope"] == "public"
    assert body["sharingEnabled"] is True
    assert len(body["rows"]) == 21
    assert [row["rank"] for row in body["rows"]] == [*range(1, 21), 22]
    assert body["rows"][-1]["isYou"] is True
    assert body["rows"][-1]["nickname"] == "ZedSelf"
    assert all(row["nickname"] != "Alpha20" for row in body["rows"])


async def test_buddies_only_opt_in_never_appears_public(client, signup_body):
    first = await family_with_child(client, signup_body, "one@example.com", "Mia")
    second = await family_with_child(client, signup_body, "two@example.com", "Sam")
    await opt_in(client, first, "BuddyOnly")
    await opt_in_public(client, second, "PublicSam")

    body = (
        await client.get(
            f"/leaderboard/public/{first[1]['id']}", headers=auth(first[0])
        )
    ).json()
    assert body["sharingEnabled"] is False
    assert [row["nickname"] for row in body["rows"]] == ["PublicSam"]


async def test_public_board_requires_a_signed_in_learner(client):
    response = await client.get("/leaderboard/public/l_anything")
    assert response.status_code == 401


async def test_board_has_only_self_and_opted_in_accepted_buddies(
    client, db, signup_body
):
    first = await family_with_child(client, signup_body, "one@example.com", "Mia")
    second = await family_with_child(client, signup_body, "two@example.com", "Sam")
    opted_out = await family_with_child(
        client, signup_body, "three@example.com", "Private child"
    )
    non_buddy = await family_with_child(
        client, signup_body, "four@example.com", "Not connected"
    )
    await connect(client, first, second)
    await connect(client, first, opted_out)
    await opt_in(client, first, "StarFox")
    await opt_in(client, second, "SunnySam")
    await opt_in(client, non_buddy, "Outside")

    start, _ = week_bounds(now(), 0)
    await completed(db, first, day=start.isoformat(), correct=5, total=5)
    await completed(db, second, day=start.isoformat(), correct=4, total=5)
    await completed(db, opted_out, day=start.isoformat(), correct=5, total=5)
    await completed(db, non_buddy, day=start.isoformat(), correct=5, total=5)
    body = (
        await client.get(
            f"/leaderboard/{first[1]['id']}", headers=auth(first[0])
        )
    ).json()

    assert body["sharingEnabled"] is True
    assert [(row["nickname"], row["weeklyXp"]) for row in body["rows"]] == [
        ("StarFox", 20),
        ("SunnySam", 14),
    ]
    assert body["rows"][0]["isYou"] is True
    assert body["rows"][1]["isYou"] is False
    serialized = str(body)
    for forbidden in (
        first[1]["id"],
        second[1]["id"],
        first[0]["familyId"],
        "one@example.com",
        "Mia",
    ):
        assert forbidden not in serialized


async def test_scores_ignore_claimed_xp_and_nonqualifying_events(
    client, db, signup_body
):
    family = await family_with_child(client, signup_body, "one@example.com", "Mia")
    await opt_in(client, family, "BlueComet")
    start, _ = week_bounds(now(), 0)
    await completed(
        db,
        family,
        day=start.isoformat(),
        correct=0,
        total=5,
        xpEarned=999_999,
    )
    await completed(
        db,
        family,
        day=(start - timedelta(days=1)).isoformat(),
        correct=5,
        total=5,
    )
    await db.events.insert_one(
        {
            "familyId": family[0]["familyId"],
            "learnerId": family[1]["id"],
            "eventId": "abandoned",
            "type": "lesson_abandoned",
            "localDay": start.isoformat(),
            "questionsAnswered": 5,
            "correctFirstTry": 5,
            "receivedAt": now(),
        }
    )

    body = (
        await client.get(
            f"/leaderboard/{family[1]['id']}", headers=auth(family[0])
        )
    ).json()
    assert body["rows"][0]["weeklyXp"] == 8


async def test_replayed_sync_event_is_counted_once(client, db, signup_body):
    family = await family_with_child(client, signup_body, "one@example.com", "Mia")
    await opt_in(client, family, "BlueComet")
    start, _ = week_bounds(now(), 0)
    event = {
        "id": "weekly-replay-1",
        "ts": now().isoformat(),
        "type": "lesson_completed",
        "sessionId": "session-1",
        "learnerId": family[1]["id"],
        "skillId": "addition",
        "activityId": "count-tray",
        "lessonId": "lesson-1",
        "conceptKey": "addition.within-10",
        "localDay": start.isoformat(),
        "questionsAnswered": 5,
        "correctFirstTry": 5,
        "xpEarned": 500_000,
    }
    first = await client.post(
        "/sync/push", headers=auth(family[2]), json={"events": [event]}
    )
    replay = await client.post(
        "/sync/push", headers=auth(family[2]), json={"events": [event]}
    )
    assert first.status_code == 200, first.text
    assert first.json()["accepted"] == 1
    assert replay.status_code == 200, replay.text
    assert replay.json()["duplicates"] == 1

    body = (
        await client.get(
            f"/leaderboard/{family[1]['id']}", headers=auth(family[0])
        )
    ).json()
    assert body["rows"][0]["weeklyXp"] == 20
    assert await db.events.count_documents({"eventId": event["id"]}) == 1


async def test_removal_and_revocation_hide_a_buddy_immediately(
    client, signup_body
):
    first = await family_with_child(client, signup_body, "one@example.com", "Mia")
    second = await family_with_child(client, signup_body, "two@example.com", "Sam")
    relationship = await connect(client, first, second)
    await opt_in(client, first, "StarFox")
    await opt_in(client, second, "SunnySam")
    path = f"/leaderboard/{first[1]['id']}"
    assert len((await client.get(path, headers=auth(first[0]))).json()["rows"]) == 2

    await client.patch(
        f"/leaderboard/privacy/{second[1]['id']}",
        headers=auth(second[0]),
        json={"sharingEnabled": False},
    )
    assert len((await client.get(path, headers=auth(first[0]))).json()["rows"]) == 1

    await opt_in(client, second, "SunnySam")
    removed = await client.delete(
        f"/leaderboard/buddies/{first[1]['id']}/{relationship['relationshipId']}",
        headers=auth(first[0]),
    )
    assert removed.status_code == 204
    assert len((await client.get(path, headers=auth(first[0]))).json()["rows"]) == 1


async def test_board_is_family_scoped_and_a_child_can_only_read_self(
    client, signup_body
):
    first = await family_with_child(client, signup_body, "one@example.com", "Mia")
    second = await family_with_child(client, signup_body, "two@example.com", "Sam")

    cross_family = await client.get(
        f"/leaderboard/{first[1]['id']}", headers=auth(second[0])
    )
    child_other = await client.get(
        f"/leaderboard/{second[1]['id']}", headers=auth(first[2])
    )
    child_self = await client.get(
        f"/leaderboard/{first[1]['id']}", headers=auth(first[2])
    )

    assert cross_family.status_code == 404
    assert child_other.status_code == 404
    assert child_self.status_code == 200


def test_week_bounds_use_monday_in_the_requested_offset():
    sunday_utc = datetime(2026, 9, 20, 23, 30, tzinfo=UTC)
    assert week_bounds(sunday_utc, 0) == (
        datetime(2026, 9, 14).date(),
        datetime(2026, 9, 20).date(),
    )
    assert week_bounds(sunday_utc, 60) == (
        datetime(2026, 9, 21).date(),
        datetime(2026, 9, 27).date(),
    )


def test_scoring_rules_are_bounded_and_match_javascript_rounding():
    rules = sanitise_rules(
        {
            "xpPerLevel": 501,
            "oneStarShare": 0.5,
            "twoStarShare": 0.25,
            "twoStarAt": 0.8,
            "threeStarAt": 0.7,
        }
    )
    assert rules.xp_per_level == 500
    assert rules.two_star_share == 0.5
    assert rules.three_star_at == 0.8
    assert xp_for_event(
        {"questionsAnswered": 10, "correctFirstTry": 8}, rules
    ) == 500
    half = sanitise_rules({"xpPerLevel": 5, "oneStarShare": 0.5})
    assert xp_for_event(
        {"questionsAnswered": 4, "correctFirstTry": 0}, half
    ) == 3
