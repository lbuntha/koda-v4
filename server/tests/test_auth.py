async def test_signup_creates_family_and_returns_tokens(client, signup_body):
    r = await client.post("/auth/signup", json=signup_body())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "owner"
    assert body["accessToken"] and body["refreshToken"] and body["deviceId"]


async def test_user_can_choose_an_avatar_that_is_stored_on_the_account(client, db, signup_body):
    from app.repos import users

    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    initial = await client.get("/auth/me", headers=auth)
    assert initial.status_code == 200
    assert initial.json()["avatarSeed"]

    changed = await client.patch(
        "/auth/me/avatar", headers=auth, json={"avatarSeed": "a_user_choice_123"}
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["avatarSeed"] == "a_user_choice_123"

    row = await users.by_email(db, "parent@example.com")
    assert row["avatarSeed"] == "a_user_choice_123"


async def test_student_signup_creates_restricted_personal_workspace(client):
    r = await client.post(
        "/auth/signup",
        json={
            "email": "student@example.com",
            "password": "student password",
            "familyName": "My learning space",
            "accountType": "student",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "student"
    assert "settings:write" in body["permissions"]
    assert "member:list" not in body["permissions"]

    me = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['accessToken']}"}
    )
    assert me.status_code == 200
    assert me.json()["role"] == "student"
    assert me.json()["familyName"] == "My learning space"


async def test_email_is_taken_once(client, signup_body):
    await client.post("/auth/signup", json=signup_body())
    r = await client.post("/auth/signup", json=signup_body())
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


async def test_login_wrong_password_says_nothing_useful(client, signup_body):
    await client.post("/auth/signup", json=signup_body())
    r = await client.post("/auth/login", json={"email": "parent@example.com", "password": "nope!!"})
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "That email and password do not match."


async def test_refresh_rotates_and_kills_the_old_token(client, signup_body):
    first = (await client.post("/auth/signup", json=signup_body())).json()

    second = await client.post("/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert second.status_code == 200
    assert second.json()["refreshToken"] != first["refreshToken"]

    replay = await client.post("/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert replay.status_code == 401


async def test_me_needs_a_token(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    assert (await client.get("/auth/me")).status_code == 401

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['accessToken']}"})
    assert r.status_code == 200
    assert r.json()["familyName"] == "The Riveras"
    assert r.json()["role"] == "owner"


async def test_logout_revokes_the_device(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    assert (await client.post("/auth/logout", headers=auth)).status_code == 204
    replay = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert replay.status_code == 401


async def test_two_devices_can_both_be_revoked(client, signup_body):
    """A null refreshHash used to collide on the unique index — see indexes.py."""
    first = (await client.post("/auth/signup", json=signup_body())).json()
    second = (
        await client.post("/auth/login", json={"email": "parent@example.com",
                                               "password": "correct horse battery"})
    ).json()

    for tokens in (first, second):
        r = await client.post("/auth/logout",
                              headers={"Authorization": f"Bearer {tokens['accessToken']}"})
        assert r.status_code == 204

    for tokens in (first, second):
        replay = await client.post("/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
        assert replay.status_code == 401


async def test_staff_sign_in_without_a_family(client, db):
    """An admin has no membership — the platform role is what lets them in."""
    from app.repos import users
    from app.security import passwords

    await users.create(db, "admin@example.com", passwords.hash_password("123456"),
                       platform_role="admin")

    r = await client.post("/auth/login", json={"email": "admin@example.com", "password": "123456"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "admin"
    assert body["platformRole"] == "admin"
    assert body["familyId"] is None

    me = await client.get("/auth/me",
                          headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["familyId"] is None
    assert me.json()["platformRole"] == "admin"


async def test_family_membership_wins_over_platform_role_at_sign_in(client, db, signup_body):
    from app.repos import users

    await client.post("/auth/signup", json=signup_body("family-admin@example.com"))
    row = await users.by_email(db, "family-admin@example.com")
    await users.update_account(db, row["_id"], {"platformRole": "admin"})

    signed_in = (
        await client.post(
            "/auth/login",
            json={"email": "family-admin@example.com", "password": "correct horse battery"},
        )
    ).json()
    assert signed_in["role"] == "owner"
    assert "menu:manage" not in signed_in["permissions"]
    assert "user:manage" not in signed_in["permissions"]
    assert signed_in["platformRole"] == "admin"


async def test_staff_cannot_reach_family_routes_by_accident(client, db):
    """No family means no family-scoped query — never an unscoped one."""
    from app.repos import users
    from app.security import passwords

    await users.create(db, "support@example.com", passwords.hash_password("123456"),
                       platform_role="support")
    tokens = (
        await client.post("/auth/login",
                          json={"email": "support@example.com", "password": "123456"})
    ).json()

    r = await client.delete("/devices/d_whatever",
                            headers={"Authorization": f"Bearer {tokens['accessToken']}"})
    assert r.status_code in (403, 404)


async def test_a_grant_reaches_the_token_on_the_next_sign_in(client, signup_body, db):
    """Rights are carried on the access token, so a check costs no round trip."""
    from app.repos import families, memberships, users
    from app.security import passwords

    owner = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {owner['accessToken']}"}
    assert "settings:write" in owner["permissions"]

    # A second adult, added directly — invitations are not built yet.
    family = (await client.get("/family/members", headers=auth)).json()
    gran = await users.create(db, "gran@example.com", passwords.hash_password("123456"))
    await memberships.add(db, gran["_id"], family["familyId"], role="caregiver")
    assert await families.by_id(db, family["familyId"])

    signed_in = (
        await client.post("/auth/login", json={"email": "gran@example.com", "password": "123456"})
    ).json()
    assert signed_in["role"] == "caregiver"
    assert "settings:write" not in signed_in["permissions"]

    granted = await client.put(
        f"/family/members/{gran['_id']}/rights",
        json={"extra": ["settings:write"], "denied": []},
        headers=auth,
    )
    assert granted.status_code == 200
    assert "settings:write" in granted.json()["permissions"]

    again = (
        await client.post("/auth/login", json={"email": "gran@example.com", "password": "123456"})
    ).json()
    assert "settings:write" in again["permissions"], "the grant travels on the token"


async def test_the_docs_token_endpoint_is_the_same_sign_in(client, signup_body):
    """`/auth/token` exists for Swagger's Authorize box, not as a second door."""
    await client.post("/auth/signup", json=signup_body())

    r = await client.post(
        "/auth/token",
        data={"username": "parent@example.com", "password": "correct horse battery"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"

    # And the token it hands back works on a guarded route.
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200


async def test_the_docs_token_endpoint_refuses_a_wrong_password(client, signup_body):
    await client.post("/auth/signup", json=signup_body())
    r = await client.post(
        "/auth/token",
        data={"username": "parent@example.com", "password": "nope"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 401


async def test_me_reports_when_the_account_was_created(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    me = (await client.get("/auth/me", headers=auth)).json()
    # The profile page prints this as "Joined August 2026", so it has to be a
    # real timestamp rather than something the client invents.
    assert me["joinedAt"]
    assert me["joinedAt"].startswith("20")


async def test_account_can_edit_its_own_name_and_avatar_in_one_call(client, db, signup_body):
    from app.repos import users

    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    saved = await client.patch(
        "/auth/me",
        headers=auth,
        json={"displayName": "Ly Buntha", "avatarSeed": "a_profile_choice_1"},
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["displayName"] == "Ly Buntha"
    assert body["avatarSeed"] == "a_profile_choice_1"

    row = await users.by_email(db, "parent@example.com")
    assert row["displayName"] == "Ly Buntha"
    assert row["avatarSeed"] == "a_profile_choice_1"


async def test_a_childs_profile_edit_lands_on_their_learner_row(client, db, signup_body):
    from app.repos import learners

    parent = (await client.post("/auth/signup", json=signup_body())).json()
    parent_auth = {"Authorization": f"Bearer {parent['accessToken']}"}
    learner = (
        await client.post(
            "/learners",
            headers=parent_auth,
            json={"displayName": "Mia", "birthYear": 2018},
        )
    ).json()

    child = (await client.post(f"/auth/switch/{learner['id']}", headers=parent_auth)).json()
    child_auth = {"Authorization": f"Bearer {child['accessToken']}"}

    saved = await client.patch("/auth/me", headers=child_auth, json={"displayName": "Mia B"})
    assert saved.status_code == 200, saved.text
    # A child has no user row, so their name comes back as the learner name.
    assert saved.json()["learnerName"] == "Mia B"
    assert saved.json()["learnerBirthYear"] == 2018
    assert saved.json()["joinedAt"]

    row = await learners.by_id(db, learner["id"], parent["familyId"])
    assert row["displayName"] == "Mia B"
    # And the parent's own account is untouched by the child's edit.
    assert (await client.get("/auth/me", headers=parent_auth)).json()["displayName"] is None


async def test_changing_your_own_password_needs_the_current_one(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    wrong = await client.patch(
        "/auth/me/password",
        headers=auth,
        json={"currentPassword": "not it", "newPassword": "a new one entirely"},
    )
    assert wrong.status_code == 401

    ok = await client.patch(
        "/auth/me/password",
        headers=auth,
        json={"currentPassword": "correct horse battery", "newPassword": "a new one entirely"},
    )
    assert ok.status_code == 200, ok.text

    # The new one works and the old one does not.
    assert (
        await client.post(
            "/auth/login",
            json={"email": "parent@example.com", "password": "a new one entirely"},
        )
    ).status_code == 200
    assert (
        await client.post(
            "/auth/login",
            json={"email": "parent@example.com", "password": "correct horse battery"},
        )
    ).status_code == 401


async def test_a_password_change_ends_other_sessions_but_not_this_one(client, signup_body):
    """Somebody may be changing it *because* another person has been in there.

    The device doing the changing is spared: being signed out for the act of
    securing your own account is a punishment for doing the right thing.
    """
    first = (await client.post("/auth/signup", json=signup_body())).json()
    here = {"Authorization": f"Bearer {first['accessToken']}"}
    other = (
        await client.post(
            "/auth/login",
            json={"email": "parent@example.com", "password": "correct horse battery"},
        )
    ).json()

    changed = await client.patch(
        "/auth/me/password",
        headers=here,
        json={"currentPassword": "correct horse battery", "newPassword": "a new one entirely"},
    )
    assert changed.json()["signedOutSessions"] == 1

    # The other device's refresh token is dead…
    assert (
        await client.post("/auth/refresh", json={"refreshToken": other["refreshToken"]})
    ).status_code == 401
    # …and this one is still signed in.
    assert (await client.get("/auth/me", headers=here)).status_code == 200


async def test_a_child_has_no_password_to_change(client, signup_body):
    parent = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {parent['accessToken']}"}
    learner = (
        await client.post("/learners", headers=auth, json={"displayName": "Mia"})
    ).json()
    child = (await client.post(f"/auth/switch/{learner['id']}", headers=auth)).json()

    r = await client.patch(
        "/auth/me/password",
        headers={"Authorization": f"Bearer {child['accessToken']}"},
        json={"currentPassword": "anything", "newPassword": "anything else"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "no_password_account"
