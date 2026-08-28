"""The deployment's switchboard: whose it is, and whether it actually bites.

The two things worth asserting are that no family role can reach it however
senior, and that a switch thrown here is refused by the route it governs — a
setting nothing checks is a setting that does nothing.
"""

import pytest

from app.repos import system as system_repo
from app.system_defaults import DEFAULT_SETTINGS


@pytest.fixture(autouse=True)
async def seeded(db):
    """The app seeds these at startup; the test fixture skips the lifespan."""
    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def admin(client, db):
    """A platform operator: staff, no family, provisioned rather than signed up."""
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"),
                       platform_role="admin")
    tokens = (
        await client.post(
            "/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"}
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_every_signed_in_device_is_told_what_is_allowed(client, owner):
    """Not gated: a client that cannot read this would draw everything."""
    r = await client.get("/system", headers=owner)
    assert r.status_code == 200
    body = r.json()
    assert body["ai.liveVoice"] is True
    assert body["system.readOnly"] is False


async def test_the_master_switch_holds_every_kind_of_koda_help_off(client, admin, owner):
    """One switch an operator can reach for, and it has to reach everything.

    Folded into `GET /system` rather than left to each client: this is the one
    answer every device and the tutor proxy share, so a capability that reads
    `true` while Ask Koda is off could not exist even in a stale cache.
    """
    off = await client.patch("/system/settings/ai.enabled", json={"value": False}, headers=admin)
    assert off.status_code == 200

    effective = (await client.get("/system", headers=owner)).json()
    assert effective["ai.enabled"] is False
    assert effective["ai.chat"] is False
    assert effective["ai.liveVoice"] is False
    assert effective["ai.speech"] is False
    assert effective["ai.whiteboard"] is False
    # Drawing artwork is the Art page's job, not the assistant's, and is not
    # governed by this switch — see `KODA_CAPABILITIES`.
    assert effective["ai.artGeneration"] is True
    # Nor is anything else on the switchboard.
    assert effective["account.signupOpen"] is True


async def test_switching_koda_back_on_restores_what_was_on_before(client, admin, owner):
    """The master hides capabilities; it must never overwrite them.

    An operator who turns Koda off for a day and back on has not asked for the
    voice coach — the most expensive call in the app — to come back on if they
    had switched it off last week.
    """
    await client.patch("/system/settings/ai.liveVoice", json={"value": False}, headers=admin)
    await client.patch("/system/settings/ai.enabled", json={"value": False}, headers=admin)
    await client.patch("/system/settings/ai.enabled", json={"value": True}, headers=admin)

    effective = (await client.get("/system", headers=owner)).json()
    assert effective["ai.chat"] is True
    # Still off, because that is what an operator chose before the master was.
    assert effective["ai.liveVoice"] is False

    # And the row itself never lost the operator's decision while it was hidden.
    rows = {row["id"]: row for row in (await client.get("/system/settings", headers=admin)).json()["settings"]}
    assert rows["ai.chat"]["value"] is True
    assert rows["ai.liveVoice"]["value"] is False


async def test_a_family_owner_cannot_work_the_switchboard(client, owner):
    """It governs every family on the deployment, not just theirs."""
    assert (await client.get("/system/settings", headers=owner)).status_code == 403
    r = await client.patch("/system/settings/ai.liveVoice", json={"value": False}, headers=owner)
    assert r.status_code == 403


async def test_reset_versions_are_visible_but_resets_are_admin_only(client, owner):
    versions = await client.get("/system/maintenance/versions", headers=owner)
    assert versions.status_code == 200
    assert versions.json() == {"learningVersion": 0, "registrationsVersion": 0}
    assert (
        await client.post("/system/maintenance/learning/reset", headers=owner)
    ).status_code == 403


async def test_operator_can_erase_learning_without_removing_skills_or_registrations(
    client, admin, db
):
    await db.events.insert_one({"eventId": "event_1"})
    await db.concept_totals.insert_one({"conceptKey": "counting"})
    await db.docs.insert_many([
        {"kind": "progress", "key": "learner_1"},
        {"kind": "levels", "key": "learner_1"},
        {"kind": "skill", "key": "counting"},
    ])
    await db.profile_stats.insert_one({"subjectId": "learner_1"})
    await db.skill_registrations.insert_one({"ownerId": "learner_1", "skillId": "counting"})

    response = await client.post("/system/maintenance/learning/reset", headers=admin)
    assert response.status_code == 200
    assert response.json()["versions"]["learningVersion"] == 1
    assert response.json()["deleted"] == {
        "events": 1,
        "conceptTotals": 1,
        "progressDocuments": 2,
        "profileStats": 1,
    }
    assert await db.docs.count_documents({"kind": "skill"}) == 1
    assert await db.skill_registrations.count_documents({}) == 1


async def test_operator_can_clear_registrations_without_removing_learning(client, admin, db):
    await db.events.insert_one({"eventId": "event_1"})
    await db.skill_registrations.insert_many([
        {"ownerId": "learner_1", "skillId": "counting"},
        {"ownerId": "learner_2", "skillId": "counting"},
    ])

    response = await client.post("/system/maintenance/registrations/reset", headers=admin)
    assert response.status_code == 200
    assert response.json()["versions"]["registrationsVersion"] == 1
    assert response.json()["deleted"] == {"skillRegistrations": 2}
    assert await db.skill_registrations.count_documents({}) == 0
    assert await db.events.count_documents({}) == 1


async def test_an_operator_throws_a_switch(client, admin):
    listing = await client.get("/system/settings", headers=admin)
    assert listing.status_code == 200
    assert {s["id"] for s in listing.json()["settings"]} >= {"ai.liveVoice", "sync.enabled"}

    r = await client.patch("/system/settings/ai.liveVoice", json={"value": False}, headers=admin)
    assert r.status_code == 200
    assert r.json()["value"] is False


async def test_the_ceiling_reaches_every_family(client, admin, owner):
    await client.patch("/system/settings/ai.liveVoice", json={"value": False}, headers=admin)

    seen = (await client.get("/system", headers=owner)).json()
    assert seen["ai.liveVoice"] is False, "a family is told, and cannot switch it back on"


async def test_maintenance_mode_refuses_a_write_and_keeps_the_read(client, admin, owner):
    await client.patch("/system/settings/system.readOnly", json={"value": True}, headers=admin)

    refused = await client.post(
        "/sync/push",
        json={"mutations": [{"opId": "op_1", "kind": "skill", "key": "counting",
                             "body": {"isEnabled": True}, "baseRev": 0}]},
        headers=owner,
    )
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "read_only"

    # Reading still works, which is the whole point of the mode.
    assert (await client.get("/sync/changes?since=0", headers=owner)).status_code == 200


async def test_switching_sync_off_refuses_a_push(client, admin, owner):
    await client.patch("/system/settings/sync.enabled", json={"value": False}, headers=admin)

    r = await client.post("/sync/push", json={"events": []}, headers=owner)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "sync_disabled"


async def test_closing_signup_stops_a_new_family(client, admin, signup_body):
    await client.patch("/system/settings/account.signupOpen", json={"value": False}, headers=admin)

    r = await client.post("/auth/signup", json=signup_body("new@example.com"))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "signup_closed"


async def test_a_switch_survives_a_restart(client, admin, db):
    """Seeding is create-if-absent, or every deploy would undo an operator."""
    await client.patch("/system/settings/ai.chat", json={"value": False}, headers=admin)

    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)

    row = await db.system_settings.find_one({"settingId": "ai.chat"})
    assert row["value"] is False


async def test_a_setting_needs_code_behind_it(client, admin):
    r = await client.patch("/system/settings/ai.invented", json={"value": False}, headers=admin)
    assert r.status_code == 404


async def test_a_switch_will_not_take_a_sentence(client, admin):
    r = await client.patch("/system/settings/ai.chat", json={"value": "off"}, headers=admin)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_value"


async def test_the_notice_reaches_every_device(client, admin, owner):
    await client.patch(
        "/system/settings/system.notice",
        json={"value": "Back at 14:00 UTC."},
        headers=admin,
    )
    assert (await client.get("/system", headers=owner)).json()["system.notice"] == "Back at 14:00 UTC."


# --- The Gemini key: a `secret` row in the same collection as the switches ----
#
# Which is only safe because of one rule, asserted below: a secret's value is
# never in a response a browser can ask for. It leaves once, to the tutor server.

SERVICE_TOKEN = "test-tutor-service-token"
A_KEY = "AIzaSyTOTALLYNOTREAL1234"


@pytest.fixture
def tutor_configured():
    from app.settings import settings

    cfg = settings()
    before = cfg.tutor_service_token
    cfg.tutor_service_token = SERVICE_TOKEN
    yield
    cfg.tutor_service_token = before


async def test_an_operator_sets_the_key_and_is_told_only_which_one_it_is(client, admin):
    r = await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert body["isSet"] is True
    assert body["hint"] == "1234", "enough to recognise it"
    assert body["value"] is None, "and never the key itself"
    assert A_KEY not in r.text


async def test_the_key_is_in_no_response_a_browser_can_ask_for(client, admin, owner):
    await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)

    for headers, path in (
        (admin, "/system/settings"),
        (admin, "/system"),
        (owner, "/system"),
        (owner, "/sync/changes?since=0"),
    ):
        r = await client.get(path, headers=headers)
        assert A_KEY not in r.text, f"{path} leaked the key"


async def test_the_switchboard_every_device_reads_omits_secrets_outright(client, admin, owner):
    await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)

    body = (await client.get("/system", headers=owner)).json()
    assert "ai.geminiApiKey" not in body, "not even as null"
    assert "ai.liveVoice" in body, "the switches still come through"


async def test_a_family_owner_cannot_set_the_key(client, owner):
    r = await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=owner)
    assert r.status_code == 403


async def test_saving_nothing_withdraws_the_key(client, admin):
    await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)
    r = await client.patch("/system/settings/ai.geminiApiKey", json={"value": ""}, headers=admin)
    assert r.json()["isSet"] is False


async def test_the_tutor_server_resolves_it(client, admin, owner, tutor_configured):
    await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)

    # A learner's own device is what usually triggers this — talking to Koda is
    # what it is for — so the caller's rights are deliberately not the bar.
    r = await client.post(
        "/system/settings/ai.geminiApiKey/resolve",
        headers={**owner, "X-Service-Token": SERVICE_TOKEN},
    )
    assert r.status_code == 200
    assert r.json()["value"] == A_KEY


async def test_a_device_cannot_resolve_it_on_its_own(client, admin, tutor_configured):
    await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)

    # Even the operator who set it cannot read it back this way.
    plain = await client.post("/system/settings/ai.geminiApiKey/resolve", headers=admin)
    assert plain.status_code == 403

    wrong = await client.post(
        "/system/settings/ai.geminiApiKey/resolve",
        headers={**admin, "X-Service-Token": "guessed"},
    )
    assert wrong.status_code == 403
    assert A_KEY not in wrong.text


async def test_resolve_is_off_where_no_tutor_server_is_configured(client, admin):
    await client.patch("/system/settings/ai.geminiApiKey", json={"value": A_KEY}, headers=admin)

    r = await client.post(
        "/system/settings/ai.geminiApiKey/resolve",
        headers={**admin, "X-Service-Token": SERVICE_TOKEN},
    )
    assert r.status_code == 403, "unset TUTOR_SERVICE_TOKEN closes the route"


async def test_only_a_secret_row_can_be_resolved(client, admin, tutor_configured):
    r = await client.post(
        "/system/settings/ai.liveVoice/resolve",
        headers={**admin, "X-Service-Token": SERVICE_TOKEN},
    )
    assert r.status_code == 404
