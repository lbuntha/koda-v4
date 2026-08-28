"""What a device row means, and who may end one.

The rule the whole page rests on: a row is an *install*, not a sign-in. Before
that was true, one laptop signed into a dozen times filled the list with a dozen
identical entries and a lost tablet could not be found among them.
"""

import pytest


@pytest.fixture
async def parent(client, signup_body):
    body = signup_body()
    body["installId"] = "i_laptop"
    tokens = (await client.post("/auth/signup", json=body)).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def _live(client, auth) -> list[dict]:
    rows = (await client.get("/devices", headers=auth)).json()["devices"]
    return [r for r in rows if not r["revokedAt"]]


async def _login(client, install_id: str | None = None):
    body = {"email": "parent@example.com", "password": "correct horse battery"}
    if install_id:
        body["installId"] = install_id
    return (await client.post("/auth/login", json=body)).json()


async def test_signing_in_again_reuses_the_row_it_already_had(client, parent):
    for _ in range(4):
        await _login(client, "i_laptop")

    assert len(await _live(client, parent)) == 1, "one machine is one device"


async def test_a_second_machine_is_a_second_row(client, parent):
    await _login(client, "i_phone")

    assert len(await _live(client, parent)) == 2


async def test_a_client_that_sends_no_install_id_still_works(client, parent):
    """Older clients must not be broken by this, only unhelped by it."""
    await _login(client)
    await _login(client)

    # Two rows, because nothing identified them — the old behaviour, contained.
    assert len(await _live(client, parent)) == 3


async def test_reusing_a_row_kills_the_token_it_replaces(client, parent):
    """Rotation, not a second key to the same door."""
    first = await _login(client, "i_laptop")
    await _login(client, "i_laptop")

    stale = await client.post("/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert stale.status_code == 401


async def test_two_people_on_one_tablet_are_two_rows(client, parent, signup_body):
    """A shared install is not a shared session.

    Folding them together would let signing a parent out take the child with it.
    """
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    await client.post(f"/auth/switch/{learner['id']}", headers=parent)

    rows = await _live(client, parent)
    kinds = sorted(r["kind"] for r in rows)
    assert kinds == ["child", "user"]


async def test_a_row_says_whose_device_it_is(client, parent):
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    await client.post(f"/auth/switch/{learner['id']}", headers=parent)

    child_row = next(r for r in await _live(client, parent) if r["kind"] == "child")
    assert child_row["learnerName"] == "Mia", "a list of 'This device' is not actionable"
    assert child_row["learnerId"] == learner["id"]


async def test_signing_a_device_out_ends_it_immediately(client, parent):
    other = await _login(client, "i_phone")
    row = next(r for r in await _live(client, parent) if not r["current"])

    assert (await client.delete(f"/devices/{row['id']}", headers=parent)).status_code == 204
    assert (
        await client.post("/auth/refresh", json={"refreshToken": other["refreshToken"]})
    ).status_code == 401


async def test_a_child_sees_only_their_own(client, parent):
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=parent)).json()
    as_child = {"Authorization": f"Bearer {child['accessToken']}"}

    rows = (await client.get("/devices", headers=as_child)).json()["devices"]
    assert len(rows) == 1
    assert rows[0]["current"] is True


async def test_a_child_cannot_sign_out_a_parents_device(client, parent):
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    parent_row = next(r for r in await _live(client, parent) if r["kind"] == "user")
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=parent)).json()

    r = await client.delete(
        f"/devices/{parent_row['id']}",
        headers={"Authorization": f"Bearer {child['accessToken']}"},
    )
    assert r.status_code == 404, "not theirs, and not even acknowledged as existing"
