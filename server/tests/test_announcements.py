"""An operator's announcement: their words, to the audience they picked, now.

The console driver is the default, so what is asserted is who was addressed —
the record under each person's bell and the push log — rather than a phone.
"""

import pytest

from app.system_defaults import DEFAULT_SETTINGS

TOKEN = "a" * 140
ANNOUNCEMENT = "system.announcement"


@pytest.fixture
async def parent(client, signup_body):
    body = signup_body()
    body["installId"] = "i_phone"
    tokens = (await client.post("/auth/signup", json=body)).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def seeded(db):
    from app.repos import system as system_repo

    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)


@pytest.fixture
async def admin(client, db):
    """A platform operator: staff, no family."""
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def announce(client, headers, *, audience="families", preview=False, **fields):
    body = {"title": "Holiday", "message": "Koda is closed on Monday.", "audience": audience, **fields}
    url = "/system/push/announcement" + ("?preview=true" if preview else "")
    return await client.post(url, headers=headers, json=body)


async def told(db) -> list[dict]:
    return await db.notifications.find({"kind": ANNOUNCEMENT}).to_list(length=50)


async def staff_id(db) -> str:
    return (await db.users.find_one({"email": "ops@example.com"}))["_id"]


async def test_families_hear_it_and_staff_do_not(client, parent, admin, db, seeded):
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN, "platform": "Pixel"})

    response = await announce(client, admin)

    assert response.status_code == 200
    report = response.json()
    assert (report["families"], report["staff"], report["people"]) == (1, 0, 1)
    rows = await told(db)
    assert len(rows) == 1
    assert (rows[0]["title"], rows[0]["body"]) == ("Holiday", "Koda is closed on Monday.")
    assert rows[0]["userId"] != await staff_id(db)
    logged = await db.push_log.find_one({"kind": ANNOUNCEMENT})
    assert logged["devices"] == 1


async def test_a_family_with_no_browser_still_finds_it_under_the_bell(client, parent, admin, db, seeded):
    await announce(client, admin)

    assert len(await told(db)) == 1


async def test_staff_audience_reaches_only_staff(client, parent, admin, db, seeded):
    report = (await announce(client, admin, audience="staff")).json()

    assert (report["families"], report["staff"]) == (0, 1)
    rows = await told(db)
    assert [row["userId"] for row in rows] == [await staff_id(db)]


async def test_everyone_reaches_both(client, parent, admin, db, seeded):
    report = (await announce(client, admin, audience="everyone")).json()

    assert report["people"] == 2
    assert len(await told(db)) == 2


async def test_a_blank_title_reads_as_koda(client, parent, admin, db, seeded):
    await announce(client, admin, title="  ")

    assert (await told(db))[0]["title"] == "Koda"


async def test_a_preview_sends_nothing_and_counts_the_browsers(client, parent, admin, db, seeded):
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN, "platform": "Pixel"})

    report = (await announce(client, admin, audience="everyone", preview=True)).json()

    assert report["preview"] is True
    assert (report["people"], report["devices"]) == (2, 1)
    assert await told(db) == []
    assert await db.push_log.count_documents({"kind": ANNOUNCEMENT}) == 0


async def test_a_parent_who_switched_announcements_off_is_not_told(client, parent, admin, db, seeded):
    switched = await client.put(
        "/push/preferences", headers=parent, json={"kind": ANNOUNCEMENT, "on": False}
    )
    assert switched.status_code == 200

    await announce(client, admin)

    assert await told(db) == []


async def test_the_operator_switch_stops_it(client, parent, admin, db, seeded):
    await db.system_settings.update_one(
        {"settingId": "push.announcements"}, {"$set": {"value": False}}, upsert=True
    )

    report = (await announce(client, admin)).json()

    assert "switched off" in report["skipped"]
    assert await told(db) == []


async def test_a_parent_cannot_announce(client, parent, seeded):
    assert (await announce(client, parent)).status_code == 403


async def test_an_empty_message_is_refused(client, admin, seeded):
    assert (await announce(client, admin, message="   ")).status_code == 400
    assert (await announce(client, admin, message="")).status_code in (400, 422)
