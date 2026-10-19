"""Rebus Rush categories are data an owner manages, not words in the code."""

import json
from pathlib import Path

import pytest

from app.repos import rebus as repo

SEED = json.loads((Path(__file__).parent.parent / "app" / "rebus_seed.json").read_text())


@pytest.fixture(autouse=True)
async def seeded(db):
    await repo.ensure_seed(db, SEED)


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


def puzzle(category: str, **over):
    body = {
        "category": category,
        "ages": [6, 12],
        "difficulty": 1,
        "trick": "compound",
        "pieces": [
            {"kind": "icon", "id": "rebus-cheese", "name": "cheese"},
            {"kind": "op", "op": "+"},
            {"kind": "icon", "id": "rebus-pie", "name": "pie"},
        ],
        "answer": "Cheese pie",
        "accepts": [],
        "explanation": "cheese + pie = cheese pie.",
    }
    return {**body, **over}


async def test_the_eight_built_in_categories_are_there_and_a_device_is_told_about_them(client, admin, owner):
    listed = (await client.get("/rebus/studio/categories", headers=admin)).json()["categories"]
    assert [c["id"] for c in listed] == ["countries", "food", "sayings", "animals", "sports", "school", "science", "khmer", "math"]
    assert all(c["builtIn"] for c in listed) and listed[0]["names"] == {"en": "Countries", "km": "ប្រទេស"}
    played = (await client.get("/rebus/puzzles", headers=owner)).json()
    assert [c["id"] for c in played["categories"]][:2] == ["countries", "food"]


async def test_only_a_studio_author_manages_categories(client, owner):
    assert (await client.get("/rebus/studio/categories", headers=owner)).status_code == 403
    body = {"id": "riddles", "names": {"en": "Riddles"}, "tone": "cyan", "topic": "logic"}
    assert (await client.post("/rebus/studio/categories", json=body, headers=owner)).status_code == 403


async def test_an_owner_adds_a_category_and_a_puzzle_can_use_it(client, admin, owner):
    before = (await client.get("/rebus/puzzles", headers=owner)).json()["version"]
    body = {"id": "riddles", "names": {"en": "Riddles", "km": "ល្បែងបញ្ហា"}, "tone": "cyan", "topic": "logic"}
    made = await client.post("/rebus/studio/categories", json=body, headers=admin)
    assert made.status_code == 201 and made.json()["order"] == 9 and made.json()["enabled"] is True
    # Devices ask "anything new since?" and are told yes.
    assert (await client.get(f"/rebus/puzzles?since={before}", headers=owner)).json()["unchanged"] is False

    ok = await client.post("/rebus/studio/puzzles", json=puzzle("riddles", answer="Cheese pie riddles"), headers=admin)
    assert ok.status_code in (200, 201) and ok.json()["issues"] == []
    nope = await client.post("/rebus/studio/puzzles", json=puzzle("nonsense", answer="Cheese pie nope"), headers=admin)
    assert nope.json()["issues"] == ["bad-category"]


async def test_a_bad_category_is_refused_clearly(client, admin):
    for body, why in (
        ({"id": "Riddles!", "names": {"en": "Riddles"}}, "id"),
        ({"id": "riddles", "names": {"km": "គណិត"}}, "English"),
        ({"id": "riddles", "names": {"en": "Riddles"}, "tone": "yellow"}, "colour"),
        ({"id": "riddles", "names": {"en": "Riddles"}, "topic": "everything"}, "topic"),
    ):
        res = await client.post("/rebus/studio/categories", json=body, headers=admin)
        assert res.status_code == 422, (why, res.text)
    one = {"id": "riddles", "names": {"en": "Riddles"}}
    assert (await client.post("/rebus/studio/categories", json=one, headers=admin)).status_code == 201
    assert (await client.post("/rebus/studio/categories", json=one, headers=admin)).status_code == 409


async def test_a_category_can_be_renamed_switched_off_and_reordered(client, admin, owner):
    await client.post("/rebus/studio/categories", json={"id": "riddles", "names": {"en": "Riddles"}}, headers=admin)
    renamed = await client.patch("/rebus/studio/categories/riddles", json={"names": {"en": "Riddles two", "km": "គណិត"}}, headers=admin)
    assert renamed.json()["names"]["en"] == "Riddles two"
    await client.patch("/rebus/studio/categories/food", json={"enabled": False}, headers=admin)
    shown = [c["id"] for c in (await client.get("/rebus/puzzles", headers=owner)).json()["categories"]]
    assert "food" not in shown and "riddles" in shown
    # Off means nobody can file a new puzzle there either.
    off = await client.post("/rebus/studio/puzzles", json=puzzle("food", answer="Cheese pie off"), headers=admin)
    assert off.json()["issues"] == ["bad-category"]
    await client.post("/rebus/studio/categories/reorder", json={"order": ["riddles", "khmer"]}, headers=admin)
    listed = [c["id"] for c in (await client.get("/rebus/studio/categories", headers=admin)).json()["categories"]]
    assert listed[:3] == ["riddles", "khmer", "countries"]
    assert (await client.patch("/rebus/studio/categories/ghost", json={"enabled": False}, headers=admin)).status_code == 404


async def test_a_category_in_use_or_built_in_cannot_be_deleted(client, admin):
    await client.post("/rebus/studio/categories", json={"id": "riddles", "names": {"en": "Riddles"}}, headers=admin)
    await client.post("/rebus/studio/puzzles", json=puzzle("riddles", answer="Cheese pie del"), headers=admin)
    assert (await client.delete("/rebus/studio/categories/riddles", headers=admin)).status_code == 409
    assert (await client.delete("/rebus/studio/categories/food", headers=admin)).status_code == 409
    await client.post("/rebus/studio/categories", json={"id": "empty", "names": {"en": "Empty"}}, headers=admin)
    assert (await client.delete("/rebus/studio/categories/empty", headers=admin)).status_code == 200
