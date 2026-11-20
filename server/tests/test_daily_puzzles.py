"""Daily puzzles: the starter words, the Studio's rules, and the calendar every device follows."""

import base64
import json
from pathlib import Path

import pytest

from app.repos import daily_puzzles as repo

SEED = json.loads((Path(__file__).parent.parent / "app" / "daily_puzzle_seed.json").read_text())
KM3 = "word-guess:km:3"
S = "/daily-puzzles/studio"


@pytest.fixture(autouse=True)
async def seeded(db):
    await repo.ensure_seed(db, SEED)


async def _login(client, db, email, role):
    from app.repos import users
    from app.security import passwords

    await users.create(db, email, passwords.hash_password("correct horse battery"), platform_role=role)
    tokens = (await client.post("/auth/login", json={"email": email, "password": "correct horse battery"})).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def owner(client, db):
    return await _login(client, db, "owner@example.com", "core")


@pytest.fixture
async def teacher(client, db):
    return await _login(client, db, "teacher@example.com", "creator")


@pytest.fixture
async def family(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_the_starter_words_are_live_on_day_one_and_never_seeded_twice(client, family, db):
    body = (await client.get("/daily-puzzles?days=3", headers=family)).json()
    assert KM3 in body["lines"] and "word-guess:en:5" in body["lines"]
    assert [d["day"] for d in body["lines"][KM3]][0] == body["today"]
    assert len(body["puzzles"]) == len(SEED)
    sample = next(p for p in body["puzzles"] if p["lang"] == "km")
    assert set(sample) == {"id", "kind", "lang", "level", "data"} and sample["data"]["tiles"]
    assert await repo.ensure_seed(db, SEED) == 0


async def test_a_reseed_fills_blank_khmer_clues_and_pictures_but_never_undoes_an_edit(db):
    cat = next(r for r in SEED if r["id"] == "wg-km-002")
    assert cat["data"]["clue"]["km"] and cat["data"]["picture"] == "rebus-cat"
    await db.daily_puzzles.update_one({"id": "wg-km-002"}, {"$set": {"data.clue.km": ""}, "$unset": {"data.picture": ""}})
    await db.daily_puzzles.update_one({"id": "wg-km-003"}, {"$set": {"data.clue.km": "edited", "data.picture": ""}})
    await repo.ensure_seed(db, SEED)
    filled = await repo.get(db, "wg-km-002")
    assert filled["data"]["clue"]["km"] == cat["data"]["clue"]["km"] and filled["data"]["picture"] == "rebus-cat"
    kept = await repo.get(db, "wg-km-003")
    assert kept["data"]["clue"]["km"] == "edited" and kept["data"]["picture"] == ""


async def test_every_device_gets_the_same_word_and_no_repeats_until_the_line_runs_out(client, family, owner):
    first = (await client.get("/daily-puzzles?days=30", headers=family)).json()["lines"][KM3]
    again = (await client.get("/daily-puzzles?days=30", headers=owner)).json()["lines"][KM3]
    assert first == again
    n = sum(1 for s in SEED if s["lang"] == "km" and s["level"] == 3)
    ids = [d["puzzleId"] for d in first]
    # Every line has more than a month of words: 30 days, 30 different words.
    assert n > 30 and len(ids) == 30 and len(set(ids)) == 30


async def test_a_teacher_drafts_and_asks_for_review_but_only_the_owner_publishes(client, teacher, owner, family):
    rabbit = {"lang": "km", "word": "ទន្សោង", "category": "animal", "clue": {"en": "a bird"}}
    made = await client.post(f"{S}/puzzles", json=rabbit, headers=teacher)
    assert made.status_code == 201
    word = made.json()
    assert word["status"] == "draft" and word["level"] == 5 and word["owner"] == "creator"
    assert word["data"]["tiles"] == ["ទ", "ន", "្ស", "ោ", "ង"]
    pid = word["id"]
    assert (await client.post(f"{S}/puzzles/{pid}/status", json={"status": "review"}, headers=teacher)).status_code == 200
    assert (await client.post(f"{S}/puzzles/{pid}/status", json={"status": "published"}, headers=teacher)).status_code == 403
    # A teacher sees only their own; the owner sees it waiting.
    assert (await client.get(f"{S}/puzzles", headers=teacher)).json()["total"] == 1
    waiting = (await client.get(f"{S}/puzzles?status=review", headers=owner)).json()["puzzles"]
    assert [w["id"] for w in waiting] == [pid] and waiting[0]["createdByName"]
    assert (await client.post(f"{S}/puzzles/{pid}/status", json={"status": "published"}, headers=owner)).status_code == 200
    assert "word-guess:km:5" in (await client.get("/daily-puzzles?days=1", headers=family)).json()["lines"]
    # A family cannot reach the Studio at all.
    assert (await client.get(f"{S}/overview", headers=family)).status_code == 403


async def test_a_bad_word_is_kept_as_a_draft_but_cannot_go_live(client, owner):
    made = (await client.post(f"{S}/puzzles", json={"lang": "en", "word": "ice cream", "category": "food"}, headers=owner)).json()
    assert made["status"] == "draft" and made["issues"] == ["not_letters"]
    refused = await client.post(f"{S}/puzzles/{made['id']}/status", json={"status": "published"}, headers=owner)
    assert refused.status_code == 422 and "a to z" in refused.text
    dup = await client.post(f"{S}/puzzles", json={"lang": "en", "word": "Cat", "category": "animal"}, headers=owner)
    assert dup.status_code == 422


async def test_the_owner_chooses_a_day_and_a_retired_word_leaves_the_future(client, owner, family):
    cal = (await client.get(f"{S}/calendar?slot={KM3}&days=5", headers=owner)).json()
    today, tomorrow = cal["days"][0]["day"], cal["days"][1]["day"]
    later = cal["days"][4]["puzzleId"]
    assert (await client.put(f"{S}/calendar/{KM3}/{today}", json={"puzzleId": later}, headers=owner)).status_code == 409
    assert (await client.put(f"{S}/calendar/{KM3}/{tomorrow}", json={"puzzleId": later}, headers=owner)).status_code == 200
    days = (await client.get("/daily-puzzles?days=5", headers=family)).json()["lines"][KM3]
    assert days[1]["puzzleId"] == later and [d["puzzleId"] for d in days].count(later) == 1
    # Retire tomorrow's word: today stays (children are playing it), the future is picked again without it.
    today_word = days[0]["puzzleId"]
    assert (await client.post(f"{S}/puzzles/{today_word}/status", json={"status": "retired"}, headers=owner)).status_code == 200
    after = (await client.get("/daily-puzzles?days=5", headers=family)).json()["lines"][KM3]
    assert after[0]["puzzleId"] == today_word and today_word not in [d["puzzleId"] for d in after[1:]]


async def test_a_live_word_keeps_its_length_and_the_line_counts_its_new_days(client, owner):
    overview = (await client.get(f"{S}/overview", headers=owner)).json()
    line = next(x for x in overview["lines"] if x["slot"] == KM3)
    assert overview["canRun"] and line["byStatus"]["published"] >= 15 and line["newDaysLeft"] == line["byStatus"]["published"]
    live = (await client.get(f"{S}/puzzles?lang=km&level=3&status=published", headers=owner)).json()["puzzles"][0]
    assert (await client.patch(f"{S}/puzzles/{live['id']}", json={"word": "ក្ដោង"}, headers=owner)).status_code == 409
    fixed = await client.patch(f"{S}/puzzles/{live['id']}", json={"clue": {"km": "សត្វ", "en": "a new clue"}}, headers=owner)
    assert fixed.status_code == 200 and fixed.json()["data"]["clue"]["en"] == "a new clue"
    await client.get("/daily-puzzles?days=1", headers=owner)
    line = next(x for x in (await client.get(f"{S}/overview", headers=owner)).json()["lines"] if x["slot"] == KM3)
    assert line["newDaysLeft"] == line["byStatus"]["published"] - 1


async def test_a_word_can_have_a_drawing_an_art_picture_or_an_uploaded_photo_that_children_can_load(client, owner, family):
    png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64).decode()
    up = await client.post("/daily-puzzles/studio/images", json={"mime": "image/png", "data": png}, headers=owner)
    assert up.status_code == 200, up.text
    photo = "photo-" + up.json()["id"]
    for picture in (photo, "rebus-horse", "kit-sun"):
        body = {"lang": "en", "word": "zzq" + picture[-1], "category": "animal", "picture": picture}
        made = await client.post("/daily-puzzles/studio/puzzles", json=body, headers=owner)
        assert made.status_code == 201, made.text
        assert made.json()["data"]["picture"] == picture
    bad_body = {"lang": "en", "word": "zzx", "category": "animal", "picture": "../etc"}
    bad = await client.post("/daily-puzzles/studio/puzzles", json=bad_body, headers=owner)
    assert bad.status_code == 422
    seen = await client.get(f"/library/images/{up.json()['id']}", headers=family)
    assert seen.status_code == 200 and seen.headers["content-type"] == "image/png"
    assert (await client.post("/daily-puzzles/studio/images", json={"mime": "image/png", "data": png}, headers=family)).status_code == 403
