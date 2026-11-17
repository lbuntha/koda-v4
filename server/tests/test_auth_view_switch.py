"""A parent the platform made an admin: family at sign-in, admin on request."""


async def _parent_admin(client, db, signup_body):
    body = signup_body()
    tokens = (await client.post("/auth/signup", json=body)).json()
    await db.users.update_one({"email": body["email"]}, {"$set": {"platformRole": "admin"}})
    login = (await client.post("/auth/login", json={"email": body["email"], "password": body["password"]})).json()
    del tokens
    return body, login


def _auth(pair):
    return {"Authorization": f"Bearer {pair['accessToken']}"}


async def test_sign_in_opens_the_family_and_offers_both_views(client, db, signup_body):
    _, login = await _parent_admin(client, db, signup_body)
    assert login["familyId"]
    assert "user:manage" not in login["permissions"]
    me = (await client.get("/auth/me", headers=_auth(login))).json()
    assert me["views"] == ["family", "admin"]


async def test_switching_to_admin_and_back_survives_a_refresh(client, db, signup_body):
    _, login = await _parent_admin(client, db, signup_body)

    admin = await client.post("/auth/view", headers=_auth(login), json={"view": "admin"})
    assert admin.status_code == 200, admin.text
    admin = admin.json()
    assert admin["familyId"] is None
    assert admin["deviceId"] == login["deviceId"]
    assert "user:manage" in admin["permissions"]
    assert (await client.get("/admin/users", headers=_auth(admin))).status_code == 200

    refreshed = (await client.post("/auth/refresh", json={"refreshToken": admin["refreshToken"]})).json()
    assert refreshed["familyId"] is None
    assert "user:manage" in refreshed["permissions"]

    back = (await client.post("/auth/view", headers=_auth(refreshed), json={"view": "family"})).json()
    assert back["familyId"] == login["familyId"]
    assert "user:manage" not in back["permissions"]
    again = (await client.post("/auth/refresh", json={"refreshToken": back["refreshToken"]})).json()
    assert again["familyId"] == login["familyId"]


async def test_a_plain_parent_cannot_open_the_admin_view(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    refused = await client.post("/auth/view", headers=_auth(tokens), json={"view": "admin"})
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "view_unavailable"
    me = (await client.get("/auth/me", headers=_auth(tokens))).json()
    assert me["views"] == ["family"]


async def test_signing_in_again_after_admin_view_opens_the_family(client, db, signup_body):
    body, login = await _parent_admin(client, db, signup_body)
    await client.post("/auth/view", headers=_auth(login), json={"view": "admin"})
    login2 = (await client.post("/auth/login", json={
        "email": body["email"], "password": body["password"], "installId": "tab-1",
    })).json()
    assert login2["familyId"] == login["familyId"]
