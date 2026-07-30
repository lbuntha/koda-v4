"""Notifications, over the real endpoints plus the generators that hook into
event ingestion. Covers: an admin composing and a parent reading a broadcast,
the students-never-get-email guard, achievement/streak idempotency, the weekly
digest's once-per-week cap, the admin kill switch, the per-parent email
opt-outs, and the audit trail — the properties the notifications plan called
out as the ones worth pinning down.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest_asyncio

from app.core.mail import MemoryMailer, set_mailer
from app.core.security import hash_secret
from app.core.throttle import STUDENT_PIN
from app.features.notifications import jobs, service
from app.models.audit import ContentAuditEvent
from app.models.event import LearningEvent
from app.models.mastery import MasteryState
from app.models.notification import Notification, NotificationReceipt
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth

#: 2026-01-04 is a Sunday — the default `weekly_digest_day`.
A_SUNDAY = datetime(2026, 1, 4, 7, 0, tzinfo=timezone.utc)


@pytest_asyncio.fixture
async def mailbox():
    mailer = MemoryMailer()
    set_mailer(mailer)
    yield mailer
    set_mailer(None)


@pytest_asyncio.fixture
async def admin(database) -> User:
    user = User(
        email="admin@example.com", name="Admin",
        password_hash=hash_secret("correct-horse-battery"), role=Role.admin.value,
    )
    await user.insert()
    return user


# ── admin composes, a parent reads ──────────────────────────────────────────

async def test_admin_composes_a_broadcast_and_a_parent_reads_it(api, admin, adult, mailbox):
    compose = await api.post(
        "/notifications/compose",
        json={
            "title": "Report cards are in", "body": "Check your dashboard.",
            "audience": "user", "target_user_id": str(adult.id), "channels": ["in_app"],
        },
        headers=auth(str(admin.id), "admin"),
    )
    assert compose.status_code == 201
    notification_id = compose.json()["id"]
    assert compose.json()["recipient_count"] == 1

    sent = await api.get("/notifications/sent", headers=auth(str(admin.id), "admin"))
    assert any(row["id"] == notification_id for row in sent.json())

    inbox = await api.get("/notifications/me", headers=auth(str(adult.id), "parent"))
    assert inbox.json()["unread_count"] == 1
    receipt_id = inbox.json()["items"][0]["id"]

    marked = await api.post(f"/notifications/me/{receipt_id}/read", headers=auth(str(adult.id), "parent"))
    assert marked.status_code == 200

    inbox_after = await api.get("/notifications/me", headers=auth(str(adult.id), "parent"))
    assert inbox_after.json()["unread_count"] == 0


async def test_students_can_never_be_emailed(api, admin):
    resp = await api.post(
        "/notifications/compose",
        json={"title": "x", "body": "y", "audience": "students", "channels": ["email"]},
        headers=auth(str(admin.id), "admin"),
    )
    assert resp.status_code == 422


async def test_compose_writes_an_audit_event(api, admin, adult, database):
    await api.post(
        "/notifications/compose",
        json={
            "title": "x", "body": "y", "audience": "user",
            "target_user_id": str(adult.id), "channels": ["in_app"],
        },
        headers=auth(str(admin.id), "admin"),
    )
    events = await ContentAuditEvent.find(ContentAuditEvent.resource_type == "notification").to_list()
    assert len(events) == 1
    assert events[0].action == "broadcast_sent"


# ── mail configuration form ──────────────────────────────────────────────────

async def test_test_mail_endpoint_sends_to_the_requesting_admin(api, admin, mailbox):
    resp = await api.post("/settings/test-mail", headers=auth(str(admin.id), "admin"))
    assert resp.status_code == 200
    assert len(mailbox.sent) == 1
    assert mailbox.sent[0].to == admin.email


# ── achievement / streak idempotency ────────────────────────────────────────

async def test_achievement_notification_fires_once_per_level(database, learner):
    update = {
        "skillId": "skill-x", "curriculumId": "curr-1",
        "previousLevel": "developing", "level": "proficient", "promoted": True,
    }
    await service.on_events_ingested(learner, [update], [])
    await service.on_events_ingested(learner, [update], [])  # regress + re-promote to the same level
    count = await Notification.find(Notification.kind == "auto_achievement").count()
    assert count == 1


async def test_routine_promotions_are_not_achievements(database, learner):
    update = {
        "skillId": "skill-x", "curriculumId": "curr-1",
        "previousLevel": "beginner", "level": "developing", "promoted": True,
    }
    await service.on_events_ingested(learner, [update], [])
    count = await Notification.find(Notification.kind == "auto_achievement").count()
    assert count == 0


async def test_streak_milestone_fires_once_per_threshold(database, learner):
    student_id = str(learner.id)
    # `reference_today` anchors on the *actual* wall clock (see features/learning/streak.py),
    # not on the events' own dates — a real streak goes stale in real time. So the fixture
    # window has to end at today, not at an arbitrary fixed date, or `current_run` sees it as
    # long expired.
    base_day = datetime.now(timezone.utc).date() - timedelta(days=6)
    week_of_events = [
        LearningEvent(
            student_id=student_id, event_type="attempt", outcome="correct", verified=True,
            occurred_at=f"{(base_day + timedelta(days=i)).isoformat()}T10:00:00+00:00",
        )
        for i in range(7)
    ]
    await LearningEvent.insert_many(week_of_events)
    await service.on_events_ingested(learner, [], week_of_events)

    milestones = await Notification.find(Notification.kind == "auto_streak").to_list()
    assert len(milestones) == 1
    assert milestones[0].idempotency_key.endswith(":7")

    eighth_day = LearningEvent(
        student_id=student_id, event_type="attempt", outcome="correct", verified=True,
        occurred_at=f"{(base_day + timedelta(days=7)).isoformat()}T10:00:00+00:00",
    )
    await eighth_day.insert()
    await service.on_events_ingested(learner, [], [eighth_day])

    still_one = await Notification.find(Notification.kind == "auto_streak").count()
    assert still_one == 1  # 8 isn't on the milestone ladder, and 7 must not re-fire


# ── weekly digest ────────────────────────────────────────────────────────────

async def test_weekly_digest_is_capped_to_once_per_week(database, adult, mailbox):
    await Student(name="Kid", guardian_parent_ids=[str(adult.id)]).insert()

    first = await jobs.run_weekly_digests(A_SUNDAY)
    second = await jobs.run_weekly_digests(A_SUNDAY)

    assert first == 1
    assert second == 0
    assert len(mailbox.sent) == 1
    assert mailbox.sent[0].to == adult.email


async def test_digest_opt_out_skips_the_email_but_not_a_broadcast(database, adult, mailbox):
    adult.email_digest_enabled = False
    await adult.save()
    await Student(name="Kid", guardian_parent_ids=[str(adult.id)]).insert()

    sent = await jobs.run_weekly_digests(A_SUNDAY)
    assert sent == 0
    assert mailbox.sent == []

    await service.create_and_send(
        kind="broadcast", title="New feature", body="Check it out",
        audience="parents", channels=["email"],
    )
    assert len(mailbox.sent) == 1
    assert mailbox.sent[0].to == adult.email


# ── admin kill switch ────────────────────────────────────────────────────────

async def test_admin_can_turn_off_automated_achievements(api, admin, learner, database):
    current = await api.get("/settings", headers=auth(str(admin.id), "admin"))
    scoring = current.json()["scoring"]
    scoring["notifications"]["auto_achievement_enabled"] = False
    updated = await api.put(
        "/settings",
        json={"scoring": scoring, "scoring_revision": current.json()["scoring_revision"]},
        headers=auth(str(admin.id), "admin"),
    )
    assert updated.status_code == 200

    update = {
        "skillId": "skill-x", "curriculumId": "curr-1",
        "previousLevel": "developing", "level": "proficient", "promoted": True,
    }
    await service.on_events_ingested(learner, [update], [])
    count = await Notification.find(Notification.kind == "auto_achievement").count()
    assert count == 0


# ── review-due reminders ─────────────────────────────────────────────────────

async def due_skill(student_id: str, skill: str, *, days_overdue: int = 1) -> MasteryState:
    state = MasteryState(
        student_id=student_id, skill_id=skill, curriculum_id="curr-1", level="proficient",
        next_review_at=datetime.now(timezone.utc) - timedelta(days=days_overdue),
    )
    await state.insert()
    return state


async def test_review_reminder_groups_the_whole_backlog_into_one_note(database, learner):
    for skill in ("skill-a", "skill-b", "skill-c"):
        await due_skill(str(learner.id), skill)

    sent = await jobs.run_review_reminders(datetime.now(timezone.utc))

    assert sent == 1
    rows = await Notification.find(Notification.kind == "auto_review").to_list()
    assert len(rows) == 1                      # one note, not one per skill
    assert "3 skills" in rows[0].title


async def test_review_reminder_does_not_repeat_within_a_day(database, learner):
    await due_skill(str(learner.id), "skill-a")
    now = datetime.now(timezone.utc)

    assert await jobs.run_review_reminders(now) == 1
    assert await jobs.run_review_reminders(now) == 0


async def test_an_unread_review_reminder_is_never_stacked_on(database, learner):
    """The anti-pileup guard: a learner away for weeks must not return to a wall of these."""
    await due_skill(str(learner.id), "skill-a")
    day_one = datetime.now(timezone.utc)
    assert await jobs.run_review_reminders(day_one) == 1

    # A new day, so the daily idempotency key would allow another — but the first is unread.
    assert await jobs.run_review_reminders(day_one + timedelta(days=1)) == 0
    assert await jobs.run_review_reminders(day_one + timedelta(days=9)) == 0

    # Once they have actually seen it, the next day's reminder is welcome again.
    await service.mark_all_read("student", str(learner.id))
    assert await jobs.run_review_reminders(day_one + timedelta(days=10)) == 1


async def test_a_learner_with_nothing_due_is_left_alone(database, learner):
    await due_skill(str(learner.id), "skill-future", days_overdue=-5)  # due in 5 days
    assert await jobs.run_review_reminders(datetime.now(timezone.utc)) == 0


async def test_review_reminders_respect_the_kill_switch(database, learner, api, admin):
    await due_skill(str(learner.id), "skill-a")
    current = await api.get("/settings", headers=auth(str(admin.id), "admin"))
    scoring = current.json()["scoring"]
    scoring["notifications"]["auto_review_enabled"] = False
    await api.put(
        "/settings",
        json={"scoring": scoring, "scoring_revision": current.json()["scoring_revision"]},
        headers=auth(str(admin.id), "admin"),
    )
    assert await jobs.run_review_reminders(datetime.now(timezone.utc)) == 0


# ── PIN lockout alerts ───────────────────────────────────────────────────────

FAMILY_CODE = "LOCK99"
CHILD_PIN = "4821"


@pytest_asyncio.fixture
async def family(database):
    parent = User(
        email="guardian@example.com", name="Guardian",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value, family_code=FAMILY_CODE,
    )
    await parent.insert()
    child = Student(
        name="Robin", guardian_parent_ids=[str(parent.id)], pin_hash=hash_secret(CHILD_PIN),
    )
    await child.insert()
    return parent, child


async def exhaust_pin_attempts(api, name: str = "Robin"):
    for _ in range(STUDENT_PIN.max_attempts):
        await api.post(
            "/auth/student/login",
            json={"family_code": FAMILY_CODE, "name": name, "pin": "0000"},
        )


async def test_a_locked_pin_tells_the_guardian_how_to_clear_it(api, family, mailbox):
    parent, child = family
    await exhaust_pin_attempts(api)

    rows = await Notification.find(Notification.kind == "auto_pin_lockout").to_list()
    assert len(rows) == 1
    assert child.name in rows[0].title
    assert "Unlock PIN" in rows[0].body        # the actual remedy, not just the bad news

    inbox = await service.list_inbox("user", str(parent.id))
    assert inbox.unread_count == 1
    assert [message.to for message in mailbox.sent] == [parent.email]


async def test_only_one_alert_per_lockout_window(api, family, mailbox):
    """Further attempts inside the same lockout must not each generate mail."""
    await exhaust_pin_attempts(api)
    await exhaust_pin_attempts(api)

    assert await Notification.find(Notification.kind == "auto_pin_lockout").count() == 1
    assert len(mailbox.sent) == 1


async def test_guessing_a_name_that_is_not_a_real_child_alerts_nobody(api, family, mailbox):
    """Otherwise the endpoint mails a household about children who do not exist."""
    await exhaust_pin_attempts(api, name="Nobody")

    assert await Notification.find(Notification.kind == "auto_pin_lockout").count() == 0
    assert mailbox.sent == []


async def test_a_lockout_alert_ignores_the_marketing_opt_outs(api, family, mailbox):
    """An account alert a parent 'opted out' of would leave a child stuck with nobody told."""
    parent, _ = family
    parent.email_digest_enabled = False
    parent.email_announcements_enabled = False
    await parent.save()

    await exhaust_pin_attempts(api)
    assert [message.to for message in mailbox.sent] == [parent.email]


async def test_a_wrong_pin_still_answers_the_same_way(api, family, mailbox):
    """The alert is a side effect; it must not change what the endpoint reveals."""
    response = await api.post(
        "/auth/student/login",
        json={"family_code": FAMILY_CODE, "name": "Robin", "pin": "0000"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect family code, name, or PIN"


# ── inactivity nudges ────────────────────────────────────────────────────────

async def played_days_ago(student_id: str, days: int) -> LearningEvent:
    moment = datetime.now(timezone.utc) - timedelta(days=days)
    event = LearningEvent(
        student_id=student_id, event_type="attempt", outcome="correct", verified=True,
        occurred_at=moment.isoformat(),
        client_timestamp_ms=round(moment.timestamp() * 1000),
    )
    await event.insert()
    return event


async def test_a_quiet_learner_earns_their_parent_one_nudge(database, adult, mailbox):
    kid = Student(name="Quiet Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 10)

    sent = await jobs.run_inactivity_nudges(datetime.now(timezone.utc))

    assert sent == 1
    rows = await Notification.find(Notification.kind == "auto_inactivity").to_list()
    assert "Quiet Kid" in rows[0].title
    assert [message.to for message in mailbox.sent] == [adult.email]


async def test_one_nudge_per_gap_however_long_the_gap_runs(database, adult, mailbox):
    kid = Student(name="Quiet Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 10)
    now = datetime.now(timezone.utc)

    assert await jobs.run_inactivity_nudges(now) == 1
    assert await jobs.run_inactivity_nudges(now + timedelta(days=1)) == 0
    assert await jobs.run_inactivity_nudges(now + timedelta(days=30)) == 0
    assert len(mailbox.sent) == 1


async def test_coming_back_and_going_quiet_again_earns_a_fresh_nudge(database, adult, mailbox):
    kid = Student(name="Quiet Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 30)
    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 1

    await played_days_ago(str(kid.id), 8)  # they returned, then went quiet again
    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 1


async def test_a_learner_who_never_started_is_not_described_as_having_stopped(database, adult, mailbox):
    kid = Student(name="Never Played", guardian_parent_ids=[str(adult.id)])
    await kid.insert()

    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 0
    assert mailbox.sent == []


async def test_a_learner_who_played_yesterday_is_left_alone(database, adult, mailbox):
    kid = Student(name="Busy Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 1)

    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 0


async def test_the_check_in_opt_out_silences_its_email_but_not_the_bell(database, adult, mailbox):
    """Declining the email does not hide it from the dashboard: the bell is a pull
    channel that interrupts nobody, so there is nothing there to opt out of."""
    adult.email_inactivity_enabled = False
    await adult.save()
    kid = Student(name="Quiet Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 10)

    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 1
    assert mailbox.sent == []                                     # no email…
    inbox = await service.list_inbox("user", str(adult.id))
    assert inbox.unread_count == 1                                # …but still in the bell


# ── which kinds may bypass a parent's email preferences ──────────────────────

async def test_only_account_alerts_bypass_the_email_preferences(database):
    """The bypass list is a deliberate, reviewable set — not a default."""
    assert service.ACCOUNT_ALERT_KINDS == frozenset({"auto_pin_lockout"})
    assert service.email_opt_out_field("auto_pin_lockout") is None


async def test_an_unregistered_kind_fails_closed(database, adult, mailbox):
    """Forgetting to register a new email-capable kind must cost a missed email,
    never an unwanted one sent to a parent who opted out."""
    assert service.email_opt_out_field("auto_something_new") == service.DEFAULT_EMAIL_OPT_OUT

    adult.email_announcements_enabled = False
    await adult.save()
    await service.create_and_send(
        kind="auto_curriculum_completion",  # real kind, deliberately not in the opt-out map
        title="Unregistered", body="x",
        audience="user", target_user_id=str(adult.id), channels=["email"],
    )
    assert mailbox.sent == []


# ── the parent Notifications tab's own endpoint ──────────────────────────────

async def test_a_parent_can_read_and_change_their_own_preferences(api, adult):
    """Both toggles on the parent Notifications tab, over the real endpoint."""
    me = await api.get("/auth/me", headers=auth(str(adult.id), "parent"))
    assert me.json()["email_digest_enabled"] is True
    assert me.json()["email_announcements_enabled"] is True

    patched = await api.patch(
        "/family/me/notification-preferences",
        json={"email_digest_enabled": False},
        headers=auth(str(adult.id), "parent"),
    )
    assert patched.status_code == 200
    assert patched.json() == {
        "email_digest_enabled": False,
        "email_inactivity_enabled": True,
        "email_announcements_enabled": True,
    }

    # The dashboard re-reads the account after saving, so /auth/me must agree.
    me_again = await api.get("/auth/me", headers=auth(str(adult.id), "parent"))
    assert me_again.json()["email_digest_enabled"] is False


async def test_one_preference_at_a_time_leaves_the_other_alone(api, adult):
    """The tab sends a single field per toggle; the absent one must not reset."""
    await api.patch(
        "/family/me/notification-preferences",
        json={"email_announcements_enabled": False},
        headers=auth(str(adult.id), "parent"),
    )
    me = await api.get("/auth/me", headers=auth(str(adult.id), "parent"))
    assert me.json()["email_announcements_enabled"] is False
    assert me.json()["email_digest_enabled"] is True


async def test_a_student_token_cannot_touch_parent_preferences(api, learner):
    response = await api.patch(
        "/family/me/notification-preferences",
        json={"email_digest_enabled": False},
        headers=auth(str(learner.id), "student"),
    )
    assert response.status_code == 403


# ── one switch per feature ───────────────────────────────────────────────────

async def test_each_feature_has_its_own_switch(database):
    """A guardian declining one thing must not silently decline another."""
    fields = {
        kind: service.EMAIL_OPT_OUT_FIELD[kind]
        for kind in ("auto_digest", "auto_inactivity", "announcement")
    }
    assert fields == {
        "auto_digest": "email_digest_enabled",
        "auto_inactivity": "email_inactivity_enabled",
        "announcement": "email_announcements_enabled",
    }
    # The regression this guards: inactivity used to ride on the digest switch.
    assert fields["auto_inactivity"] != fields["auto_digest"]


async def test_declining_check_ins_still_leaves_the_weekly_summary(database, adult, mailbox):
    adult.email_inactivity_enabled = False
    await adult.save()
    kid = Student(name="Quiet Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 10)

    # The check-in is suppressed by email…
    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 1
    assert mailbox.sent == []

    # …but the weekly summary, a different feature, still arrives.
    assert await jobs.run_weekly_digests(A_SUNDAY) == 1
    assert [message.to for message in mailbox.sent] == [adult.email]


async def test_declining_the_weekly_summary_still_leaves_check_ins(database, adult, mailbox):
    adult.email_digest_enabled = False
    await adult.save()
    kid = Student(name="Quiet Kid", guardian_parent_ids=[str(adult.id)])
    await kid.insert()
    await played_days_ago(str(kid.id), 10)

    assert await jobs.run_weekly_digests(A_SUNDAY) == 0
    assert mailbox.sent == []

    assert await jobs.run_inactivity_nudges(datetime.now(timezone.utc)) == 1
    assert [message.to for message in mailbox.sent] == [adult.email]


async def test_every_switch_can_be_set_over_the_endpoint(api, adult):
    """The settings screen sends one field at a time; all three must round-trip."""
    for key in ("email_digest_enabled", "email_inactivity_enabled", "email_announcements_enabled"):
        response = await api.patch(
            "/family/me/notification-preferences",
            json={key: False},
            headers=auth(str(adult.id), "parent"),
        )
        assert response.status_code == 200, key
        assert response.json()[key] is False, key

    me = (await api.get("/auth/me", headers=auth(str(adult.id), "parent"))).json()
    assert me["email_digest_enabled"] is False
    assert me["email_inactivity_enabled"] is False
    assert me["email_announcements_enabled"] is False
