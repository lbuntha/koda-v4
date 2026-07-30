"""Password reset, over the real endpoints.

A parent who forgot their password had no way back into their children's accounts. These
cover the flow working, and the four properties that make it safe to expose publicly.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.core.mail import MemoryMailer, set_mailer
from app.core.security import create_refresh_token, hash_secret
from app.features.auth.reset import hash_token
from app.models.password_reset import PasswordResetToken
from app.models.user import Role, User

OLD = "old-password-here"
NEW = "brand-new-password"
EMAIL = "parent@example.com"


@pytest_asyncio.fixture
async def mailbox():
    mailer = MemoryMailer()
    set_mailer(mailer)
    yield mailer
    set_mailer(None)


@pytest_asyncio.fixture
async def parent(database):
    user = User(
        email=EMAIL, name="Robin's parent",
        password_hash=hash_secret(OLD), role=Role.parent.value,
    )
    await user.insert()
    return user


def token_from(mailbox: MemoryMailer) -> str:
    body = mailbox.sent[-1].body
    return body.split("token=")[1].split()[0]


async def request_reset(api, email: str = EMAIL):
    return await api.post("/auth/password-reset/request", json={"email": email})


# ── the flow ────────────────────────────────────────────────────────────────────

async def test_a_parent_can_reset_and_sign_in_with_the_new_password(api, parent, mailbox):
    assert (await request_reset(api)).status_code == 202
    assert len(mailbox.sent) == 1
    assert mailbox.sent[0].to == EMAIL

    confirmed = await api.post(
        "/auth/password-reset/confirm", json={"token": token_from(mailbox), "password": NEW},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["access_token"]

    assert (await api.post("/auth/login", data={"username": EMAIL, "password": NEW})).status_code == 200
    assert (await api.post("/auth/login", data={"username": EMAIL, "password": OLD})).status_code == 401


async def test_the_email_carries_a_working_link_and_no_password(api, parent, mailbox):
    await request_reset(api)
    body = mailbox.sent[0].body
    assert "/reset-password?token=" in body
    assert OLD not in body and NEW not in body


# ── it must not leak who has an account ─────────────────────────────────────────

async def test_an_unknown_address_gets_the_same_answer_and_no_email(api, parent, mailbox):
    known = await request_reset(api)
    unknown = await request_reset(api, "stranger@example.com")

    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()
    assert [message.to for message in mailbox.sent] == [EMAIL]


# ── a link is single-use and short-lived ────────────────────────────────────────

async def test_a_link_cannot_be_used_twice(api, parent, mailbox):
    await request_reset(api)
    token = token_from(mailbox)
    assert (await api.post("/auth/password-reset/confirm", json={"token": token, "password": NEW})).status_code == 200

    replay = await api.post(
        "/auth/password-reset/confirm", json={"token": token, "password": "third-password"},
    )
    assert replay.status_code == 400
    # …and the second password never took effect.
    assert (await api.post("/auth/login", data={"username": EMAIL, "password": NEW})).status_code == 200


async def test_an_expired_link_is_refused(api, parent, mailbox, database):
    await request_reset(api)
    row = await PasswordResetToken.find_one(PasswordResetToken.token_hash == hash_token(token_from(mailbox)))
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await row.save()

    response = await api.post(
        "/auth/password-reset/confirm", json={"token": token_from(mailbox), "password": NEW},
    )
    assert response.status_code == 400


async def test_requesting_again_invalidates_the_earlier_link(api, parent, mailbox):
    """An older link may be sitting in a shared or forwarded inbox."""
    await request_reset(api)
    first = token_from(mailbox)
    await request_reset(api)
    second = token_from(mailbox)
    assert first != second

    assert (await api.post("/auth/password-reset/confirm", json={"token": first, "password": NEW})).status_code == 400
    assert (await api.post("/auth/password-reset/confirm", json={"token": second, "password": NEW})).status_code == 200


@pytest.mark.parametrize("token", ["", "short", "x" * 64])
async def test_a_forged_token_is_refused(api, parent, token):
    response = await api.post(
        "/auth/password-reset/confirm", json={"token": token, "password": NEW},
    )
    assert response.status_code in (400, 422)


# ── resetting evicts other sessions ─────────────────────────────────────────────

async def test_a_refresh_token_issued_before_the_reset_stops_working(api, parent, mailbox):
    """Otherwise whoever else knew the old password keeps their session indefinitely."""
    stolen = create_refresh_token(str(parent.id), parent.role)
    assert (await api.post("/auth/refresh", json={"refresh_token": stolen})).status_code == 200

    await request_reset(api)
    await api.post("/auth/password-reset/confirm", json={"token": token_from(mailbox), "password": NEW})

    assert (await api.post("/auth/refresh", json={"refresh_token": stolen})).status_code == 401


async def test_a_disabled_account_can_neither_reset_nor_refresh(api, parent, mailbox):
    parent.disabled_at = datetime.now(timezone.utc)
    await parent.save()
    token = create_refresh_token(str(parent.id), parent.role)

    assert (await request_reset(api)).status_code == 202   # same answer as always…
    assert mailbox.sent == []                              # …but nothing is sent
    assert (await api.post("/auth/refresh", json={"refresh_token": token})).status_code == 401


async def test_a_short_password_is_refused(api, parent, mailbox):
    await request_reset(api)
    response = await api.post(
        "/auth/password-reset/confirm", json={"token": token_from(mailbox), "password": "short"},
    )
    assert response.status_code == 422
