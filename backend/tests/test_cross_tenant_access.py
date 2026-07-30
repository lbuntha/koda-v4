"""Can one family reach another family's data?

`test_permissions.py` proves the *predicate* (`can_read_student`) is correct. It cannot prove
that every route actually calls it — and a route that forgets is exactly how a child's records
leak. This sweeps the real endpoints with a real stranger's token.

Every route that takes a student id, a curriculum id, or an owner-scoped document is listed
here on purpose: adding a route without adding it here should feel like an omission.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.core.security import hash_secret
from app.models.content import Curriculum, QuestionDeck
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth

PASSWORD = "correct-horse-battery"

#: 2xx here means one family read or wrote another family's data.
DENIED = {401, 403, 404}


async def make_parent(email: str, family_code: str) -> User:
    user = User(
        email=email, name=email.split("@")[0], password_hash=hash_secret(PASSWORD),
        role=Role.parent.value, family_code=family_code,
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def two_families(database):
    """Two unrelated parents, each with one child. Neither is an admin."""
    owner = await make_parent("owner@example.com", "OWN111")
    stranger = await make_parent("stranger@example.com", "STR222")
    child = Student(
        name="Robin", guardian_parent_ids=[str(owner.id)], pin_hash=hash_secret("4821"),
    )
    await child.insert()
    return owner, stranger, child


def as_(user: User) -> dict[str, str]:
    return auth(str(user.id), Role.parent.value)


# ── reading another family's child ──────────────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/progress/{sid}",
    "/progress/{sid}/activity-signal",
    "/progress/{sid}/some-skill",
    "/analytics/data-export/{sid}",
    "/students/{sid}/placements",
    "/students/{sid}/recommendations/preview",
])
async def test_a_stranger_cannot_read_another_familys_child(api, two_families, path):
    _, stranger, child = two_families
    response = await api.get(path.format(sid=child.id), headers=as_(stranger))
    assert response.status_code in DENIED, f"{path} leaked: {response.status_code}"


@pytest.mark.parametrize("path", ["/progress/{sid}", "/analytics/data-export/{sid}"])
async def test_the_real_guardian_is_still_allowed(api, two_families, path):
    """The sweep would pass trivially if everything 403'd. It must not."""
    owner, _, child = two_families
    response = await api.get(path.format(sid=child.id), headers=as_(owner))
    assert response.status_code == 200


# ── writing to another family's child ───────────────────────────────────────────

async def test_a_stranger_cannot_edit_another_familys_child(api, two_families):
    _, stranger, child = two_families
    response = await api.patch(
        f"/family/children/{child.id}", json={"name": "Renamed"}, headers=as_(stranger),
    )
    assert response.status_code in DENIED
    assert (await Student.get(child.id)).name == "Robin"


async def test_a_stranger_cannot_delete_another_familys_child(api, two_families):
    _, stranger, child = two_families
    response = await api.delete(f"/family/children/{child.id}", headers=as_(stranger))
    assert response.status_code in DENIED
    assert await Student.get(child.id) is not None


async def test_a_stranger_cannot_purge_another_familys_learning_data(api, two_families):
    """Sent with a *valid* body — a 422 would prove nothing about authorization."""
    _, stranger, child = two_families
    response = await api.request(
        "DELETE", f"/analytics/data/{child.id}",
        json={"confirmation": "DELETE", "reason": "test"}, headers=as_(stranger),
    )
    assert response.status_code in DENIED


async def test_a_stranger_cannot_unlock_another_familys_child(api, two_families):
    _, stranger, child = two_families
    response = await api.post(
        f"/family/children/{child.id}/unlock-pin", headers=as_(stranger),
    )
    assert response.status_code in DENIED


async def test_a_stranger_cannot_launch_a_session_as_another_familys_child(api, two_families):
    """The worst case: a token that *is* someone else's child."""
    _, stranger, child = two_families
    response = await api.post(
        "/auth/student/launch", json={"student_id": str(child.id)}, headers=as_(stranger),
    )
    assert response.status_code in DENIED
    assert "access_token" not in response.json()


async def test_a_stranger_cannot_list_another_familys_children(api, two_families):
    _, stranger, child = two_families
    response = await api.get("/family/children", headers=as_(stranger))
    assert response.status_code == 200
    assert all(row["id"] != str(child.id) for row in response.json())


# ── owner-scoped authored content ───────────────────────────────────────────────

@pytest_asyncio.fixture
async def owned_curriculum(two_families) -> Curriculum:
    owner, _, _ = two_families
    doc = Curriculum(
        owner_id=str(owner.id), curriculum_id="c-owned", revision=1,
        tree={"title": "Owner's curriculum", "skills": []},
    )
    await doc.insert()
    return doc


async def test_a_stranger_cannot_read_another_authors_curriculum(api, two_families, owned_curriculum):
    _, stranger, _ = two_families
    response = await api.get(f"/curricula/{owned_curriculum.curriculum_id}", headers=as_(stranger))
    assert response.status_code in DENIED


async def test_a_stranger_cannot_overwrite_another_authors_curriculum(api, two_families, owned_curriculum):
    _, stranger, _ = two_families
    response = await api.put(
        f"/curricula/{owned_curriculum.curriculum_id}",
        json={
            "tree": {
                "title": "Hijacked",
                "grades": [], "subjects": [], "units": [], "skills": [],
            },
            "revision": 1,
        },
        headers=as_(stranger),
    )
    assert response.status_code in DENIED
    assert (await Curriculum.get(owned_curriculum.id)).tree["title"] == "Owner's curriculum"


async def test_question_decks_are_per_owner(api, two_families):
    """A shared deck would let one author read and overwrite another's questions."""
    owner, stranger, _ = two_families
    await QuestionDeck(
        owner_id=str(owner.id), revision=1,
        questions=[{"id": "q1", "title": "Owner's question", "technique": "count_on"}],
    ).insert()

    response = await api.get("/questions", headers=as_(stranger))
    assert response.status_code == 200
    titles = [q.get("title") for q in response.json().get("questions", [])]
    assert "Owner's question" not in titles


# ── privilege escalation ────────────────────────────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("get", "/admin/users"),
    ("get", "/admin/students"),
    ("get", "/settings/rescore-jobs"),
])
async def test_a_parent_cannot_reach_admin_surfaces(api, two_families, method, path):
    _, stranger, _ = two_families
    response = await getattr(api, method)(path, headers=as_(stranger))
    assert response.status_code in DENIED, f"{path} exposed to a parent: {response.status_code}"


async def test_analytics_summary_is_scoped_to_your_own_child(api, two_families):
    """Not admin-only — a parent may read it, but only for their own child."""
    owner, stranger, child = two_families
    assert (await api.get(f"/analytics/summary?student_id={child.id}", headers=as_(owner))).status_code == 200
    denied = await api.get(f"/analytics/summary?student_id={child.id}", headers=as_(stranger))
    assert denied.status_code in DENIED


async def test_the_content_audit_shows_only_your_own_rows(api, two_families, owned_curriculum):
    """Readable by any author by design; the scoping is what keeps it safe."""
    owner, stranger, _ = two_families
    await api.put(
        f"/curricula/{owned_curriculum.curriculum_id}",
        json={"tree": {"title": "Owner edit", "grades": [], "subjects": [], "units": [], "skills": []}, "revision": 1},
        headers=as_(owner),
    )
    response = await api.get("/content-audit", headers=as_(stranger))
    assert response.status_code == 200
    rows = response.json()
    rows = rows.get("events", rows) if isinstance(rows, dict) else rows
    assert all(row.get("ownerId", row.get("owner_id")) != str(owner.id) for row in rows)


async def test_a_parent_cannot_grant_themselves_admin(api, two_families):
    _, stranger, _ = two_families
    response = await api.patch(
        f"/admin/users/{stranger.id}", json={"role": "admin"}, headers=as_(stranger),
    )
    assert response.status_code in DENIED
    refreshed = await User.get(stranger.id)
    assert (refreshed.role.value if hasattr(refreshed.role, "value") else refreshed.role) == Role.parent.value


async def test_a_student_token_cannot_reach_adult_surfaces(api, two_families):
    """A child's device is the least trusted place a token lives."""
    _, _, child = two_families
    headers = auth(str(child.id), Role.student.value)
    for path in ("/family/children", "/admin/users", "/questions", "/curricula"):
        response = await api.get(path, headers=headers)
        assert response.status_code in DENIED, f"{path} exposed to a student: {response.status_code}"
