"""A second adult, and letting one go.

The invite is a code rather than an emailed link — it reuses the shape already
trusted for pairing a child's tablet, needs no mail transport, and fits the case
it is for: two parents in the same kitchen, one reading eight characters out.
"""

import pytest


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def _joiner(client, signup_body, email="second@example.com"):
    return (await client.post("/auth/signup", json=signup_body(email))).json()


async def _code(client, owner, role="parent") -> str:
    r = await client.post("/family/invites", headers=owner, json={"role": role})
    assert r.status_code == 201, r.text
    return r.json()["code"]


async def test_a_second_parent_joins_and_sees_the_children(client, owner, signup_body):
    await client.post("/learners", headers=owner, json={"displayName": "Mia"})
    code = await _code(client, owner)
    joiner = await _joiner(client, signup_body)
    auth = {"Authorization": f"Bearer {joiner['accessToken']}"}

    redeemed = await client.post("/family/invites/redeem", headers=auth, json={"code": code})
    assert redeemed.status_code == 200, redeemed.text
    assert redeemed.json()["role"] == "parent"

    # Signing in again puts them in the family they joined, not the one signup
    # minted for them.
    fresh = (
        await client.post(
            "/auth/login", json={"email": "second@example.com", "password": "correct horse battery"}
        )
    ).json()
    assert fresh["role"] == "parent"

    seen = await client.get(
        "/learners", headers={"Authorization": f"Bearer {fresh['accessToken']}"}
    )
    assert [row["displayName"] for row in seen.json()["learners"]] == ["Mia"]


async def test_the_code_is_never_readable_again(client, owner):
    """It is stored hashed, like a join code. A list that could re-read it would
    be a list of live keys."""
    await _code(client, owner)

    listed = (await client.get("/family/invites", headers=owner)).json()["invites"]
    assert len(listed) == 1
    assert listed[0]["code"] is None


async def test_an_invite_works_once(client, owner, signup_body):
    code = await _code(client, owner)
    first = await _joiner(client, signup_body, "a@example.com")
    await client.post(
        "/family/invites/redeem",
        headers={"Authorization": f"Bearer {first['accessToken']}"},
        json={"code": code},
    )

    second = await _joiner(client, signup_body, "b@example.com")
    again = await client.post(
        "/family/invites/redeem",
        headers={"Authorization": f"Bearer {second['accessToken']}"},
        json={"code": code},
    )
    assert again.status_code == 401


async def test_the_role_is_fixed_when_the_invite_is_made(client, owner, signup_body):
    """Accepting is not a negotiation about what you were invited as."""
    code = await _code(client, owner, role="caregiver")
    joiner = await _joiner(client, signup_body)

    redeemed = await client.post(
        "/family/invites/redeem",
        headers={"Authorization": f"Bearer {joiner['accessToken']}"},
        json={"code": code},
    )
    assert redeemed.json()["role"] == "caregiver"


async def test_an_invite_cannot_make_an_owner_or_a_child(client, owner):
    for role in ("owner", "child", "nonsense"):
        r = await client.post("/family/invites", headers=owner, json={"role": role})
        assert r.status_code == 409, role
        assert r.json()["error"]["code"] == "role_not_invitable"


async def test_somebody_with_their_own_children_is_not_absorbed(client, owner, signup_body):
    """Moving them would strand a family that has real records in it."""
    code = await _code(client, owner)
    joiner = await _joiner(client, signup_body)
    auth = {"Authorization": f"Bearer {joiner['accessToken']}"}
    await client.post("/learners", headers=auth, json={"displayName": "Theirs"})

    r = await client.post("/family/invites/redeem", headers=auth, json={"code": code})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "family_not_empty"


async def test_a_revoked_invite_cannot_be_redeemed(client, owner, signup_body):
    code = await _code(client, owner)
    invite_id = (await client.get("/family/invites", headers=owner)).json()["invites"][0]["id"]
    assert (await client.delete(f"/family/invites/{invite_id}", headers=owner)).status_code == 204

    joiner = await _joiner(client, signup_body)
    r = await client.post(
        "/family/invites/redeem",
        headers={"Authorization": f"Bearer {joiner['accessToken']}"},
        json={"code": code},
    )
    assert r.status_code == 401


async def test_a_child_device_cannot_accept_an_invite(client, owner):
    learner = (
        await client.post("/learners", headers=owner, json={"displayName": "Mia"})
    ).json()
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=owner)).json()
    code = await _code(client, owner)

    r = await client.post(
        "/family/invites/redeem",
        headers={"Authorization": f"Bearer {child['accessToken']}"},
        json={"code": code},
    )
    assert r.status_code == 403


async def test_removing_somebody_ends_what_they_were_holding(client, owner, signup_body):
    code = await _code(client, owner)
    joiner = await _joiner(client, signup_body)
    await client.post(
        "/family/invites/redeem",
        headers={"Authorization": f"Bearer {joiner['accessToken']}"},
        json={"code": code},
    )
    live = (
        await client.post(
            "/auth/login", json={"email": "second@example.com", "password": "correct horse battery"}
        )
    ).json()

    members = (await client.get("/family/members", headers=owner)).json()["members"]
    them = next(m for m in members if m["role"] == "parent")

    assert (await client.delete(f"/family/members/{them['userId']}", headers=owner)).status_code == 204
    assert (
        await client.post("/auth/refresh", json={"refreshToken": live["refreshToken"]})
    ).status_code == 401


async def test_the_owner_cannot_be_removed_and_neither_can_you_remove_yourself(client, owner):
    members = (await client.get("/family/members", headers=owner)).json()["members"]
    me = next(m for m in members if m["isYou"])

    r = await client.delete(f"/family/members/{me['userId']}", headers=owner)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "cannot_remove_self"


async def test_a_family_can_be_renamed(client, owner):
    r = await client.patch("/family", headers=owner, json={"name": "The Renamed"})

    assert r.status_code == 200, r.text
    assert r.json()["familyName"] == "The Renamed"
    assert (await client.get("/family/members", headers=owner)).json()["familyName"] == "The Renamed"
