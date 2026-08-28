async def _admin_auth(client, db, email="admin@example.com"):
    from app.repos import users
    from app.security import passwords

    await users.create(
        db,
        email,
        passwords.hash_password("admin-pass-123"),
        platform_role="admin",
        display_name="Koda Admin",
    )
    signed_in = (
        await client.post(
            "/auth/login",
            json={"email": email, "password": "admin-pass-123"},
        )
    ).json()
    return {"Authorization": f"Bearer {signed_in['accessToken']}"}


async def test_admin_can_list_create_and_edit_staff(client, db):
    auth = await _admin_auth(client, db)

    created = await client.post(
        "/admin/users",
        headers=auth,
        json={
            "email": "helper@example.com",
            "displayName": "Helpful Human",
            "password": "temporary-123",
            "platformRole": "support",
        },
    )
    assert created.status_code == 201, created.text
    user = created.json()
    assert user["displayName"] == "Helpful Human"
    assert user["platformRole"] == "support"
    assert user["onboardingStatus"] == "pending"

    listing = await client.get("/admin/users?q=helper&role=support", headers=auth)
    assert listing.status_code == 200, listing.text
    assert listing.json()["total"] == 1
    assert listing.json()["users"][0]["email"] == "helper@example.com"
    assert listing.json()["stats"]["staff"] == 2
    assert listing.json()["stats"]["pendingOnboarding"] == 1
    assert listing.json()["stats"]["completedOnboarding"] == 1

    pending = await client.get("/admin/users?onboarding=pending", headers=auth)
    assert pending.status_code == 200, pending.text
    assert [item["email"] for item in pending.json()["users"]] == ["helper@example.com"]

    changed = await client.patch(
        f"/admin/users/{user['id']}",
        headers=auth,
        json={"displayName": "Support Lead", "platformRole": "developer"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["displayName"] == "Support Lead"
    assert changed.json()["platformRole"] == "developer"


async def test_family_owner_cannot_use_platform_user_management(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}
    response = await client.get("/admin/users", headers=auth)
    assert response.status_code == 403


async def test_suspending_user_revokes_sessions_and_blocks_login(client, db):
    from app.repos import users
    from app.security import passwords

    auth = await _admin_auth(client, db)
    target = await users.create(
        db,
        "support@example.com",
        passwords.hash_password("support-pass-123"),
        platform_role="support",
    )
    session = (
        await client.post(
            "/auth/login",
            json={"email": "support@example.com", "password": "support-pass-123"},
        )
    ).json()

    suspended = await client.patch(
        f"/admin/users/{target['_id']}", headers=auth, json={"status": "suspended"}
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["status"] == "suspended"
    assert suspended.json()["activeSessionCount"] == 0

    refresh = await client.post(
        "/auth/refresh", json={"refreshToken": session["refreshToken"]}
    )
    assert refresh.status_code == 401
    login = await client.post(
        "/auth/login",
        json={"email": "support@example.com", "password": "support-pass-123"},
    )
    assert login.status_code == 403
    assert login.json()["error"]["code"] == "account_suspended"


async def test_admin_cannot_lock_or_delete_self(client, db):
    auth = await _admin_auth(client, db)
    listing = (await client.get("/admin/users?q=admin@example.com", headers=auth)).json()
    admin_id = listing["users"][0]["id"]

    demoted = await client.patch(
        f"/admin/users/{admin_id}", headers=auth, json={"platformRole": "developer"}
    )
    assert demoted.status_code == 409
    assert demoted.json()["error"]["code"] == "last_active_admin"

    suspended = await client.patch(
        f"/admin/users/{admin_id}", headers=auth, json={"status": "suspended"}
    )
    assert suspended.status_code == 409
    assert suspended.json()["error"]["code"] == "cannot_change_self_access"

    deleted = await client.delete(f"/admin/users/{admin_id}", headers=auth)
    assert deleted.status_code == 409
    assert deleted.json()["error"]["code"] == "cannot_delete_self"


async def test_admin_can_change_own_role_when_another_admin_remains(client, db):
    from app.repos import users
    from app.security import passwords

    auth = await _admin_auth(client, db)
    await users.create(
        db,
        "second-admin@example.com",
        passwords.hash_password("second-admin-pass"),
        platform_role="admin",
    )
    listing = (await client.get("/admin/users?q=admin@example.com", headers=auth)).json()
    current_id = next(user["id"] for user in listing["users"] if user["isYou"])

    changed = await client.patch(
        f"/admin/users/{current_id}", headers=auth, json={"platformRole": "developer"}
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["platformRole"] == "developer"


async def test_family_account_cannot_be_deleted_from_platform_list(client, db, signup_body):
    auth = await _admin_auth(client, db)
    await client.post("/auth/signup", json=signup_body("owner@example.com"))
    listing = (await client.get("/admin/users?q=owner@example.com", headers=auth)).json()
    owner_id = listing["users"][0]["id"]

    deleted = await client.delete(f"/admin/users/{owner_id}", headers=auth)
    assert deleted.status_code == 409
    assert deleted.json()["error"]["code"] == "user_has_family"


async def test_admin_can_change_platform_and_family_roles(client, db, signup_body):
    from app.repos import memberships, users
    from app.security import passwords

    auth = await _admin_auth(client, db)
    await client.post("/auth/signup", json=signup_body("owner2@example.com"))
    owner_row = await users.by_email(db, "owner2@example.com")
    owner_membership = (await memberships.for_user(db, owner_row["_id"]))[0]

    member = await users.create(
        db,
        "member@example.com",
        passwords.hash_password("member-pass-123"),
    )
    await memberships.add(db, member["_id"], owner_membership["familyId"], role="parent")

    promoted = await client.patch(
        f"/admin/users/{member['_id']}",
        headers=auth,
        json={"displayName": "Family Developer", "platformRole": "developer"},
    )
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["displayName"] == "Family Developer"
    assert promoted.json()["platformRole"] == "developer"

    rerolled = await client.patch(
        f"/admin/users/{member['_id']}/memberships/{owner_membership['familyId']}",
        headers=auth,
        json={"role": "caregiver"},
    )
    assert rerolled.status_code == 200, rerolled.text
    assert rerolled.json()["memberships"][0]["role"] == "caregiver"

    owner_change = await client.patch(
        f"/admin/users/{owner_row['_id']}/memberships/{owner_membership['familyId']}",
        headers=auth,
        json={"role": "parent"},
    )
    assert owner_change.status_code == 409
    assert owner_change.json()["error"]["code"] == "cannot_demote_owner"
