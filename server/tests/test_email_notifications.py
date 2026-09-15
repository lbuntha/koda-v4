"""Notification email, editable wording and job schedules — phase 1 of parent notifications.

The console driver is the default, so `mail.send` is swapped for an outbox and
what is asserted is who was written to and what they read.
"""

import re
from datetime import datetime

import pytest

from app.repos import notify_jobs
from app.services import email_notify, mail
from app.services import tasks as task_service
from app.settings import settings
from app.system_defaults import DEFAULT_SETTINGS

LOGIN = {"email": "parent@example.com", "password": "correct horse battery"}
ANNOUNCE = {"title": "Holiday", "message": "Closed on Monday.", "audience": "families", "email": True}


@pytest.fixture
def outbox(monkeypatch):
    # Pinned rather than inherited: a developer's compose file sends through
    # Mailpit, and what these assert is the console driver's honest zero.
    monkeypatch.setattr(settings(), "mail_driver", "console")
    sent: list[dict] = []

    async def fake_send(to, subject, body, headers=None):
        sent.append({"to": to, "subject": subject, "body": body, "headers": headers or {}})
        return True

    monkeypatch.setattr(mail, "send", fake_send)
    return sent


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
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"),
                       platform_role="admin")
    tokens = (
        await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def _switch(db, setting_id: str, value: bool) -> None:
    await db.system_settings.update_one({"settingId": setting_id}, {"$set": {"value": value}}, upsert=True)


def _token_in(letter: dict) -> str:
    return re.search(r"token=([\w\-.]+)", letter["body"]).group(1)


# --- account notices ---------------------------------------------------------


async def test_a_new_sign_in_is_emailed_with_no_way_to_mute_it(client, parent, db, seeded, outbox):
    await client.post("/auth/login", json={**LOGIN, "installId": "i_laptop"})

    [letter] = outbox
    assert letter["to"] == "parent@example.com"
    assert letter["subject"] == "New sign-in to your Koda account"
    assert "just signed in" in letter["body"]
    assert "always sent" in letter["body"], "an account notice carries the account footer"
    assert "unsubscribe" not in letter["body"].lower()
    assert letter["headers"] == {}
    row = await db.push_log.find_one({"kind": "device.new_signin", "channel": "email"})
    assert row["people"] and row["driver"] == "console"


async def test_an_unverified_address_is_never_written_to(client, parent, db, seeded, outbox):
    await db.users.update_one({"email": "parent@example.com"}, {"$set": {"emailVerifiedAt": None}})
    family_id = (await db.memberships.find_one({}))["familyId"]

    await email_notify.send(db, kind="device.new_signin", values={"device": "Mac"}, family_id=family_id)

    assert outbox == []
    row = await db.push_log.find_one({"kind": "device.new_signin", "channel": "email"})
    assert row["outcomes"] == {"unverified": 1}


async def test_the_email_master_stops_account_notices_too(client, parent, db, seeded, outbox):
    await _switch(db, "email.enabled", False)

    await client.post("/auth/login", json={**LOGIN, "installId": "i_laptop"})

    assert outbox == []


async def test_stop_all_does_not_silence_an_account_notice(client, parent, db, seeded, outbox):
    await client.put("/push/preferences", headers=parent, json={"kind": "*", "on": False, "channel": "email"})

    await client.post("/auth/login", json={**LOGIN, "installId": "i_laptop"})

    assert len(outbox) == 1


# --- announcements -----------------------------------------------------------


async def test_an_announcement_can_also_go_by_email(client, parent, admin, db, seeded, outbox):
    report = (await client.post("/system/push/announcement", headers=admin, json=ANNOUNCE)).json()

    assert report["emailed"] == 0, "the console driver sends nothing, and says so"
    [letter] = outbox
    assert letter["subject"] == "Holiday"
    assert "Closed on Monday." in letter["body"]
    assert "/v1/notifications/unsubscribe?token=" in letter["body"]
    assert letter["headers"]["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


async def test_an_announcement_is_not_emailed_unless_asked(client, parent, admin, seeded, outbox):
    await client.post("/system/push/announcement", headers=admin, json={**ANNOUNCE, "email": False})

    assert outbox == []


async def test_a_preview_counts_addresses_and_sends_nothing(client, parent, admin, seeded, outbox):
    report = (
        await client.post("/system/push/announcement?preview=true", headers=admin, json=ANNOUNCE)
    ).json()

    assert report["emails"] == 1
    assert outbox == []


async def test_a_parent_can_turn_announcement_emails_off(client, parent, admin, seeded, outbox):
    body = (
        await client.put(
            "/push/preferences",
            headers=parent,
            json={"kind": "system.announcement", "on": False, "channel": "email"},
        )
    ).json()
    assert next(k for k in body["emailKinds"] if k["id"] == "system.announcement")["on"] is False

    await client.post("/system/push/announcement", headers=admin, json=ANNOUNCE)

    assert outbox == []


async def test_preferences_offer_email_only_for_what_is_emailed(client, parent, seeded):
    body = (await client.get("/push/preferences", headers=parent)).json()

    assert body["emailEnabled"] is True
    assert body["emailVerified"] is True
    assert {k["id"] for k in body["emailKinds"]} == {
        "system.announcement",
        "learn.weekly_summary",
        "learn.absence",
        "learn.daily_digest",
        "learn.skill_published",
    }
    refused = await client.put(
        "/push/preferences", headers=parent, json={"kind": "device.new_signin", "on": False, "channel": "email"}
    )
    assert refused.status_code == 404


# --- the way out -------------------------------------------------------------


async def test_the_unsubscribe_link_asks_before_it_acts(client, parent, admin, db, seeded, outbox):
    await client.post("/system/push/announcement", headers=admin, json=ANNOUNCE)
    token = _token_in(outbox[0])

    page = await client.get(f"/notifications/unsubscribe?token={token}")
    assert page.status_code == 200
    assert "Stop Announcements emails" in page.text
    assert await db.notify_prefs.count_documents({"channel": "email"}) == 0, (
        "a mail scanner opening the link must change nothing"
    )

    done = await client.post(f"/notifications/unsubscribe?token={token}")

    assert done.status_code == 200
    user = await db.users.find_one({"email": "parent@example.com"})
    row = await db.notify_prefs.find_one({"_id": f"{user['_id']}:system.announcement:email"})
    assert row["on"] is False


async def test_stop_all_from_a_link_stops_progress_email(client, parent, admin, db, seeded, outbox):
    await client.post("/system/push/announcement", headers=admin, json=ANNOUNCE)
    token = _token_in(outbox[0])

    await client.post(f"/notifications/unsubscribe?token={token}&all=1")
    await client.post("/system/push/announcement", headers=admin, json=ANNOUNCE)

    assert len(outbox) == 1
    prefs = (await client.get("/push/preferences", headers=parent)).json()
    assert prefs["emailStopped"] is True


async def test_a_forged_link_changes_nothing(client, db, seeded):
    response = await client.post("/notifications/unsubscribe?token=not-a-token")

    assert response.status_code == 400
    assert await db.notify_prefs.count_documents({}) == 0


# --- wording -----------------------------------------------------------------


async def test_an_operator_can_reword_an_email_and_reset_it(client, admin, db, seeded):
    response = await client.patch(
        "/system/push/templates/system.announcement/email",
        headers=admin,
        json={"subject": "News: {title}", "body": "Hello {parent}. {message}"},
    )
    assert response.status_code == 200

    values = {"title": "Holiday", "message": "Closed.", "parent": "Dara"}
    assert await email_notify.wording(db, "system.announcement", values) == ("News: Holiday", "Hello Dara. Closed.")

    await client.delete("/system/push/templates/system.announcement/email", headers=admin)
    subject, _ = await email_notify.wording(db, "system.announcement", values)
    assert subject == "Holiday"


async def test_a_placeholder_nothing_fills_is_refused(client, admin, seeded):
    push = await client.patch(
        "/system/push/templates/device.new_signin",
        headers=admin,
        json={"title": "Hi {learnr}", "body": "{device} signed in."},
    )
    email = await client.patch(
        "/system/push/templates/system.announcement/email",
        headers=admin,
        json={"subject": "{nope}", "body": "{message}"},
    )

    assert push.status_code == 400 and "learnr" in push.text
    assert email.status_code == 400 and "nope" in email.text


async def test_the_weekly_summary_still_saves_its_old_placeholder(client, admin, seeded):
    response = await client.patch(
        "/system/push/templates/learn.weekly_summary",
        headers=admin,
        json={"title": "{learner}'s week", "body": "{learner} practised on {days} days."},
    )

    assert response.status_code == 200


async def test_the_frame_cannot_lose_its_way_out(client, admin, seeded):
    base = {"body": "Hi {parent},\n\n{message}", "accountFooter": "About your account."}

    refused = await client.patch("/system/email/frame", headers=admin, json={**base, "footer": "Bye."})
    saved = await client.patch(
        "/system/email/frame", headers=admin, json={**base, "footer": "Stop: {unsubscribe_link}"}
    )

    assert refused.status_code == 400 and "unsubscribe_link" in refused.text
    assert saved.status_code == 200
    assert saved.json()["frame"]["edited"] is True


async def test_the_templates_list_carries_email_wording(client, admin, seeded):
    body = (await client.get("/system/push/templates", headers=admin)).json()

    rows = {row["id"]: row for row in body["templates"]}
    assert rows["system.announcement"]["email"]["subject"] == "{title}"
    assert "parent" in rows["system.announcement"]["email"]["placeholders"]
    assert rows["learn.goal_met"]["email"] is None
    assert "{unsubscribe_link}" in body["frame"]["footer"]


async def test_the_test_email_goes_to_the_caller_only(client, parent, admin, seeded, outbox):
    body = (
        await client.post("/system/email/test", headers=admin, json={"kind": "system.announcement"})
    ).json()

    [letter] = outbox
    assert letter["to"] == "ops@example.com"
    assert letter["subject"].startswith("[Test]")
    assert body["driver"] == "console"


# --- the events screen and job schedules -------------------------------------


async def test_the_events_screen_lists_channels_and_jobs(client, admin, seeded):
    body = (await client.get("/system/notify/events", headers=admin)).json()

    events = {row["id"]: row for row in body["events"]}
    assert events["device.new_signin"]["email"] == {
        "available": True, "settingId": None, "on": True, "locked": True,
    }
    assert events["learn.goal_met"]["email"]["available"] is False
    assert events["system.announcement"]["email"]["settingId"] == "email.announcements"
    assert events["learn.weekly_summary"]["job"] == "weekly-summary"
    weekly = next(job for job in body["jobs"] if job["id"] == "weekly-summary")
    assert (weekly["weekday"], weekly["hour"], weekly["enabled"]) == (6, 18, True)


async def test_the_events_screen_is_staff_only(client, parent, seeded):
    assert (await client.get("/system/notify/events", headers=parent)).status_code == 403


async def test_an_operator_moves_the_weekly_summary(client, admin, seeded):
    body = (
        await client.patch("/system/notify/jobs/weekly-summary", headers=admin, json={"weekday": 5, "hour": 9})
    ).json()

    weekly = next(job for job in body["jobs"] if job["id"] == "weekly-summary")
    assert (weekly["weekday"], weekly["hour"]) == (5, 9)
    untimed = await client.patch("/system/notify/jobs/daily-reminders", headers=admin, json={"hour": 9})
    assert untimed.status_code == 400


async def test_the_summary_lands_on_the_operators_day_and_hour():
    saturday_nine = datetime(2026, 9, 19, 9, 0)
    sunday_six = datetime(2026, 9, 20, 18, 0)

    assert task_service._hours_since_summary_evening(saturday_nine, 5, 9) == 0
    assert task_service._hours_since_summary_evening(sunday_six) == 0, "the default is still Sunday 18:00"


async def test_a_switched_off_job_does_nothing_and_says_why(db, seeded):
    await notify_jobs.save(db, "weekly-summary", enabled=False)
    await notify_jobs.save(db, "token-sweep", enabled=False)

    assert (await task_service.weekly_summary(db))["skipped"] == task_service.JOB_OFF
    assert (await task_service.token_sweep(db))["skipped"] == task_service.JOB_OFF


async def test_a_run_is_noted_for_the_events_screen(client, admin, db, seeded):
    await client.post("/system/push/jobs/token-sweep", headers=admin)

    sweep = await notify_jobs.get(db, "token-sweep")
    assert sweep["lastRunAt"] is not None


async def test_the_log_says_which_channel(client, parent, admin, seeded, outbox):
    await client.post("/system/push/announcement", headers=admin, json=ANNOUNCE)

    log = (await client.get("/system/push/log", headers=admin)).json()

    assert {row["channel"] for row in log["sends"]} == {"push", "email"}
    assert {(row["kind"], row["channel"]) for row in log["summary"]} >= {
        ("system.announcement", "push"),
        ("system.announcement", "email"),
    }
