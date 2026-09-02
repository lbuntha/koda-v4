"""Notifications: who may be rung, who may never be, and what a dead token costs.

The console driver is the default, so nothing here needs a Firebase project. The
one test that exercises the real transport replaces the HTTP call itself, which
is the only part of `fcm.py` that cannot be run on a laptop.
"""

import pytest

from app.repos import push_tokens
from app.services import fcm, push
from app.settings import settings
from app.system_defaults import DEFAULT_SETTINGS

TOKEN = "f" * 140
OTHER = "e" * 140


@pytest.fixture
async def parent(client, signup_body):
    body = signup_body()
    body["installId"] = "i_phone"
    tokens = (await client.post("/auth/signup", json=body)).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def child(client, parent):
    """A learner-scoped session, the way a kid's tablet gets one."""
    learner = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia", "birthYear": 2017})
    ).json()
    code = (await client.post(f"/learners/{learner['id']}/join-code", headers=parent)).json()
    tokens = (
        await client.post("/auth/join", json={"code": code["code"], "deviceName": "Mia's tablet"})
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}



@pytest.fixture
async def seeded(db):
    """The app seeds the switchboard at startup; the test fixture skips the lifespan."""
    from app.repos import system as system_repo

    for item in DEFAULT_SETTINGS:
        await system_repo.seed_default(db, item)


@pytest.fixture
async def admin(client, db):
    """A platform operator: staff, no family, provisioned rather than signed up."""
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}

async def _operator_switches(db, setting_id: str, value: bool) -> None:
    """Throw one switch on the deployment's switchboard.

    Upserted rather than updated: the test app runs without its lifespan, so
    the settings collection starts empty and `value_of` is answering with the
    shipped default until a row exists.
    """
    await db.system_settings.update_one({"settingId": setting_id}, {"$set": {"value": value}}, upsert=True)


# --- who may hold a token -------------------------------------------------


async def test_a_parent_can_register_their_browser(client, parent, db):
    response = await client.post("/push/tokens", headers=parent, json={"token": TOKEN, "platform": "Pixel"})

    assert response.status_code == 204
    row = await db.push_tokens.find_one({"token": TOKEN})
    assert row["platform"] == "Pixel"
    assert row["deviceId"], "a token is attached to the session that registered it"


async def test_registering_the_same_token_again_is_one_row(client, parent, db):
    """The client re-registers on every launch, because FCM rotates tokens."""
    for _ in range(3):
        await client.post("/push/tokens", headers=parent, json={"token": TOKEN})

    assert await db.push_tokens.count_documents({}) == 1


async def test_a_childs_device_is_refused(client, child, db):
    """The promise that matters most, kept by the endpoint rather than the screen."""
    response = await client.post("/push/tokens", headers=child, json={"token": TOKEN})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "push_learner_forbidden"
    assert await db.push_tokens.count_documents({}) == 0


async def test_forgetting_a_token_needs_it_to_be_yours(client, parent, db):
    await db.push_tokens.insert_one(
        {"_id": "pt_other", "token": OTHER, "familyId": "f_someone_else", "userId": "u_x",
         "deviceId": "d_x", "disabledAt": None}
    )

    response = await client.delete(f"/push/tokens/{OTHER}")

    assert response.status_code == 401
    assert await db.push_tokens.count_documents({"token": OTHER}) == 1


async def test_a_parent_can_forget_their_own(client, parent, db):
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN})

    response = await client.delete(f"/push/tokens/{TOKEN}", headers=parent)

    assert response.status_code == 204
    assert await db.push_tokens.count_documents({}) == 0


# --- a token dies with its session ---------------------------------------


async def test_signing_a_device_out_stops_it_being_rung(client, parent, db):
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN})
    device_id = (await db.push_tokens.find_one({"token": TOKEN}))["deviceId"]

    await client.delete(f"/devices/{device_id}", headers=parent)

    assert await db.push_tokens.count_documents({}) == 0, "a signed-out tablet must stop buzzing"


async def test_signing_out_everything_else_takes_those_tokens_too(client, parent, db, signup_body):
    """The gesture for a list somebody no longer recognises."""
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN})
    kept = (await db.push_tokens.find_one({"token": TOKEN}))["deviceId"]
    second = (
        await client.post(
            "/auth/login",
            json={"email": "parent@example.com", "password": "correct horse battery", "installId": "i_laptop"},
        )
    ).json()
    await client.post(
        "/push/tokens",
        headers={"Authorization": f"Bearer {second['accessToken']}"},
        json={"token": OTHER},
    )

    await client.delete("/devices", headers=parent)

    remaining = await db.push_tokens.find({}).to_list(length=10)
    assert [row["deviceId"] for row in remaining] == [kept], "the device asking is spared, the rest are not"


# --- the gates ------------------------------------------------------------


async def test_the_deployment_switch_is_a_ceiling(db):
    assert await push.allowed(db, "learn.goal_met") is True

    await _operator_switches(db, "push.enabled", False)

    assert await push.allowed(db, "learn.goal_met") is False
    assert await push.allowed(db, "device.new_signin") is False, "the master governs account kinds too"


async def test_one_kind_can_be_switched_off_without_the_others(db):
    await _operator_switches(db, "push.goalMet", False)

    assert await push.allowed(db, "learn.goal_met") is False
    assert await push.allowed(db, "learn.weekly_summary") is True


async def test_a_family_may_switch_a_courtesy_kind_off(db):
    assert await push.allowed(db, "learn.goal_met", {"learn.goal_met": False}) is False


async def test_a_family_cannot_switch_on_what_the_operator_switched_off(db):
    await _operator_switches(db, "push.goalMet", False)

    assert await push.allowed(db, "learn.goal_met", {"learn.goal_met": True}) is False


async def test_reminders_ship_off_for_families(db):
    """The operator row says Koda is willing; a parent still has to ask."""
    assert await push.allowed(db, "learn.practice_reminder") is False
    assert await push.allowed(db, "learn.practice_reminder", {"learn.practice_reminder": True}) is True


async def test_an_account_kind_ignores_a_preference(db):
    assert await push.allowed(db, "device.new_signin", {"device.new_signin": False}) is True


async def test_an_unknown_kind_is_never_sent(db):
    assert await push.allowed(db, "learn.made_up") is False


# --- sending --------------------------------------------------------------


async def test_the_console_driver_reports_what_left_the_process(client, parent, db):
    """Zero sent, because zero was sent. A test that lies is worse than no test."""
    await client.post("/push/tokens", headers=parent, json={"token": TOKEN})
    family_id = (await db.push_tokens.find_one({"token": TOKEN}))["familyId"]

    sent = await push.send(
        db, to=push.Recipient(family_id=family_id), kind="learn.goal_met", title="Hi", body="There"
    )

    assert sent == 0
    assert await db.push_tokens.count_documents({}) == 1, "logging must not retire anybody's token"


async def test_a_new_machine_notifies_the_family_and_a_familiar_one_does_not(client, parent, monkeypatch):
    calls: list[dict] = []

    async def record(db, **kwargs):
        calls.append(kwargs)
        return 0

    monkeypatch.setattr(push, "send", record)

    login = {"email": "parent@example.com", "password": "correct horse battery"}
    await client.post("/auth/login", json={**login, "installId": "i_laptop"})
    assert [c["kind"] for c in calls] == ["device.new_signin"]
    assert calls[0]["to"].exclude_device_id, "never tell the device that is signing in"

    await client.post("/auth/login", json={**login, "installId": "i_laptop"})
    assert len(calls) == 1, "signing in again on a known machine is not news"


# --- what FCM's answers cost ----------------------------------------------


def _fcm_says(status: int, code: str | None = None):
    payload = {"error": {"status": code, "details": [{"errorCode": code}]}} if code else {}
    return lambda url, body: (status, payload)


@pytest.fixture
def fcm_driver(monkeypatch):
    monkeypatch.setattr(settings(), "push_driver", "fcm")
    monkeypatch.setattr(settings(), "firebase_project_id", "learn-with-koda")
    monkeypatch.setattr(fcm, "RETRIES", 0)


async def _one_token(db) -> str:
    await push_tokens.save(
        db, token=TOKEN, family_id="f_1", user_id="u_1", device_id="d_1", platform="Pixel"
    )
    return "f_1"


async def test_an_unregistered_token_is_deleted_not_disabled(db, fcm_driver, monkeypatch):
    family_id = await _one_token(db)
    monkeypatch.setattr(fcm, "_post", _fcm_says(404, "UNREGISTERED"))

    sent = await push.send(db, to=push.Recipient(family_id=family_id), kind="learn.goal_met", title="a", body="b")

    assert sent == 0
    assert await db.push_tokens.count_documents({}) == 0, "it will never work again"


async def test_three_soft_failures_retire_a_token(db, fcm_driver, monkeypatch):
    family_id = await _one_token(db)
    monkeypatch.setattr(fcm, "_post", _fcm_says(503, "UNAVAILABLE"))

    for _ in range(3):
        await push.send(db, to=push.Recipient(family_id=family_id), kind="learn.goal_met", title="a", body="b")

    row = await db.push_tokens.find_one({"token": TOKEN})
    assert row is not None, "a bad afternoon at Google is not the parent's fault"
    assert row["disabledAt"] is not None
    assert await push_tokens.live_for_family(db, family_id) == []


async def test_a_quota_refusal_leaves_the_token_alone(db, fcm_driver, monkeypatch):
    family_id = await _one_token(db)
    monkeypatch.setattr(fcm, "_post", _fcm_says(429, "QUOTA_EXCEEDED"))

    await push.send(db, to=push.Recipient(family_id=family_id), kind="learn.goal_met", title="a", body="b")

    row = await db.push_tokens.find_one({"token": TOKEN})
    assert row["failures"] == 0, "the deployment is at fault, not the phone"


async def test_a_delivered_message_is_counted(db, fcm_driver, monkeypatch):
    family_id = await _one_token(db)
    monkeypatch.setattr(fcm, "_post", lambda url, body: (200, {"name": "projects/x/messages/1"}))

    sent = await push.send(db, to=push.Recipient(family_id=family_id), kind="learn.goal_met", title="a", body="b")

    assert sent == 1


async def test_the_message_carries_no_notification_block(db):
    """Data only: the worker draws the notification, so the words stay ours."""
    body = fcm.envelope(TOKEN, {"title": "a", "body": "b", "path": "/family"})

    assert "notification" not in body["message"]
    assert body["message"]["data"]["title"] == "a"
    assert body["message"]["webpush"]["fcm_options"]["link"].endswith("/family")
    assert "validateOnly" not in body


async def test_sending_never_raises(db, fcm_driver, monkeypatch):
    family_id = await _one_token(db)

    def explode(url, body):
        raise RuntimeError("the network is on fire")

    monkeypatch.setattr(fcm, "_post", explode)

    assert await push.send(db, to=push.Recipient(family_id=family_id), kind="learn.goal_met", title="a", body="b") == 0


# --- what a parent may choose ---------------------------------------------


async def test_a_parent_is_offered_the_courtesy_kinds_only(client, parent, seeded):
    body = (await client.get("/push/preferences", headers=parent)).json()

    offered = {kind["id"] for kind in body["kinds"]}
    assert "learn.goal_met" in offered
    assert "device.new_signin" not in offered, "an account notice is not a preference"
    assert body["enabled"] is True


async def test_reminders_are_offered_but_start_off(client, parent, seeded):
    body = (await client.get("/push/preferences", headers=parent)).json()

    reminder = next(k for k in body["kinds"] if k["id"] == "learn.practice_reminder")
    assert reminder["on"] is False, "a parent has to ask for it"


async def test_a_kind_the_operator_switched_off_is_absent_not_shown_off(client, parent, db, seeded):
    await _operator_switches(db, "push.goalMet", False)

    body = (await client.get("/push/preferences", headers=parent)).json()

    assert "learn.goal_met" not in {kind["id"] for kind in body["kinds"]}, (
        "a switch a family cannot move is not a setting"
    )


async def test_a_parent_can_turn_a_reminder_on(client, parent, db, seeded):
    body = (
        await client.put("/push/preferences", headers=parent, json={"kind": "learn.practice_reminder", "on": True})
    ).json()

    reminder = next(k for k in body["kinds"] if k["id"] == "learn.practice_reminder")
    assert reminder["on"] is True
    assert await push.allowed(db, "learn.practice_reminder", {"learn.practice_reminder": True}) is True


async def test_an_account_kind_cannot_be_muted(client, parent, seeded):
    response = await client.put("/push/preferences", headers=parent, json={"kind": "device.new_signin", "on": False})

    assert response.status_code == 404


async def test_a_childs_device_cannot_read_preferences(client, child, seeded):
    assert (await client.get("/push/preferences", headers=child)).status_code == 403


# --- the operator's two functions -----------------------------------------


async def test_preflight_is_staff_only(client, parent, seeded):
    assert (await client.get("/system/push/preflight", headers=parent)).status_code == 403


async def test_preflight_names_the_thing_to_fix(client, admin, seeded):
    body = (await client.get("/system/push/preflight", headers=admin)).json()

    assert body["ok"] is False, "the console driver is not a working deployment"
    driver = next(check for check in body["checks"] if check["check"] == "driver")
    assert "PUSH_DRIVER=fcm" in driver["fix"], "a failed check must say what fixes it"
    coverage = next(check for check in body["checks"] if check["check"] == "coverage")
    assert coverage["detail"].startswith("no browsers"), coverage["detail"]


async def test_the_test_send_takes_no_recipient(client, admin, seeded):
    """The rule that matters most about this route, asserted rather than trusted."""
    schema = (await client.get("/openapi.json")).json()
    route = schema["paths"]["/v1/system/push/test"]["post"]

    assert not route.get("parameters"), "a test send that can name a target is an arbitrary-push primitive"
    assert "requestBody" not in route


async def test_the_test_send_is_honest_about_the_console_driver(client, admin, db, seeded):
    await push_tokens.save(db, token=TOKEN, family_id=None, user_id="u_ops", device_id=None)
    ops = await db.users.find_one({"email": "ops@example.com"})
    await db.push_tokens.update_one({"token": TOKEN}, {"$set": {"userId": ops["_id"]}})

    body = (await client.post("/system/push/test", headers=admin)).json()

    assert body["driver"] == "console"
    assert body["sent"] == 0
    assert "sends nothing" in body["note"], "a test that lies is worse than no test"


async def test_the_test_send_says_when_there_is_nothing_to_ring(client, admin, seeded):
    body = (await client.post("/system/push/test", headers=admin)).json()

    assert body["sent"] == 0
    assert "No browser is registered anywhere yet" in body["note"]


async def test_an_operator_may_register_their_own_browser(client, admin, db, seeded):
    """Staff belong to no family, and would otherwise be unable to test their own work."""
    response = await client.post("/push/tokens", headers=admin, json={"token": TOKEN})

    assert response.status_code == 204
    row = await db.push_tokens.find_one({"token": TOKEN})
    assert row["familyId"] is None
    assert await push_tokens.live_for_family(db, "f_any") == [], "and is reachable by no family's send"


async def test_a_send_asks_each_adult_separately(db, fcm_driver, monkeypatch, seeded):
    """Two parents on one account may want different things."""
    from app.repos import notify_prefs

    await push_tokens.save(db, token=TOKEN, family_id="f_1", user_id="u_keen", device_id="d_1")
    await push_tokens.save(db, token=OTHER, family_id="f_1", user_id="u_quiet", device_id="d_2")
    await notify_prefs.set_pref(db, "u_quiet", "learn.goal_met", False)
    rung: list[str] = []
    monkeypatch.setattr(fcm, "_post", lambda url, body: (rung.append(body["message"]["token"]), (200, {}))[1])

    sent = await push.send(db, to=push.Recipient(family_id="f_1"), kind="learn.goal_met", title="a", body="b")

    assert sent == 1
    assert rung == [TOKEN], "the parent who switched it off is not rung"


async def test_an_account_notice_reaches_a_parent_who_muted_everything(db, fcm_driver, monkeypatch, seeded):
    from app.repos import notify_prefs

    await push_tokens.save(db, token=TOKEN, family_id="f_1", user_id="u_quiet", device_id="d_1")
    await notify_prefs.set_pref(db, "u_quiet", "learn.goal_met", False)
    monkeypatch.setattr(fcm, "_post", lambda url, body: (200, {}))

    sent = await push.send(
        db, to=push.Recipient(family_id="f_1"), kind="device.new_signin", title="a", body="b"
    )

    assert sent == 1, "a security notice is not something to have muted by accident"


async def test_a_passing_check_carries_no_fix(client, admin, seeded):
    """A "here is how to fix it" beside a PASS teaches people to stop reading."""
    body = (await client.get("/system/push/preflight", headers=admin)).json()

    for check in body["checks"]:
        if check["ok"]:
            assert check["fix"] is None, f"{check['check']} passed but suggests a fix"


async def test_preflight_says_which_reason_it_skipped_reachability_for(client, admin, db, seeded):
    """Reporting "no live token" while a token plainly exists is worse than silence."""
    await push_tokens.save(db, token=TOKEN, family_id=None, user_id="u_ops", device_id=None)

    body = (await client.get("/system/push/preflight", headers=admin)).json()

    reach = next(check for check in body["checks"] if check["check"] == "reachability")
    assert "driver or project" in reach["detail"], reach["detail"]


async def test_coverage_reads_as_a_sentence(client, admin, db, seeded):
    """A line an operator scans should not say "1 browser(s) across 0 family(ies)"."""
    await push_tokens.save(db, token=TOKEN, family_id=None, user_id="u_ops", device_id=None)

    body = (await client.get("/system/push/preflight", headers=admin)).json()

    coverage = next(check for check in body["checks"] if check["check"] == "coverage")
    assert coverage["detail"] == "1 browser registered, across no families yet"


async def test_a_test_send_says_when_the_browser_belongs_to_someone_else(client, admin, db, seeded):
    """The confusing case: registered on this deployment, but not to you.

    Telling an operator to "turn notifications on in Settings" when they already
    did — on a phone signed in as their family account — sends them to re-do the
    one thing that worked.
    """
    await push_tokens.save(db, token=TOKEN, family_id="f_1", user_id="u_somebody_else", device_id="d_1")

    body = (await client.post("/system/push/test", headers=admin)).json()

    assert body["sent"] == 0
    assert "1 is registered on this deployment" in body["note"]
    assert "signed in as a different account" in body["note"]
