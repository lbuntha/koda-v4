"""Password registrations prove mailbox ownership before receiving a session."""

import re
from datetime import UTC, datetime, timedelta

from app.repos import users
from app.security import passwords
from app.services import google_identity, mail
from app.settings import settings


def enable_verification(monkeypatch) -> None:
    monkeypatch.setattr(settings(), "require_email_verification", True)


def capture_mail(monkeypatch) -> list[str]:
    messages: list[str] = []

    async def send(_to: str, _subject: str, body: str) -> bool:
        messages.append(body)
        return True

    monkeypatch.setattr(mail, "send", send)
    return messages


def token_from(message: str) -> str:
    match = re.search(r"/verify-email\?token=([^\s]+)", message)
    assert match, message
    return match.group(1)


async def test_signup_waits_for_email_ownership_before_issuing_a_session(
    client, db, signup_body, monkeypatch
):
    enable_verification(monkeypatch)
    messages = capture_mail(monkeypatch)

    response = await client.post("/auth/signup", json=signup_body())

    assert response.status_code == 201, response.text
    assert response.json() == {
        "verificationRequired": True,
        "email": "parent@example.com",
        "emailSent": True,
    }
    assert len(messages) == 1
    stored = await users.by_email(db, "parent@example.com")
    assert stored["emailVerifiedAt"] is None
    assert stored["verificationTokenHash"]
    assert "accessToken" not in response.json()

    blocked = await client.post(
        "/auth/login",
        json={"email": "parent@example.com", "password": "correct horse battery"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "email_not_verified"


async def test_live_link_verifies_signs_in_and_can_only_be_used_once(
    client, db, signup_body, monkeypatch
):
    enable_verification(monkeypatch)
    messages = capture_mail(monkeypatch)
    await client.post("/auth/signup", json=signup_body())
    token = token_from(messages[0])

    verified = await client.post(
        "/auth/email/verify",
        json={"token": token, "installId": "i_verified_browser"},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["accessToken"]
    stored = await users.by_email(db, "parent@example.com")
    assert stored["emailVerifiedAt"] is not None
    assert "verificationTokenHash" not in stored

    replay = await client.post("/auth/email/verify", json={"token": token})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "verification_invalid"

    login = await client.post(
        "/auth/login",
        json={"email": "parent@example.com", "password": "correct horse battery"},
    )
    assert login.status_code == 200


async def test_expired_link_is_rejected_and_resend_replaces_it(
    client, db, signup_body, monkeypatch
):
    enable_verification(monkeypatch)
    messages = capture_mail(monkeypatch)
    await client.post("/auth/signup", json=signup_body())
    old_token = token_from(messages[0])

    await db.users.update_one(
        {"email": "parent@example.com"},
        {"$set": {"verificationExpiresAt": datetime.now(UTC) - timedelta(minutes=1)}},
    )
    expired = await client.post("/auth/email/verify", json={"token": old_token})
    assert expired.status_code == 401

    resent = await client.post(
        "/auth/email/resend", json={"email": "parent@example.com"}
    )
    assert resent.status_code == 204
    new_token = token_from(messages[-1])
    assert new_token != old_token
    assert (await client.post("/auth/email/verify", json={"token": new_token})).status_code == 200


async def test_resend_hides_unknown_addresses_and_legacy_accounts_still_work(
    client, db, monkeypatch
):
    enable_verification(monkeypatch)
    messages = capture_mail(monkeypatch)

    unknown = await client.post(
        "/auth/email/resend", json={"email": "nobody@example.com"}
    )
    assert unknown.status_code == 204
    assert messages == []

    legacy = await users.create(
        db,
        "legacy@example.com",
        passwords.hash_password("old-password"),
        platform_role="admin",
    )
    await db.users.update_one({"_id": legacy["_id"]}, {"$unset": {"emailVerifiedAt": ""}})
    logged_in = await client.post(
        "/auth/login", json={"email": "legacy@example.com", "password": "old-password"}
    )
    assert logged_in.status_code == 200, logged_in.text


async def test_verified_google_identity_also_finishes_a_pending_password_account(
    client, db, signup_body, monkeypatch
):
    enable_verification(monkeypatch)
    capture_mail(monkeypatch)
    await client.post("/auth/signup", json=signup_body(email="parent@gmail.com"))
    monkeypatch.setattr(settings(), "google_client_id", "koda-web.apps.googleusercontent.com")
    monkeypatch.setattr(
        google_identity,
        "verify",
        lambda _credential, _audience: {
            "sub": "google-pending-parent",
            "email": "parent@gmail.com",
            "email_verified": True,
            "name": "Pending Parent",
        },
    )

    google = await client.post(
        "/auth/google",
        json={"credential": "google-id-token-" * 10, "createAccount": False},
    )
    assert google.status_code == 200, google.text
    stored = await users.by_email(db, "parent@gmail.com")
    assert stored["googleSub"] == "google-pending-parent"
    assert stored["emailVerifiedAt"] is not None
    assert "verificationTokenHash" not in stored

    password = await client.post(
        "/auth/login",
        json={"email": "parent@gmail.com", "password": "correct horse battery"},
    )
    assert password.status_code == 200
