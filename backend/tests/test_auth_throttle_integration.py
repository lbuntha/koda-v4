"""Login throttling over the real endpoints.

The policy is unit-tested; this proves it is actually wired in, that a success clears the
record, and — the part a pure test cannot see — that failures do not leak which accounts and
children exist.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.core.security import hash_secret
from app.core.throttle import ADULT_LOGIN, STUDENT_PIN
from app.models.student import Student
from app.models.throttle import LoginThrottle
from app.models.user import Role, User

PASSWORD = "correct-horse-battery"
FAMILY = "ABC123"
PIN = "4821"


@pytest_asyncio.fixture
async def family(database):
    parent = User(
        email="guardian@example.com", name="Guardian",
        password_hash=hash_secret(PASSWORD), role=Role.parent.value, family_code=FAMILY,
    )
    await parent.insert()
    child = Student(
        name="Robin", guardian_parent_ids=[str(parent.id)], pin_hash=hash_secret(PIN),
    )
    await child.insert()
    return parent, child


async def login(api, email: str, password: str):
    return await api.post("/auth/login", data={"username": email, "password": password})


async def pin_login(api, name: str = "Robin", pin: str = PIN, code: str = FAMILY):
    return await api.post(
        "/auth/student/login", json={"family_code": code, "name": name, "pin": pin},
    )


# ── adult login ─────────────────────────────────────────────────────────────────

async def test_a_correct_password_still_works(api, family):
    assert (await login(api, "guardian@example.com", PASSWORD)).status_code == 200


async def test_repeated_failures_eventually_stop_being_answered(api, family):
    for _ in range(ADULT_LOGIN.max_attempts):
        assert (await login(api, "guardian@example.com", "wrong")).status_code == 401

    blocked = await login(api, "guardian@example.com", "wrong")
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) > 0

    # And the lock holds even once the caller finally supplies the right password.
    assert (await login(api, "guardian@example.com", PASSWORD)).status_code == 429


async def test_signing_in_successfully_clears_the_record(api, family, database):
    for _ in range(ADULT_LOGIN.max_attempts - 1):
        await login(api, "guardian@example.com", "wrong")
    assert (await login(api, "guardian@example.com", PASSWORD)).status_code == 200

    assert await LoginThrottle.find_one(LoginThrottle.key == "adult:guardian@example.com") is None
    # A fresh budget, so an honest user who finally remembers is not left one typo from a lock.
    for _ in range(ADULT_LOGIN.max_attempts - 1):
        assert (await login(api, "guardian@example.com", "wrong")).status_code == 401


async def test_one_account_being_locked_does_not_lock_another(api, family, database):
    other = User(
        email="second@example.com", name="Second",
        password_hash=hash_secret(PASSWORD), role=Role.parent.value,
    )
    await other.insert()
    for _ in range(ADULT_LOGIN.max_attempts):
        await login(api, "guardian@example.com", "wrong")

    assert (await login(api, "guardian@example.com", "wrong")).status_code == 429
    assert (await login(api, "second@example.com", PASSWORD)).status_code == 200


async def test_an_unknown_address_is_indistinguishable_from_a_wrong_password(api, family):
    unknown = await login(api, "nobody@example.com", "whatever")
    wrong = await login(api, "guardian@example.com", "whatever")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


# ── student PIN ─────────────────────────────────────────────────────────────────

async def test_a_correct_pin_still_works(api, family):
    assert (await pin_login(api)).status_code == 200


async def test_a_pin_gets_fewer_tries_than_a_password(api, family):
    for _ in range(STUDENT_PIN.max_attempts):
        assert (await pin_login(api, pin="0000")).status_code == 401
    assert (await pin_login(api, pin="0000")).status_code == 429
    # Even the right PIN waits out the lock.
    assert (await pin_login(api)).status_code == 429


async def test_locking_one_child_does_not_lock_a_sibling(api, family, database):
    parent, _ = family
    sibling = Student(
        name="Sam", guardian_parent_ids=[str(parent.id)], pin_hash=hash_secret("1111"),
    )
    await sibling.insert()

    for _ in range(STUDENT_PIN.max_attempts):
        await pin_login(api, name="Robin", pin="0000")

    assert (await pin_login(api, name="Robin")).status_code == 429
    assert (await pin_login(api, name="Sam", pin="1111")).status_code == 200


@pytest.mark.parametrize(
    "name,pin,code",
    [("Robin", "0000", FAMILY), ("Nobody", PIN, FAMILY), ("Robin", PIN, "ZZZZZZ")],
)
async def test_every_kind_of_failure_says_the_same_thing(api, family, name, pin, code):
    """A distinct message for an unknown family code would enumerate households."""
    response = await pin_login(api, name=name, pin=pin, code=code)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect family code, name, or PIN"
