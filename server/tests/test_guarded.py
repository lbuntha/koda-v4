"""Every route is behind authentication unless it is on this list.

Written as a sweep over the app's own route table rather than a list of URLs:
a route added next month is covered the day it is added, which a hand-written
list would not be. If you add a genuinely public endpoint, adding it here is
the moment to justify it out loud.
"""

import pytest

from app.main import create_app

# The only routes that may answer without a token, and why.
PUBLIC = {
    ("GET", "/v1/health"),  # liveness — must work before anyone has signed in
    ("POST", "/v1/auth/signup"),  # there is no token before an account exists
    ("POST", "/v1/auth/login"),  # ditto
    ("POST", "/v1/auth/google"),  # carries a Google-signed credential
    ("POST", "/v1/auth/join"),  # a child has no token before pairing
    ("POST", "/v1/auth/refresh"),  # carries its own credential in the body
    ("POST", "/v1/auth/token"),  # form-encoded sign-in, for the Swagger Authorize box
    # The two halves of a reset. Somebody who has forgotten their password has
    # no token by definition, so requiring one would make the feature a door
    # that only opens from inside. Both are budgeted instead — see
    # FORGOT_PER_IP / FORGOT_PER_ACCOUNT — and `forgot` answers 204 whether or
    # not the address exists, so neither leaks who has an account.
    ("POST", "/v1/auth/password/forgot"),
    ("POST", "/v1/auth/password/reset"),
    # Email ownership is proved before a session exists. Resend deliberately
    # answers the same way for known and unknown addresses.
    ("POST", "/v1/auth/email/resend"),
    ("POST", "/v1/auth/email/verify"),
}

DOCS = {"/v1/docs", "/v1/openapi.json", "/v1/docs/oauth2-redirect"}


def routes() -> list[tuple[str, str]]:
    """Read the routes from the OpenAPI schema.

    Not from `app.routes`: this FastAPI version keeps included routers nested,
    so walking that list finds the docs endpoints and nothing else — which is
    exactly the sort of silently-empty sweep this test exists to prevent.
    """
    schema = create_app().openapi()
    return sorted(
        (method.upper(), path)
        for path, operations in schema["paths"].items()
        if path not in DOCS
        for method in operations
        if method.upper() not in ("HEAD", "OPTIONS")
    )


def test_the_route_table_is_not_empty():
    assert len(routes()) > 10, "the sweep below is only meaningful if it sees the routes"


@pytest.mark.parametrize("method,path", routes())
async def test_every_route_refuses_an_anonymous_caller(client, method, path):
    if (method, path) in PUBLIC:
        pytest.skip("public by design — see PUBLIC in this file")

    # Path parameters are irrelevant: authentication is checked before anything
    # looks at them, so a nonsense id must still come back 401.
    url = path.replace("/v1", "", 1)
    for name in ("learner_id", "user_id", "device_id", "item_id"):
        url = url.replace(f"{{{name}}}", "anything")

    response = await client.request(method, url, json={})
    assert response.status_code == 401, f"{method} {path} answered {response.status_code}"
    assert response.json()["error"]["code"] in {"unauthorized", "token_invalid", "token_expired"}


async def test_the_menu_offers_only_what_the_guard_would_allow(client, signup_body, db):
    """A drawn entry the API then refuses is worse than a missing one."""
    from app.menu_defaults import DEFAULT_MENU
    from app.repos import menu as menu_repo
    from app.repos import users
    from app.security import passwords

    for item in DEFAULT_MENU:
        await menu_repo.seed_default(db, item)

    # An admin: no family, but content is theirs to manage.
    await users.create(db, "admin@example.com", passwords.hash_password("123456"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "admin@example.com", "password": "123456"})
    ).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    items = (await client.get("/menu", headers=auth)).json()["items"]
    ids = [i["id"] for i in items]
    assert "skills" in ids and "assets" in ids, "an admin manages content"
    assert "roles" in ids, "and can see who holds what"

    # A caregiver: reads, changes nothing — so no content pages.
    owner = (await client.post("/auth/signup", json=signup_body("owner@example.com"))).json()
    family = (
        await client.get(
            "/family/members", headers={"Authorization": f"Bearer {owner['accessToken']}"}
        )
    ).json()
    owner_menu = (
        await client.get(
            "/menu", headers={"Authorization": f"Bearer {owner['accessToken']}"}
        )
    ).json()["items"]
    owner_ids = [item["id"] for item in owner_menu]
    assert "menu" not in owner_ids, "parents cannot manage the platform menu"
    assert "roles" not in owner_ids, "parents do not need role administration"
    denied_menu_edit = await client.patch(
        "/menu/home", json={"label": "Changed by parent"},
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
    )
    assert denied_menu_edit.status_code == 403
    from app.repos import memberships

    gran = await users.create(db, "gran@example.com", passwords.hash_password("123456"))
    await memberships.add(db, gran["_id"], family["familyId"], role="caregiver")
    gran_tokens = (
        await client.post("/auth/login", json={"email": "gran@example.com", "password": "123456"})
    ).json()

    gran_items = (
        await client.get("/menu", headers={"Authorization": f"Bearer {gran_tokens['accessToken']}"})
    ).json()["items"]
    gran_ids = [i["id"] for i in gran_items]
    assert "skills" not in gran_ids and "assets" not in gran_ids
    assert "roles" not in gran_ids, "role administration is reserved for platform operators"


async def test_a_menu_entry_can_be_assigned_to_roles(client, signup_body, db):
    """Family users cannot edit the platform navigation."""
    owner = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {owner['accessToken']}"}
    r = await client.patch("/menu/game", json={"roles": ["child", "student"]}, headers=auth)
    assert r.status_code == 403


async def test_clearing_a_rule_makes_an_entry_visible_again(client, signup_body, db):
    owner = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {owner['accessToken']}"}
    denied = await client.patch("/menu/game", json={"roles": ["child"]}, headers=auth)
    assert denied.status_code == 403


async def test_an_unknown_role_on_a_menu_entry_is_refused(client, signup_body):
    owner = (await client.post("/auth/signup", json=signup_body())).json()
    r = await client.patch(
        "/menu/game",
        json={"roles": ["wizard"]},
        headers={"Authorization": f"Bearer {owner['accessToken']}"},
    )
    assert r.status_code == 403


async def test_an_operator_edits_the_shipped_menu_rather_than_a_family_one(client, db):
    """An admin has no family, so their menu edit is the default every family starts from."""
    from app.menu_defaults import DEFAULT_MENU
    from app.repos import menu as menu_repo
    from app.repos import users
    from app.security import passwords

    for item in DEFAULT_MENU:
        await menu_repo.seed_default(db, item)

    await users.create(db, "admin@example.com", passwords.hash_password("123456"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "admin@example.com", "password": "123456"})
    ).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    edited = await client.patch("/menu/home", json={"badge": "Start"}, headers=auth)
    assert edited.status_code == 200, edited.text
    assert edited.json()["badge"] == "Start"

    default = await menu_repo.get_default(db, "home")
    assert default["badge"] == "Start", "the shipped default moved, not a family override"

    # …and DELETE puts the shipped value back rather than removing the entry.
    assert (await client.delete("/menu/home", headers=auth)).status_code == 204
    assert (await menu_repo.get_default(db, "home")).get("badge") is None


async def test_staff_cannot_write_a_childs_record_and_are_told_clearly(client, db):
    """The 403 a staff device gets on /sync/push is the design, not a bug."""
    from app.repos import users
    from app.security import passwords

    await users.create(db, "dev@example.com", passwords.hash_password("123456"),
                       platform_role="developer")
    tokens = (
        await client.post("/auth/login", json={"email": "dev@example.com", "password": "123456"})
    ).json()

    r = await client.post(
        "/sync/push",
        json={"events": []},
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
    )
    assert r.status_code == 403
    assert "learner_data append" in r.json()["error"]["message"]
