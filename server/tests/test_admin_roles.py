async def _admin_auth(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(
        db,
        "roles-admin@example.com",
        passwords.hash_password("admin-pass-123"),
        platform_role="admin",
    )
    session = (
        await client.post(
            "/auth/login",
            json={"email": "roles-admin@example.com", "password": "admin-pass-123"},
        )
    ).json()
    return {"Authorization": f"Bearer {session['accessToken']}"}


async def test_admin_can_create_assign_and_delete_custom_platform_role(client, db):
    auth = await _admin_auth(client, db)

    created = await client.post(
        "/admin/roles",
        headers=auth,
        json={
            "name": "Content Manager",
            "description": "Manages learning content",
            "permissions": ["settings:read", "settings:write"],
        },
    )
    assert created.status_code == 201, created.text
    role = created.json()
    assert role["id"] == "content-manager"
    assert role["builtIn"] is False

    user = await client.post(
        "/admin/users",
        headers=auth,
        json={
            "email": "content@example.com",
            "password": "content-pass-123",
            "platformRole": role["id"],
        },
    )
    assert user.status_code == 201, user.text
    assert user.json()["platformRole"] == "content-manager"

    signed_in = await client.post(
        "/auth/login",
        json={"email": "content@example.com", "password": "content-pass-123"},
    )
    assert signed_in.status_code == 200, signed_in.text
    assert signed_in.json()["role"] == "content-manager"
    assert signed_in.json()["permissions"] == ["settings:read", "settings:write"]

    in_use = await client.delete(f"/admin/roles/{role['id']}", headers=auth)
    assert in_use.status_code == 409
    assert in_use.json()["error"]["code"] == "role_in_use"

    moved = await client.patch(
        f"/admin/users/{user.json()['id']}",
        headers=auth,
        json={"platformRole": "support"},
    )
    assert moved.status_code == 200, moved.text
    assert (await client.delete(f"/admin/roles/{role['id']}", headers=auth)).status_code == 204


async def test_role_catalog_lists_platform_and_family_roles(client, db):
    auth = await _admin_auth(client, db)

    platform = await client.get("/admin/roles", headers=auth)
    assert platform.status_code == 200, platform.text
    assert {role["id"] for role in platform.json()["roles"]} >= {
        "admin", "developer", "support",
    }

    matrix = await client.get("/family/permissions", headers=auth)
    assert matrix.status_code == 200, matrix.text
    assert {"parent", "child", "student"} <= set(matrix.json()["roles"])
    assert "admin" in matrix.json()["platformRoles"]


async def test_built_in_roles_are_protected(client, db):
    auth = await _admin_auth(client, db)
    edited = await client.patch(
        "/admin/roles/admin",
        headers=auth,
        json={"permissions": ["settings:read"]},
    )
    assert edited.status_code == 409
    assert edited.json()["error"]["code"] == "built_in_role"
    assert (await client.delete("/admin/roles/support", headers=auth)).status_code == 409


async def test_family_owner_cannot_create_platform_roles(client, signup_body):
    session = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {session['accessToken']}"}
    denied = await client.post(
        "/admin/roles",
        headers=auth,
        json={"name": "Too Powerful", "permissions": ["role:manage"]},
    )
    assert denied.status_code == 403
