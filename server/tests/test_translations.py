"""Wording corrections: anyone may read them, only content editors may write.

The read is public on purpose — the sign-in screen is corrected too, and it is
shown before there is a session.
"""

import pytest


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def developer(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(db, "dev@example.com", passwords.hash_password("correct horse battery"),
                       platform_role="developer")
    pair = (await client.post("/auth/login", json={"email": "dev@example.com", "password": "correct horse battery"})).json()
    return {"Authorization": f"Bearer {pair['accessToken']}"}


async def test_correction_round_trip_without_a_session(client, developer):
    saved = await client.put("/translations/km/signIn.headline", json={"text": "ចំណងជើងថ្មី"}, headers=developer)
    assert saved.status_code == 200

    public = await client.get("/translations")
    assert public.status_code == 200
    assert public.json()["overrides"] == {"km": {"signIn.headline": "ចំណងជើងថ្មី"}}

    assert (await client.delete("/translations/km/signIn.headline", headers=developer)).status_code == 204
    assert (await client.get("/translations")).json()["overrides"] == {}
    assert (await client.delete("/translations/km/signIn.headline", headers=developer)).status_code == 404


async def test_saving_again_replaces_the_correction(client, developer):
    for text in ("one", "two"):
        await client.put("/translations/km/a.b", json={"text": text}, headers=developer)
    assert (await client.get("/translations")).json()["overrides"]["km"] == {"a.b": "two"}


async def test_plural_sets_are_kept_whole(client, developer):
    body = {"text": {"other": "{count} ថ្ងៃ"}}
    assert (await client.put("/translations/km/time.days", json=body, headers=developer)).status_code == 200
    assert (await client.get("/translations")).json()["overrides"]["km"]["time.days"] == {"other": "{count} ថ្ងៃ"}


async def test_a_family_owner_cannot_write(client, owner):
    response = await client.put("/translations/km/signIn.headline", json={"text": "x"}, headers=owner)
    assert response.status_code == 403
    assert (await client.put("/translations/km/signIn.headline", json={"text": "x"})).status_code in (401, 403)


@pytest.mark.parametrize("path,body", [
    ("/translations/km/signIn.headline", {"text": "   "}),
    ("/translations/km/signIn.headline", {"text": {"one": "no other form"}}),
    ("/translations/not a lang/signIn.headline", {"text": "x"}),
    ("/translations/km/bad key!", {"text": "x"}),
])
async def test_bad_input_is_refused(client, developer, path, body):
    response = await client.put(path, json=body, headers=developer)
    assert response.status_code in (400, 422)
