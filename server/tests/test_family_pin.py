"""The four digits between a child's session and their parent's.

What is under test is the boundary, not the cryptography: a child may ask
whether a PIN exists and may answer it, and may not set, change or remove one.
"""

import pytest


@pytest.fixture
async def parent(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def _child(client, parent):
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    switched = (await client.post(f"/auth/switch/{learner['id']}", headers=parent)).json()
    return {"Authorization": f"Bearer {switched['accessToken']}"}


async def test_a_family_starts_with_no_pin(client, parent):
    assert (await client.get("/family/pin", headers=parent)).json()["isSet"] is False


async def test_a_parent_sets_one_and_it_reads_as_on(client, parent):
    assert (await client.put("/family/pin", headers=parent, json={"pin": "4821"})).status_code == 204
    assert (await client.get("/family/pin", headers=parent)).json()["isSet"] is True


async def test_the_right_pin_passes_and_a_wrong_one_does_not(client, parent):
    await client.put("/family/pin", headers=parent, json={"pin": "4821"})
    child = await _child(client, parent)

    assert (
        await client.post("/family/pin/verify", headers=child, json={"pin": "4821"})
    ).status_code == 204
    assert (
        await client.post("/family/pin/verify", headers=child, json={"pin": "0000"})
    ).status_code == 401


async def test_a_child_may_ask_whether_one_exists(client, parent):
    """Their device has to know whether to prompt. Knowing gives nothing away."""
    await client.put("/family/pin", headers=parent, json={"pin": "4821"})
    child = await _child(client, parent)

    assert (await client.get("/family/pin", headers=child)).json()["isSet"] is True


async def test_a_child_cannot_set_change_or_remove_it(client, parent):
    """The whole point. A PIN a child can rewrite is not a PIN."""
    await client.put("/family/pin", headers=parent, json={"pin": "4821"})
    child = await _child(client, parent)

    assert (await client.put("/family/pin", headers=child, json={"pin": "1111"})).status_code == 403
    assert (await client.delete("/family/pin", headers=child)).status_code == 403
    # …and the original still stands.
    assert (
        await client.post("/family/pin/verify", headers=child, json={"pin": "4821"})
    ).status_code == 204


async def test_verifying_when_none_is_set_is_refused_rather_than_waved_through(client, parent):
    r = await client.post("/family/pin/verify", headers=parent, json={"pin": "4821"})

    assert r.status_code == 409, "no PIN set is not the same as a correct PIN"
    assert r.json()["error"]["code"] == "pin_not_set"


async def test_a_pin_must_be_four_digits(client, parent):
    for bad in ("123", "12345", "abcd", "12a4"):
        r = await client.put("/family/pin", headers=parent, json={"pin": bad})
        assert r.status_code == 422, f"{bad!r} was accepted"


async def test_guessing_is_budgeted(client, parent):
    await client.put("/family/pin", headers=parent, json={"pin": "4821"})
    child = await _child(client, parent)

    codes = [
        (await client.post("/family/pin/verify", headers=child, json={"pin": "0000"})).status_code
        for _ in range(8)
    ]
    assert 429 in codes, "a four-digit secret with no ceiling is a afternoon's work"


async def test_removing_it_returns_the_switcher_to_how_it_was(client, parent):
    await client.put("/family/pin", headers=parent, json={"pin": "4821"})
    assert (await client.delete("/family/pin", headers=parent)).status_code == 204

    assert (await client.get("/family/pin", headers=parent)).json()["isSet"] is False
