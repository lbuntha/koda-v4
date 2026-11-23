"""Playing a skill lesson together: who may open a room, and how a race is decided."""

import pytest

from app import rebus_room as rules
from app.repos import rebus_rooms as rooms_repo
from app.repos import skills as skills_repo
from app.routers import rebus_rooms
from app.skill_defaults import load_defaults

SKILL = "number-merge"
LESSON = "friends-of-ten"
#: The lesson's own question count, read from the bundled lessons rather than assumed.
COUNT = next(
    lesson["params"]["question"]["questionsPerRound"]
    for skill in load_defaults()
    if skill["id"] == SKILL
    for lesson in skill["lessons"]
    if lesson["id"] == LESSON
)


@pytest.fixture
def clock(monkeypatch):
    now = {"ms": 1_000_000}
    monkeypatch.setattr(rebus_rooms, "_now_ms", lambda: now["ms"])
    return now


@pytest.fixture
async def registry(db):
    """The bundled skills, with Number Merge published and raceable — what an operator would set."""
    for manifest in load_defaults():
        await skills_repo.seed_default(db, manifest)
    await db.skill_registry.update_one(
        {"id": SKILL},
        {"$set": {"status": "published"}, "$push": {"features": {"id": "group_play", "name": "Play together", "isEnabled": True}}},
    )


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


def seat(token):
    return {"X-Player-Token": token}


async def open_room(client, owner, **over):
    body = {"skill": SKILL, "lesson": LESSON, "name": "Brave Tiger", "avatar": "tiger", **over}
    return await client.post("/group/rooms", json=body, headers=owner)


async def ready_race(client, owner, clock, *, guests=("Clever Fox",)):
    """A room with the host and accepted guests, started and past its countdown."""
    made = (await open_room(client, owner)).json()
    code, host = made["room"]["code"], seat(made["playerToken"])
    tokens = {"host": made["playerToken"]}
    for name in guests:
        asked = (await client.post(f"/group/rooms/{code}/join", json={"name": name, "avatar": "fox"})).json()
        accepted = await client.post(f"/group/rooms/{code}/accept", json={"pid": asked["room"]["me"]["pid"]}, headers=host)
        assert accepted.status_code == 200, accepted.text
        tokens[name] = asked["playerToken"]
    started = await client.post(f"/group/rooms/{code}/start", headers=host)
    assert started.status_code == 200, started.text
    clock["ms"] += rules.COUNTDOWN_MS
    return code, tokens


async def report(client, code, token, answered, first_try, done=False):
    body = {"answered": answered, "firstTry": first_try, "done": done}
    res = await client.post(f"/group/rooms/{code}/progress", json=body, headers=seat(token))
    assert res.status_code == 200, res.text
    return res.json()


async def test_a_room_plays_one_lesson_of_a_skill_that_supports_it(client, owner, registry, clock):
    made = await open_room(client, owner)
    assert made.status_code == 201, made.text
    room = made.json()["room"]
    assert room["settings"]["game"] == "skill"
    assert room["settings"]["skill"] == SKILL and room["settings"]["lesson"] == LESSON
    assert room["settings"]["count"] == COUNT and room["settings"]["title"] == "Friends of 10"


async def test_a_skill_must_declare_group_play(client, owner, registry, clock):
    # Addition is published but does not declare the feature.
    res = await open_room(client, owner, skill="addition", lesson="count-all")
    assert res.status_code == 403 and res.json()["error"]["code"] == "group_unsupported"


async def test_switching_the_feature_off_in_the_skill_manager_closes_it(client, owner, registry, db, clock):
    await db.skill_registry.update_one({"id": SKILL, "features.id": "group_play"}, {"$set": {"features.$.isEnabled": False}})
    res = await open_room(client, owner)
    assert res.status_code == 403 and res.json()["error"]["code"] == "group_unsupported"


async def test_a_draft_skill_is_only_for_its_builders(client, owner, registry, db, clock):
    await db.skill_registry.update_one({"id": SKILL}, {"$set": {"status": "draft"}})
    res = await open_room(client, owner)
    assert res.status_code == 404 and res.json()["error"]["code"] == "skill_not_found"


async def test_the_lesson_must_belong_to_the_skill(client, owner, registry, clock):
    res = await open_room(client, owner, lesson="no-such-lesson")
    assert res.status_code == 400 and res.json()["error"]["code"] == "lesson_not_found"


async def test_the_owner_switch_closes_lesson_rooms_but_not_rebus(client, owner, registry, db, clock):
    await db.system_settings.update_one({"settingId": "group.skills"}, {"$set": {"value": False}}, upsert=True)
    res = await open_room(client, owner)
    assert res.status_code == 403 and res.json()["error"]["code"] == "group_off"


async def test_only_a_signed_in_user_opens_one_and_nicknames_come_from_the_list(client, owner, registry, clock):
    body = {"skill": SKILL, "lesson": LESSON, "name": "Brave Tiger", "avatar": "tiger"}
    assert (await client.post("/group/rooms", json=body)).status_code == 401
    assert (await open_room(client, owner, name="Little Timmy")).json()["error"]["code"] == "bad_nickname"


async def test_everyone_gets_the_same_seed_and_the_race_ends_when_all_have_finished(client, owner, registry, clock):
    code, tokens = await ready_race(client, owner, clock)
    host_view = (await client.get(f"/group/rooms/{code}", headers=seat(tokens["host"]))).json()
    guest_view = (await client.get(f"/group/rooms/{code}", headers=seat(tokens["Clever Fox"]))).json()
    assert host_view["status"] == "playing" and host_view["seed"] == guest_view["seed"] and host_view["total"] == COUNT

    clock["ms"] += 20_000
    mid = await report(client, code, tokens["Clever Fox"], 5, 4, done=True)
    assert mid["status"] == "playing"  # the host is still going
    clock["ms"] += 5_000
    end = await report(client, code, tokens["host"], 5, 5, done=True)
    assert end["status"] == "finished"
    places = {p["pid"]: s["place"] for p in end["players"] for s in end["standings"] if s["pid"] == p["pid"]}
    names = {p["pid"]: p["name"] for p in end["players"]}
    assert sorted((places[pid], names[pid]) for pid in places) == [(1, "Brave Tiger"), (2, "Clever Fox")]


async def test_an_equal_score_goes_to_whoever_finished_first(client, owner, registry, clock):
    code, tokens = await ready_race(client, owner, clock)
    clock["ms"] += 10_000
    await report(client, code, tokens["Clever Fox"], 5, 3, done=True)
    clock["ms"] += 10_000
    end = await report(client, code, tokens["host"], 5, 3, done=True)
    first = next(s for s in end["standings"] if s["place"] == 1)
    assert next(p["name"] for p in end["players"] if p["pid"] == first["pid"]) == "Clever Fox"
    assert sorted(s["place"] for s in end["standings"]) == [1, 2]


async def test_counts_only_go_up_and_never_past_the_round(client, owner, registry, clock):
    code, tokens = await ready_race(client, owner, clock)
    await report(client, code, tokens["host"], 3, 3)
    after = await report(client, code, tokens["host"], 2, 1)  # a late, stale report
    me = next(p for p in after["players"] if p["name"] == "Brave Tiger")
    assert me["solved"] == 3 and me["score"] == 3
    capped = await report(client, code, tokens["host"], 50, 50)
    me = next(p for p in capped["players"] if p["name"] == "Brave Tiger")
    assert me["solved"] == COUNT and me["score"] == COUNT and me["done"] is True


async def test_nothing_counts_during_the_countdown(client, owner, registry, clock):
    made = (await open_room(client, owner)).json()
    code, host = made["room"]["code"], seat(made["playerToken"])
    asked = (await client.post(f"/group/rooms/{code}/join", json={"name": "Clever Fox", "avatar": "fox"})).json()
    await client.post(f"/group/rooms/{code}/accept", json={"pid": asked["room"]["me"]["pid"]}, headers=host)
    await client.post(f"/group/rooms/{code}/start", headers=host)
    early = await report(client, code, made["playerToken"], 2, 2)
    assert next(p for p in early["players"] if p["name"] == "Brave Tiger")["score"] == 0


async def test_time_up_calls_the_race_however_far_anyone_got(client, owner, registry, clock):
    code, tokens = await ready_race(client, owner, clock)
    await report(client, code, tokens["host"], 2, 2)
    clock["ms"] += rules.SKILL_LIMIT_MS
    view = (await client.get(f"/group/rooms/{code}", headers=seat(tokens["Clever Fox"]))).json()
    assert view["status"] == "finished"
    assert next(s for s in view["standings"] if s["place"] == 1)["score"] == 2


async def test_a_rebus_answer_is_refused_in_a_lesson_room(client, owner, registry, clock):
    code, tokens = await ready_race(client, owner, clock)
    res = await client.post(f"/rebus/rooms/{code}/solve", json={"index": 0, "hints": 0}, headers=seat(tokens["host"]))
    assert res.status_code == 409


async def test_a_rematch_clears_the_finish_and_deals_a_new_seed(client, owner, registry, clock):
    code, tokens = await ready_race(client, owner, clock)
    before = (await client.get(f"/group/rooms/{code}", headers=seat(tokens["host"]))).json()["seed"]
    await report(client, code, tokens["Clever Fox"], 5, 5, done=True)
    await report(client, code, tokens["host"], 5, 5, done=True)
    again = await client.post(f"/group/rooms/{code}/rematch", headers=seat(tokens["host"]))
    assert again.status_code == 200 and again.json()["status"] == "lobby"
    assert all(not p["done"] and p["score"] == 0 for p in again.json()["players"])
    await client.post(f"/group/rooms/{code}/start", headers=seat(tokens["host"]))
    clock["ms"] += rules.COUNTDOWN_MS
    assert (await client.get(f"/group/rooms/{code}", headers=seat(tokens["host"]))).json()["seed"] != before


async def test_reporting_counts_skill_rooms_without_keeping_anything_about_a_child(client, owner, registry, db, clock):
    await ready_race(client, owner, clock)
    stats = await db.rebus_group_stats.find_one({})
    assert stats["skillRoomsOpened"] == 1 and stats["skillGamesStarted"] == 1
    assert set(stats) <= {"_id", *rooms_repo.COUNTERS}
