"""Rebus Rush group rooms: who may open one, who may join, and how a race is decided."""

import json
from pathlib import Path

import pytest

from app import rebus_room as rules
from app.repos import rebus as repo
from app.routers import rebus_rooms

SEED = json.loads((Path(__file__).parent.parent / "app" / "rebus_seed.json").read_text())


@pytest.fixture(autouse=True)
async def seeded(db):
    await repo.ensure_seed(db, SEED)


@pytest.fixture
def clock(monkeypatch):
    """The room's time, moved by the test."""
    now = {"ms": 1_000_000}
    monkeypatch.setattr(rebus_rooms, "_now_ms", lambda: now["ms"])
    return now


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def admin(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"), platform_role="admin")
    tokens = (await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def live(client, admin):
    assert (await client.post("/rebus/studio/approve-all", json={}, headers=admin)).json()["skipped"] == 0
    return (await client.post("/rebus/studio/publish", json={"note": "first"}, headers=admin)).json()


def seat(token):
    return {"X-Player-Token": token}


async def open_room(client, owner, **over):
    body = {"category": "food", "count": 3, "name": "Brave Tiger", "avatar": "tiger", **over}
    res = await client.post("/rebus/rooms", json=body, headers=owner)
    assert res.status_code == 201, res.text
    return res.json()


async def join(client, code, name="Clever Fox", avatar="fox", headers=None):
    return await client.post(f"/rebus/rooms/{code}/join", json={"name": name, "avatar": avatar}, headers=headers or {})


async def admit(client, code, host, **who):
    """Ask at the door and have the host accept; returns the seat as the joiner now sees it."""
    asked = (await join(client, code, **who)).json()
    assert asked["room"]["status"] == "pending", asked
    accepted = await client.post(f"/rebus/rooms/{code}/accept", json={"pid": asked["room"]["me"]["pid"]}, headers=host)
    assert accepted.status_code == 200, accepted.text
    room = (await client.get(f"/rebus/rooms/{code}", headers=seat(asked["playerToken"]), )).json()
    return {"playerToken": asked["playerToken"], "room": room}


def test_a_code_is_forgiving_of_how_it_was_typed():
    assert rules.normalize_code(" koda-ab3 xyz ") == "AB3XYZ"
    assert rules.normalize_code("ab3xyz") == "AB3XYZ"
    assert len(rules.make_code()) == rules.CODE_LENGTH
    assert not set(rules.make_code()) & set("0O1IL")


def test_points_fall_with_hints_but_never_below_one():
    assert [rules.points_for(h, per_puzzle=3, hint_cost=1) for h in range(5)] == [3, 2, 1, 1, 1]
    assert rules.points_for(2, per_puzzle=8, hint_cost=0) == 8


def room_for_tick(**over):
    base = {
        "status": "playing",
        "index": 0,
        "puzzleStartMs": 1000,
        "endedMs": None,
        "results": [],
        "puzzles": [{}, {}],
        "settings": {"puzzleLimitSec": 30},
    }
    return {**base, **over}


def test_time_alone_ends_a_puzzle_then_moves_on_then_finishes():
    room = room_for_tick()
    assert rules.tick(room, 1000 + 29_999) is None
    ended = rules.tick(room, 1000 + 30_000)
    assert ended["endedMs"] == 31_000 and ended["results"][0]["winnerPid"] is None and ended["index"] == 0
    after = rules.tick(room, 31_000 + rules.REVEAL_MS)
    assert after["index"] == 1 and after["endedMs"] is None and after["puzzleStartMs"] == 31_000 + rules.REVEAL_MS
    # Away for ages: told where the room is now, which is the end.
    assert rules.tick(room, 10_000_000)["status"] == "finished"


def test_equal_scores_share_a_place():
    room = {
        "players": [
            {"pid": "a", "score": 5, "joinedMs": 1},
            {"pid": "b", "score": 5, "joinedMs": 2},
            {"pid": "c", "score": 1, "joinedMs": 3},
        ]
    }
    assert [(s["pid"], s["place"]) for s in rules.standings(room)] == [("a", 1), ("b", 1), ("c", 3)]


async def test_only_a_signed_in_user_can_open_a_room(client, owner, clock):
    assert (
        await client.post("/rebus/rooms", json={"category": "food", "count": 3, "name": "Brave Tiger", "avatar": "tiger"})
    ).status_code == 401
    made = await open_room(client, owner)
    assert len(made["room"]["code"]) == 6 and made["room"]["me"]["isHost"] and made["room"]["status"] == "lobby"


async def test_a_nickname_and_avatar_must_come_from_the_lists(client, owner, clock):
    bad = await client.post("/rebus/rooms", json={"category": "food", "count": 3, "name": "Little Timmy", "avatar": "tiger"}, headers=owner)
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "bad_nickname"
    made = await open_room(client, owner)
    assert (await join(client, made["room"]["code"], name="Sam", avatar="fox")).status_code == 400
    assert (await join(client, made["room"]["code"], avatar="spaceship")).status_code == 400
    choices = (await client.get("/rebus/rooms/choices")).json()
    assert "Brave Tiger" in choices["nicknames"] and "tiger" in choices["avatars"]


async def test_a_guest_joins_with_only_the_code_and_a_koda_user_is_recorded_as_themselves(client, owner, signup_body, clock):
    made = await open_room(client, owner)
    code = made["room"]["code"]
    host = seat(made["playerToken"])
    guest = await admit(client, code.lower(), host)
    assert guest["room"]["me"]["isKodaUser"] is False and len(guest["room"]["players"]) == 2

    other = (await client.post("/auth/signup", json=signup_body("friend@example.com"))).json()
    friend_auth = {"Authorization": f"Bearer {other['accessToken']}"}
    signed = await admit(client, code, host, name="Happy Panda", avatar="panda", headers=friend_auth)
    assert signed["room"]["me"]["isKodaUser"] is True
    # A guest sees who is a Koda user, and nothing else about them.
    assert {p["name"]: p["isKodaUser"] for p in signed["room"]["players"]} == {
        "Brave Tiger": True,
        "Clever Fox": False,
        "Happy Panda": True,
    }


async def test_the_door_refuses_a_taken_name_a_locked_room_and_an_unknown_code(client, owner, clock):
    made = await open_room(client, owner)
    code = made["room"]["code"]
    assert (await join(client, "ZZZZZZ")).status_code == 404
    assert (await join(client, code, name="Brave Tiger")).json()["error"]["code"] == "name_taken"
    assert (await join(client, code, name="Clever Fox")).status_code == 200
    # Someone already waiting under that name holds it.
    assert (await join(client, code, name="Clever Fox")).json()["error"]["code"] == "name_taken"

    second = await open_room(client, owner)
    await client.post(f"/rebus/rooms/{second['room']['code']}/lock", json={"locked": True}, headers=seat(second["playerToken"]))
    assert (await join(client, second["room"]["code"])).json()["error"]["code"] == "room_locked"


async def test_nobody_sits_down_until_the_host_accepts(client, owner, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    asked = (await join(client, code)).json()
    me, token = asked["room"]["me"]["pid"], seat(asked["playerToken"])
    # At the door: waiting, told nothing about who is inside, and not yet a player.
    assert asked["room"]["status"] == "pending" and asked["room"]["players"] == []
    waiting = (await client.get(f"/rebus/rooms/{code}", headers=token)).json()
    assert waiting["status"] == "pending" and "requests" not in waiting
    assert (await client.post(f"/rebus/rooms/{code}/start", headers=token)).status_code == 403
    # The host sees the request; a request cannot answer itself.
    lobby = (await client.get(f"/rebus/rooms/{code}", headers=host)).json()
    assert [r["name"] for r in lobby["requests"]] == ["Clever Fox"] and len(lobby["players"]) == 1
    assert (await client.post(f"/rebus/rooms/{code}/accept", json={"pid": me}, headers=token)).status_code == 403
    # Accepted: the same token is now a seat in the lobby.
    await client.post(f"/rebus/rooms/{code}/accept", json={"pid": me}, headers=host)
    seated = (await client.get(f"/rebus/rooms/{code}", headers=token)).json()
    assert seated["status"] == "lobby" and len(seated["players"]) == 2 and "requests" not in seated
    assert (await client.get(f"/rebus/rooms/{code}", headers=host)).json()["requests"] == []


async def test_a_declined_request_is_turned_away_and_the_room_can_fill_only_by_accepting(client, owner, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    no = (await join(client, code)).json()
    await client.post(f"/rebus/rooms/{code}/decline", json={"pid": no["room"]["me"]["pid"]}, headers=host)
    assert (await client.get(f"/rebus/rooms/{code}", headers=seat(no["playerToken"]))).status_code == 403
    # Full is decided when the host accepts, not when someone knocks.
    for n in rules.NICKNAMES[1:4]:
        await admit(client, code, host, name=n)
    extra = (await join(client, code, name=rules.NICKNAMES[5])).json()
    res = await client.post(f"/rebus/rooms/{code}/accept", json={"pid": extra["room"]["me"]["pid"]}, headers=host)
    assert res.json()["error"]["code"] == "room_full"


async def test_a_request_that_stopped_asking_drops_off_the_hosts_list_and_a_waiter_can_withdraw(client, owner, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    gone = (await join(client, code)).json()
    clock["ms"] += rules.REQUEST_FRESH_MS + 1
    assert (await client.get(f"/rebus/rooms/{code}", headers=host)).json()["requests"] == []
    # Their name is free again for someone else.
    again = (await join(client, code)).json()
    assert again["room"]["status"] == "pending"
    await client.post(f"/rebus/rooms/{code}/leave", headers=seat(again["playerToken"]))
    assert (await client.get(f"/rebus/rooms/{code}", headers=host)).json()["requests"] == []
    assert gone["playerToken"]


async def test_only_the_host_starts_and_needs_a_friend_and_enough_puzzles(client, owner, live, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    assert (await client.post(f"/rebus/rooms/{code}/start", headers=host)).json()["error"]["code"] == "need_players"
    friend = await admit(client, code, host)
    assert (await client.post(f"/rebus/rooms/{code}/start", headers=seat(friend["playerToken"]))).status_code == 403
    started = (await client.post(f"/rebus/rooms/{code}/start", headers=host)).json()
    assert started["status"] == "playing" and started["total"] == 3 and started["locked"] is True
    # The door closes behind the start.
    assert (await join(client, code, name="Happy Panda", avatar="panda")).json()["error"]["code"] == "room_started"


async def test_no_published_puzzles_means_no_game(client, owner, clock):
    made = await open_room(client, owner)
    await admit(client, made["room"]["code"], seat(made["playerToken"]))
    res = await client.post(f"/rebus/rooms/{made['room']['code']}/start", headers=seat(made["playerToken"]))
    assert res.json()["error"]["code"] == "not_enough_puzzles"


async def test_a_race_is_won_by_the_first_claim_and_the_room_plays_through_to_a_finish(client, owner, live, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    friend = await admit(client, code, host)
    guest = seat(friend["playerToken"])
    await client.post(f"/rebus/rooms/{code}/start", headers=host)

    # During the countdown nothing can be claimed.
    early = (await client.post(f"/rebus/rooms/{code}/solve", json={"index": 0, "hints": 0}, headers=guest)).json()
    assert early["won"] is False

    clock["ms"] += rules.COUNTDOWN_MS + 4_000
    first = (await client.post(f"/rebus/rooms/{code}/solve", json={"index": 0, "hints": 1}, headers=guest)).json()
    assert first["won"] is True and first["points"] == 2
    late = (await client.post(f"/rebus/rooms/{code}/solve", json={"index": 0, "hints": 0}, headers=host)).json()
    assert late["won"] is False and late["points"] == 0

    seen = (await client.get(f"/rebus/rooms/{code}", headers=host)).json()
    assert seen["endedMs"] is not None and seen["result"]["winnerPid"] == friend["room"]["me"]["pid"]
    assert {p["name"]: p["score"] for p in seen["players"]}["Clever Fox"] == 2

    # The reveal ends and the next puzzle starts, for everyone.
    clock["ms"] += rules.REVEAL_MS
    second = (await client.get(f"/rebus/rooms/{code}", headers=host)).json()
    assert second["index"] == 1 and second["endedMs"] is None
    # A claim for the puzzle that is over is refused.
    assert (await client.post(f"/rebus/rooms/{code}/solve", json={"index": 0}, headers=host)).json()["won"] is False

    # Nobody answers the rest: time runs out, then the room finishes.
    clock["ms"] += 10 * 60 * 1000
    done = (await client.get(f"/rebus/rooms/{code}", headers=host)).json()
    assert done["status"] == "finished"
    assert [s["place"] for s in done["standings"]] == [1, 2]

    again = (await client.post(f"/rebus/rooms/{code}/rematch", headers=host)).json()
    assert again["status"] == "lobby" and all(p["score"] == 0 for p in again["players"])


async def test_a_seat_needs_its_own_token(client, owner, clock):
    made = await open_room(client, owner)
    code = made["room"]["code"]
    assert (await client.get(f"/rebus/rooms/{code}")).status_code == 403
    assert (await client.get(f"/rebus/rooms/{code}", headers=seat("wrong"))).status_code == 403
    assert (await client.get(f"/rebus/rooms/{code}", headers=seat(made["playerToken"]))).status_code == 200


async def test_leaving_passes_the_host_on_and_the_last_to_leave_closes_the_room(client, owner, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    friend = await admit(client, code, host)
    await client.post(f"/rebus/rooms/{code}/leave", headers=host)
    room = (await client.get(f"/rebus/rooms/{code}", headers=seat(friend["playerToken"]))).json()
    assert room["me"]["isHost"] is True and len(room["players"]) == 1
    await client.post(f"/rebus/rooms/{code}/leave", headers=seat(friend["playerToken"]))
    assert (await client.get(f"/rebus/rooms/{code}", headers=seat(friend["playerToken"]))).status_code == 404


async def test_the_host_can_remove_a_player_before_the_game(client, owner, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    friend = await admit(client, code, host)
    after = (await client.post(f"/rebus/rooms/{code}/kick", json={"pid": friend["room"]["me"]["pid"]}, headers=host)).json()
    assert len(after["players"]) == 1
    assert (await client.get(f"/rebus/rooms/{code}", headers=seat(friend["playerToken"]))).status_code == 403


async def test_the_owner_can_switch_group_play_off(client, owner, db, clock):
    await db.system_settings.update_one({"settingId": "rebus.group"}, {"$set": {"value": False}}, upsert=True)
    res = await client.post("/rebus/rooms", json={"category": "food", "count": 3, "name": "Brave Tiger", "avatar": "tiger"}, headers=owner)
    assert res.status_code == 403 and res.json()["error"]["code"] == "group_off"


async def test_the_owner_can_close_the_door_to_guests_but_not_to_koda_users(client, owner, signup_body, db, clock):
    made = await open_room(client, owner)
    code = made["room"]["code"]
    await db.system_settings.update_one({"settingId": "rebus.settings"}, {"$set": {"value": '{"guestsAllowed": false}'}}, upsert=True)
    refused = await join(client, code)
    assert refused.status_code == 403 and refused.json()["error"]["code"] == "guests_off"
    other = (await client.post("/auth/signup", json=signup_body("friend@example.com"))).json()
    ok = await join(client, code, name="Happy Panda", avatar="panda", headers={"Authorization": f"Bearer {other['accessToken']}"})
    assert ok.status_code == 200 and ok.json()["room"]["status"] == "pending"


async def test_group_play_is_counted_in_numbers_only_and_only_the_owner_can_read_them(client, owner, admin, live, clock):
    made = await open_room(client, owner)
    code, host = made["room"]["code"], seat(made["playerToken"])
    friend = await admit(client, code, host)
    await client.post(f"/rebus/rooms/{code}/start", headers=host)
    clock["ms"] += 10 * 60 * 1000
    assert (await client.get(f"/rebus/rooms/{code}", headers=host)).json()["status"] == "finished"
    # A guest asks a grown-up: counted once, however many times they press it.
    for _ in range(3):
        assert (await client.post(f"/rebus/rooms/{code}/asked", headers=seat(friend["playerToken"]))).status_code == 200
    # A signed-in player pressing it is not a guest asking.
    await client.post(f"/rebus/rooms/{code}/asked", headers=host)

    totals = (await client.get("/rebus/rooms/report/summary?days=7", headers=admin)).json()["totals"]
    assert totals["roomsOpened"] == 1 and totals["requests"] == 1
    assert totals["seatsKoda"] == 1 and totals["seatsGuest"] == 1
    assert totals["gamesStarted"] == 1 and totals["playersStarted"] == 2 and totals["gamesFinished"] == 1
    assert totals["askedGrownUp"] == 1
    rows = (await client.get("/rebus/rooms/report/summary?days=7", headers=admin)).json()["rows"]
    assert len(rows) == 7 and sum(r["gamesFinished"] for r in rows) == 1

    # A player cannot read the owner's numbers.
    assert (await client.get("/rebus/rooms/report/summary", headers=owner)).status_code == 403
    assert (await client.get("/rebus/rooms/report/summary")).status_code in (401, 403)
