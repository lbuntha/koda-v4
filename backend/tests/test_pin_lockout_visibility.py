"""A locked-out child, from the guardian's side.

The lockout itself is covered in test_auth_throttle_integration. What matters here is the part
that was missing: a child whose PIN locks simply cannot sign in, and until now no adult was
ever told why or given any way to help. A lock nobody can see is indistinguishable from a
broken app.
"""

from __future__ import annotations

import pytest_asyncio

from app.core.security import hash_secret
from app.core.throttle import STUDENT_PIN
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth

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
    child = Student(name="Robin", guardian_parent_ids=[str(parent.id)], pin_hash=hash_secret(PIN))
    await child.insert()
    return parent, child


async def lock_the_child_out(api):
    for _ in range(STUDENT_PIN.max_attempts):
        await api.post(
            "/auth/student/login", json={"family_code": FAMILY, "name": "Robin", "pin": "0000"},
        )


def child_row(payload: list[dict], name: str = "Robin") -> dict:
    return next(row for row in payload if row["name"] == name)


async def test_a_guardian_sees_nothing_when_nothing_is_wrong(api, family):
    parent, _ = family
    response = await api.get("/family/children", headers=auth(str(parent.id), Role.parent.value))
    assert response.status_code == 200
    assert child_row(response.json())["pin_locked_until"] is None


async def test_a_locked_child_shows_as_locked_to_their_guardian(api, family):
    parent, _ = family
    await lock_the_child_out(api)

    response = await api.get("/family/children", headers=auth(str(parent.id), Role.parent.value))
    assert child_row(response.json())["pin_locked_until"] is not None


async def test_a_guardian_can_clear_the_lock_and_the_child_signs_straight_back_in(api, family):
    parent, child = family
    await lock_the_child_out(api)
    assert (await api.post(
        "/auth/student/login", json={"family_code": FAMILY, "name": "Robin", "pin": PIN},
    )).status_code == 429  # the right PIN is refused while locked

    unlocked = await api.post(
        f"/family/children/{child.id}/unlock-pin",
        headers=auth(str(parent.id), Role.parent.value),
    )
    assert unlocked.status_code == 200
    assert unlocked.json()["pin_locked_until"] is None

    assert (await api.post(
        "/auth/student/login", json={"family_code": FAMILY, "name": "Robin", "pin": PIN},
    )).status_code == 200


async def test_unlocking_does_not_change_the_pin(api, family):
    """It clears a counter. If it reset the PIN it would be an account-takeover route."""
    parent, child = family
    await lock_the_child_out(api)
    await api.post(
        f"/family/children/{child.id}/unlock-pin",
        headers=auth(str(parent.id), Role.parent.value),
    )
    assert (await api.post(
        "/auth/student/login", json={"family_code": FAMILY, "name": "Robin", "pin": "0000"},
    )).status_code == 401


async def test_a_stranger_cannot_unlock_someone_elses_child(api, family, database):
    _, child = family
    outsider = User(
        email="stranger@example.com", name="Stranger",
        password_hash=hash_secret(PASSWORD), role=Role.parent.value, family_code="ZZZ999",
    )
    await outsider.insert()

    response = await api.post(
        f"/family/children/{child.id}/unlock-pin",
        headers=auth(str(outsider.id), Role.parent.value),
    )
    assert response.status_code == 404
