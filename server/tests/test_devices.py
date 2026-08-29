"""What a device row means, and who may end one.

The rule the whole page rests on: a row is an *install*, not a sign-in. Before
that was true, one laptop signed into a dozen times filled the list with a dozen
identical entries and a lost tablet could not be found among them.
"""

from datetime import UTC, datetime, timedelta

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


# ---- The list a family actually reads ------------------------------------


async def test_the_list_comes_a_page_at_a_time(client, parent):
    """Twenty-six rows on one screen is a wall, not a list."""
    for n in range(14):
        await _login(client, f"i_{n}")

    first = (await client.get("/devices?pageSize=10", headers=parent)).json()
    assert len(first["devices"]) == 10
    assert first["total"] == 15, "the count is the family's, not the page's"
    assert first["pages"] == 2

    second = (await client.get("/devices?page=2&pageSize=10", headers=parent)).json()
    assert len(second["devices"]) == 5
    ids = {r["id"] for r in first["devices"]} | {r["id"] for r in second["devices"]}
    assert len(ids) == 15, "the two pages do not overlap"


async def test_the_most_recently_used_device_is_first(client, parent):
    await _login(client, "i_phone")
    await _login(client, "i_laptop")

    rows = (await client.get("/devices", headers=parent)).json()["devices"]
    assert rows[0]["lastSeenAt"] >= rows[-1]["lastSeenAt"]


async def test_a_session_that_has_aged_out_stops_working(client, parent, db):
    """`refresh_ttl_days` was a setting nothing read: sessions never ended."""
    other = await _login(client, "i_phone")
    row = next(r for r in await _live(client, parent) if not r["current"])
    await db.devices.update_one(
        {"_id": row["id"]}, {"$set": {"lastSeenAt": datetime.now(UTC) - timedelta(days=400)}}
    )

    spent = await client.post("/auth/refresh", json={"refreshToken": other["refreshToken"]})
    assert spent.status_code == 401
    assert spent.json()["error"]["code"] == "refresh_expired"


async def test_an_aged_out_row_leaves_the_list(client, parent, db):
    """Retired on read, so the count a parent is shown is a count of live ones."""
    await _login(client, "i_phone")
    row = next(r for r in await _live(client, parent) if not r["current"])
    await db.devices.update_one(
        {"_id": row["id"]}, {"$set": {"lastSeenAt": datetime.now(UTC) - timedelta(days=400)}}
    )

    listing = (await client.get("/devices", headers=parent)).json()
    assert listing["total"] == 1
    assert row["id"] not in {r["id"] for r in listing["devices"]}


async def test_signing_out_the_rest_spares_the_device_asking(client, parent):
    kept = (await client.get("/devices", headers=parent)).json()["devices"]
    mine = next(r["id"] for r in kept if r["current"])
    for n in range(3):
        await _login(client, f"i_{n}")

    result = await client.delete("/devices", headers=parent)
    assert result.status_code == 200
    assert result.json()["signedOut"] == 3

    rows = (await client.get("/devices", headers=parent)).json()["devices"]
    assert [r["id"] for r in rows] == [mine], "the one you are holding survives"


async def test_signing_out_the_rest_really_ends_them(client, parent):
    other = await _login(client, "i_phone")
    await client.delete("/devices", headers=parent)

    assert (
        await client.post("/auth/refresh", json={"refreshToken": other["refreshToken"]})
    ).status_code == 401


async def test_a_child_cannot_sign_out_the_rest(client, parent):
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=parent)).json()

    r = await client.delete(
        "/devices", headers={"Authorization": f"Bearer {child['accessToken']}"}
    )
    assert r.status_code == 403


async def test_switching_to_a_child_twice_reuses_the_row(client, parent):
    """The daily gesture on a family tablet, and the largest source of the
    duplicate rows this list used to drown in."""
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()
    body = {"installId": "i_laptop", "deviceName": "Mac"}
    for _ in range(3):
        await client.post(f"/auth/switch/{learner['id']}", headers=parent, json=body)

    child_rows = [r for r in await _live(client, parent) if r["kind"] == "child"]
    assert len(child_rows) == 1, "one tablet opening one child is one device"
    assert child_rows[0]["name"] == "Mac"
