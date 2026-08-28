"""Guessing has a ceiling.

The numbers here are the point: a person who mistypes their password a few times
must not be locked out, and a script must not get thousands of tries.
"""

import pytest

from app.security.rate_limit import LOGIN_PER_ACCOUNT


async def attempt(client, password: str = "wrong-password"):
    return await client.post(
        "/auth/login", json={"email": "parent@example.com", "password": password}
    )


async def test_a_few_mistakes_are_fine(client, signup_body):
    await client.post("/auth/signup", json=signup_body())

    for _ in range(3):
        assert (await attempt(client)).status_code == 401

    ok = await attempt(client, "correct horse battery")
    assert ok.status_code == 200, "a person who mistyped and then got it right gets in"


async def test_grinding_is_stopped(client, signup_body):
    await client.post("/auth/signup", json=signup_body())

    statuses = [(await attempt(client)).status_code for _ in range(LOGIN_PER_ACCOUNT.attempts + 3)]

    assert 429 in statuses, "the budget runs out"
    assert statuses.index(429) <= LOGIN_PER_ACCOUNT.attempts + 1

    refused = await attempt(client, "correct horse battery")
    assert refused.status_code == 429, "and the right password does not bypass it"
    assert refused.json()["error"]["code"] == "too_many_attempts"


async def test_a_success_clears_the_budget(client, signup_body):
    await client.post("/auth/signup", json=signup_body())

    for _ in range(4):
        await attempt(client)
    assert (await attempt(client, "correct horse battery")).status_code == 200

    # Having signed in, the earlier misses no longer count against them.
    for _ in range(4):
        assert (await attempt(client)).status_code == 401


@pytest.mark.parametrize("route", ["/auth/signup"])
async def test_signup_is_limited_too(client, signup_body, route):
    codes = []
    for i in range(7):
        r = await client.post(route, json=signup_body(f"new{i}@example.com"))
        codes.append(r.status_code)
    assert 429 in codes, "a script cannot create accounts without limit"
