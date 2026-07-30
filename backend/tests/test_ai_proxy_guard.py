"""Who can spend money through the AI proxy, and how much.

This endpoint forwards to OpenAI with the server-held key, so every call bills a real account.
It was reachable by any authenticated token — including a child's, which lives on a family
tablet — with no cap on how many calls one account could make.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.core.security import hash_secret
from app.core.throttle import AI_GENERATION
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth

BODY = {"messages": [{"role": "user", "content": "Make a counting question."}]}


async def make_user(email: str, role: str) -> User:
    user = User(
        email=email, name=role, password_hash=hash_secret("correct-horse-battery"), role=role,
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def cast(database):
    return {
        "admin": await make_user("admin@example.com", Role.admin.value),
        "teacher": await make_user("teacher@example.com", Role.teacher.value),
        "parent": await make_user("parent@example.com", Role.parent.value),
    }


async def generate(api, headers):
    return await api.post("/ai/generate", json=BODY, headers=headers)


def role_of(user: User) -> str:
    """Beanie hands the role back as a plain string on a re-read, an enum on the instance."""
    return user.role.value if hasattr(user.role, "value") else str(user.role)


@pytest.mark.parametrize("role", ["parent"])
async def test_a_non_authoring_adult_is_refused(api, cast, role):
    response = await generate(api, auth(str(cast[role].id), role_of(cast[role])))
    assert response.status_code == 403


async def test_a_childs_token_cannot_spend_your_ai_budget(api, cast, database):
    """The one that matters most: a token sitting on a kid's tablet."""
    child = Student(name="Robin", guardian_parent_ids=[str(cast["parent"].id)])
    await child.insert()

    response = await generate(api, auth(str(child.id), Role.student.value))
    assert response.status_code == 403


async def test_an_anonymous_caller_is_refused(api, cast):
    assert (await api.post("/ai/generate", json=BODY)).status_code == 401


@pytest.mark.parametrize("role", ["admin", "teacher"])
async def test_an_author_gets_through_to_the_provider_check(api, cast, role):
    """No API key is configured in tests, so 503 proves it passed authorization."""
    response = await generate(api, auth(str(cast[role].id), role_of(cast[role])))
    assert response.status_code == 503


async def test_one_author_cannot_make_unlimited_calls(api, cast):
    """Without this, a single leaked authoring token can drain the account."""
    headers = auth(str(cast["admin"].id), role_of(cast["admin"]))
    for _ in range(AI_GENERATION.max_attempts):
        assert (await generate(api, headers)).status_code == 503

    throttled = await generate(api, headers)
    assert throttled.status_code == 429
    assert "Retry-After" in throttled.headers


async def test_the_quota_is_per_account(api, cast):
    """One author exhausting their quota must not lock the whole team out."""
    admin = auth(str(cast["admin"].id), role_of(cast["admin"]))
    for _ in range(AI_GENERATION.max_attempts):
        await generate(api, admin)
    assert (await generate(api, admin)).status_code == 429

    teacher = auth(str(cast["teacher"].id), role_of(cast["teacher"]))
    assert (await generate(api, teacher)).status_code == 503


async def test_heavy_ai_use_does_not_lock_the_address_out_of_signing_in(api, cast):
    """Regression: generations were metered against the same counter as login attempts, so an
    author working hard could stop everyone at that school or office from signing in."""
    headers = auth(str(cast["admin"].id), role_of(cast["admin"]))
    for _ in range(AI_GENERATION.max_attempts + 5):
        await generate(api, headers)

    signed_in = await api.post(
        "/auth/login",
        data={"username": "parent@example.com", "password": "correct-horse-battery"},
    )
    assert signed_in.status_code == 200
