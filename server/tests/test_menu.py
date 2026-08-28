async def _admin_auth(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(
        db,
        "menu-admin@example.com",
        passwords.hash_password("admin-pass-123"),
        platform_role="admin",
    )
    tokens = (
        await client.post(
            "/auth/login",
            json={"email": "menu-admin@example.com", "password": "admin-pass-123"},
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_role_visibility_is_applied_to_the_sidebar_response(client, db, signup_body):
    admin = await _admin_auth(client, db)
    hidden = await client.patch(
        "/menu/assets", headers=admin, json={"roles": ["child"]}
    )
    assert hidden.status_code == 200, hidden.text

    parent = (await client.post("/auth/signup", json=signup_body())).json()
    parent_auth = {"Authorization": f"Bearer {parent['accessToken']}"}
    menu = await client.get("/menu", headers=parent_auth)

    assert menu.status_code == 200, menu.text
    assert "assets" not in {item["id"] for item in menu.json()["items"]}


async def test_a_parent_is_not_offered_the_shared_art_library(client, db, signup_body):
    """The complaint that started this: Art on a parent's sidebar.

    The library is the deployment's — one family editing it changes what every
    other family draws from — so authoring it is `content:write`, which no
    family role holds and no grant can hand out.
    """
    from app.menu_defaults import DEFAULT_MENU
    from app.repos import menu as menu_repo

    for item in DEFAULT_MENU:
        await menu_repo.seed_default(db, item)

    parent = (await client.post("/auth/signup", json=signup_body())).json()
    parent_auth = {"Authorization": f"Bearer {parent['accessToken']}"}

    menu = await client.get("/menu", headers=parent_auth)
    assert "assets" not in {item["id"] for item in menu.json()["items"]}
    # An owner still runs their own family — this took nothing else away.
    assert "children" in {item["id"] for item in menu.json()["items"]}

    # And the sidebar matches the guard rather than merely hiding the door.
    refused = await client.put(
        "/art/a_test", headers=parent_auth, json={"name": "x", "svg": "<svg/>"}
    )
    assert refused.status_code == 403, refused.text


async def test_an_operator_is_still_offered_it(client, db):
    from app.menu_defaults import DEFAULT_MENU
    from app.repos import menu as menu_repo

    for item in DEFAULT_MENU:
        await menu_repo.seed_default(db, item)

    admin = await _admin_auth(client, db)
    menu = await client.get("/menu", headers=admin)
    assert "assets" in {item["id"] for item in menu.json()["items"]}


async def test_a_gate_tightened_in_code_reaches_a_row_that_was_seeded_without_one(client, db):
    """The reason the entry lingered: seeding only ever inserts.

    A row written before `requires` existed keeps no requirement, so it stays
    visible to everybody until something re-applies the shipped rule.
    """
    from app.repos import menu as menu_repo

    await db.menu_items.insert_one(
        {"familyId": None, "itemId": "assets", "label": "Art", "icon": "shapes",
         "requires": None, "enabled": True, "order": 40}
    )

    changed = await menu_repo.reconcile_visibility(
        db, {"itemId": "assets", "requires": "content:write"}
    )
    assert changed is True

    row = await db.menu_items.find_one({"familyId": None, "itemId": "assets"})
    assert row["requires"] == "content:write"
    # Presentation is the operator's, and is never touched by reconciliation.
    assert row["label"] == "Art"


async def test_the_old_learn_level_badge_is_removed_without_overwriting_custom_copy(client, db):
    from app.repos import menu as menu_repo

    await db.menu_items.insert_many([
        {"familyId": None, "itemId": "game", "label": "Learn", "badge": "{lessons} Levels"},
        {"familyId": "f_1", "itemId": "game", "badge": "My learning"},
    ])

    changed = await menu_repo.remove_legacy_badge(db, "game", "{lessons} Levels")
    assert changed is True
    default = await db.menu_items.find_one({"familyId": None, "itemId": "game"})
    custom = await db.menu_items.find_one({"familyId": "f_1", "itemId": "game"})
    assert "badge" not in default
    assert custom["badge"] == "My learning"


async def test_the_old_dashboard_pathway_badge_is_removed(client, db):
    from app.repos import menu as menu_repo

    await db.menu_items.insert_one(
        {"familyId": None, "itemId": "home", "label": "Dashboard", "badge": "Pathway"}
    )

    changed = await menu_repo.remove_legacy_badge(db, "home", "Pathway")
    assert changed is True
    default = await db.menu_items.find_one({"familyId": None, "itemId": "home"})
    assert "badge" not in default


async def test_the_old_profile_you_badge_is_removed_without_overwriting_custom_copy(client, db):
    from app.repos import menu as menu_repo

    await db.menu_items.insert_many([
        {"familyId": None, "itemId": "profile", "label": "Profile", "badge": "You"},
        {"familyId": "f_1", "itemId": "profile", "badge": "Mine"},
    ])

    changed = await menu_repo.remove_legacy_badge(db, "profile", "You")
    assert changed is True
    default = await db.menu_items.find_one({"familyId": None, "itemId": "profile"})
    custom = await db.menu_items.find_one({"familyId": "f_1", "itemId": "profile"})
    assert "badge" not in default
    assert custom["badge"] == "Mine"


async def test_the_old_settings_preferences_badge_is_removed(client, db):
    from app.repos import menu as menu_repo

    await db.menu_items.insert_one(
        {"familyId": None, "itemId": "settings", "label": "Settings", "badge": "Preferences"}
    )

    changed = await menu_repo.remove_legacy_badge(db, "settings", "Preferences")
    assert changed is True
    default = await db.menu_items.find_one({"familyId": None, "itemId": "settings"})
    assert "badge" not in default


async def test_the_old_dashboard_label_becomes_home_without_overwriting_custom_copy(client, db):
    from app.repos import menu as menu_repo

    await db.menu_items.insert_many([
        {"familyId": None, "itemId": "home", "label": "Dashboard"},
        {"familyId": "f_1", "itemId": "home", "label": "My Space"},
    ])

    changed = await menu_repo.replace_legacy_label(db, "home", "Dashboard", "Home")
    assert changed is True
    default = await db.menu_items.find_one({"familyId": None, "itemId": "home"})
    custom = await db.menu_items.find_one({"familyId": "f_1", "itemId": "home"})
    assert default["label"] == "Home"
    assert custom["label"] == "My Space"


async def test_an_operators_own_visibility_choice_survives_the_next_boot(client, db):
    from app.repos import menu as menu_repo

    admin = await _admin_auth(client, db)
    await menu_repo.seed_default(
        db, {"itemId": "assets", "label": "Art", "icon": "shapes", "requires": "content:write"}
    )

    opened = await client.patch("/menu/assets", headers=admin, json={"requires": "settings:write"})
    assert opened.status_code == 200, opened.text

    # Startup runs this against every shipped default.
    changed = await menu_repo.reconcile_visibility(
        db, {"itemId": "assets", "requires": "content:write"}
    )
    assert changed is False
    row = await db.menu_items.find_one({"familyId": None, "itemId": "assets"})
    assert row["requires"] == "settings:write"

    # Resetting the entry hands the decision back to the code.
    assert (await client.delete("/menu/assets", headers=admin)).status_code == 204
    assert await menu_repo.reconcile_visibility(
        db, {"itemId": "assets", "requires": "content:write"}
    ) in (True, False)
    row = await db.menu_items.find_one({"familyId": None, "itemId": "assets"})
    assert row["requires"] == "content:write"
    assert not row.get("visibilityPinned")


async def test_an_entry_the_code_stopped_shipping_is_removed(client, db):
    """The Gemini API row, and anything like it.

    Its `requires` named `api_key:write`, a permission the policy table no
    longer has, so it was invisible to everyone — including the admin it was
    supposedly for — and there is no client route behind it. The key itself is
    a system setting and stays where it is.
    """
    from app.menu_defaults import DEFAULT_MENU
    from app.repos import menu as menu_repo

    for item in DEFAULT_MENU:
        await menu_repo.seed_default(db, item)
    await db.menu_items.insert_one(
        {"familyId": None, "itemId": "api", "label": "Gemini API", "icon": "key",
         "requires": "api_key:write", "enabled": True, "order": 58}
    )
    # A family that had customised the dead entry keeps no trace of it either.
    await db.menu_items.insert_one({"familyId": "f_1", "itemId": "api", "label": "Keys"})

    pruned = await menu_repo.prune_orphans(db, {item["itemId"] for item in DEFAULT_MENU})
    assert pruned == 1
    assert await db.menu_items.count_documents({"itemId": "api"}) == 0

    # Everything the code does ship is untouched.
    remaining = {row["itemId"] for row in await db.menu_items.find({"familyId": None}).to_list(50)}
    assert remaining == {item["itemId"] for item in DEFAULT_MENU}


async def test_the_gemini_key_stays_an_operators_setting(client, db, signup_body):
    """Where the key actually lives, and who may reach it."""
    parent = (await client.post("/auth/signup", json=signup_body())).json()
    parent_auth = {"Authorization": f"Bearer {parent['accessToken']}"}

    # An owner runs their family; the deployment's key is not theirs to read.
    assert (await client.get("/system/settings", headers=parent_auth)).status_code == 403

    # Startup seeds these; the test fixture owns the database and skips it.
    from app.repos import system as system_repo
    from app.system_defaults import DEFAULT_SETTINGS

    for setting in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, setting)

    admin = await _admin_auth(client, db)
    settings = await client.get("/system/settings", headers=admin)
    assert settings.status_code == 200, settings.text
    keys = [s for s in settings.json()["settings"] if s["id"] == "ai.geminiApiKey"]
    assert keys, "the Gemini key is a system setting"
    # A secret is never sent back, however senior the caller.
    assert keys[0]["value"] is None
