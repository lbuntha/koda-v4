"""Deleting a parent must not leave learner profiles orphaned in admin analytics."""

import pytest_asyncio

from app.core.security import hash_secret
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth


@pytest_asyncio.fixture
async def admin_and_family(database):
    admin = User(
        email="cascade-admin@example.com",
        name="Cascade Admin",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    parent = User(
        email="deleted-parent@example.com",
        name="Deleted Parent",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value,
        family_code="DEL123",
    )
    other_parent = User(
        email="remaining-parent@example.com",
        name="Remaining Parent",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value,
        family_code="REM123",
    )
    await admin.insert()
    await parent.insert()
    await other_parent.insert()

    sole_child = Student(name="Sole Child", guardian_parent_ids=[str(parent.id)])
    shared_child = Student(
        name="Shared Child",
        guardian_parent_ids=[str(parent.id), str(other_parent.id)],
    )
    await sole_child.insert()
    await shared_child.insert()
    return admin, parent, other_parent, sole_child, shared_child


async def test_deleting_parent_removes_or_unlinks_their_learners(api, admin_and_family):
    admin, parent, other_parent, sole_child, shared_child = admin_and_family

    response = await api.delete(
        f"/admin/users/{parent.id}",
        headers=auth(str(admin.id), Role.admin.value),
    )

    assert response.status_code == 204
    assert await User.get(parent.id) is None
    assert await Student.get(sole_child.id) is None

    remaining = await Student.get(shared_child.id)
    assert remaining is not None
    assert remaining.guardian_parent_ids == [str(other_parent.id)]
