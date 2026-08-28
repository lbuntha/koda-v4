"""Forgetting a password, and getting back in.

The two rules that matter more than the mechanics: the endpoint never says
whether an address has an account, and a spent link is spent.
"""

import pytest

from app.repos import users as users_repo
from app.security import tokens


@pytest.fixture
async def account(client, signup_body):
    await client.post("/auth/signup", json=signup_body())
    return "parent@example.com"


async def _token_for(db, email: str) -> str:
    """Read the token the way only a test can — by minting a known one.

    The real one goes out by mail and is never stored in the clear, which is the
    point; a test that could read it back would be testing a weaker system.
    """
    user = await users_repo.by_email(db, email)
    raw, hashed = tokens.new_refresh_token()
    from datetime import timedelta

    from app.models.common import now

    await users_repo.set_reset_token(db, user["_id"], hashed, now() + timedelta(minutes=30))
    return raw


async def test_asking_says_nothing_about_whether_the_address_exists(client, account):
    known = await client.post("/auth/password/forgot", json={"email": account})
    unknown = await client.post("/auth/password/forgot", json={"email": "nobody@example.com"})

    assert known.status_code == 204
    assert unknown.status_code == 204, "a different answer here enumerates every family"


async def test_asking_stores_a_token_that_was_not_there_before(client, db, account):
    before = await users_repo.by_email(db, account)
    assert before.get("resetTokenHash") is None

    await client.post("/auth/password/forgot", json={"email": account})

    after = await users_repo.by_email(db, account)
    assert after["resetTokenHash"], "nothing was issued"
    assert after["resetExpiresAt"]


async def test_a_reset_sets_the_new_password_and_retires_the_old(client, db, account):
    token = await _token_for(db, account)

    r = await client.post(
        "/auth/password/reset", json={"token": token, "newPassword": "a whole new thing"}
    )
    assert r.status_code == 204, r.text

    assert (
        await client.post(
            "/auth/login", json={"email": account, "password": "a whole new thing"}
        )
    ).status_code == 200
    assert (
        await client.post(
            "/auth/login", json={"email": account, "password": "correct horse battery"}
        )
    ).status_code == 401


async def test_a_link_works_once(client, db, account):
    token = await _token_for(db, account)
    await client.post("/auth/password/reset", json={"token": token, "newPassword": "first go"})

    again = await client.post(
        "/auth/password/reset", json={"token": token, "newPassword": "second go"}
    )
    assert again.status_code == 401
    assert again.json()["error"]["code"] == "reset_invalid"


async def test_an_expired_link_is_refused(client, db, account):
    from datetime import timedelta

    from app.models.common import now

    user = await users_repo.by_email(db, account)
    raw, hashed = tokens.new_refresh_token()
    await users_repo.set_reset_token(db, user["_id"], hashed, now() - timedelta(minutes=1))

    r = await client.post("/auth/password/reset", json={"token": raw, "newPassword": "nope"})
    assert r.status_code == 401


async def test_a_made_up_token_is_refused(client, account):
    r = await client.post(
        "/auth/password/reset", json={"token": "not-a-real-token-at-all", "newPassword": "nope"}
    )
    assert r.status_code == 401


async def test_a_reset_ends_every_session_including_the_one_asking(client, db, account):
    """A reset is what you do when somebody else may be in the account."""
    live = (
        await client.post(
            "/auth/login", json={"email": account, "password": "correct horse battery"}
        )
    ).json()

    token = await _token_for(db, account)
    await client.post("/auth/password/reset", json={"token": token, "newPassword": "a new thing"})

    assert (
        await client.post("/auth/refresh", json={"refreshToken": live["refreshToken"]})
    ).status_code == 401


async def test_asking_over_and_over_is_budgeted(client, account):
    """Each request sends mail, so an open endpoint is a way to post at somebody."""
    codes = [
        (await client.post("/auth/password/forgot", json={"email": account})).status_code
        for _ in range(8)
    ]
    assert 429 in codes
