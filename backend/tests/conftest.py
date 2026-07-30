"""Integration fixtures: the real app, over a real Mongo, on a throwaway database.

The rest of the suite is pure functions. That is fast and precise, but it cannot see the
layer where most defects actually live — routing, auth, serialization, and the field types
Beanie writes. Several bugs shipped through a fully green pure suite: a thumbnail URL with an
invented `/api` prefix, an assignment's `grade_id` never reaching the code that scopes on it,
and a `MasteryState` datetime written into a string field (which only failed on read-back).

These tests use the genuine FastAPI app and genuine Beanie models against `<db>_test`, which
is dropped before and after. They never touch the working database. If Mongo is not running
they skip, so `pytest` still passes on a machine with no services up.
"""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core.security import create_access_token, hash_secret
from app.main import app
from app.models import ALL_MODELS
from app.models.student import Student
from app.models.user import Role, User

TEST_DB = f"{settings.mongo_db}_test"


async def _mongo_available(client: AsyncIOMotorClient) -> bool:
    try:
        await client.admin.command("ping")
        return True
    except Exception:
        return False


@pytest_asyncio.fixture
async def database():
    """A clean, isolated database bound to the real Beanie models."""
    client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=1500)
    if not await _mongo_available(client):
        client.close()
        pytest.skip(f"MongoDB not reachable at {settings.mongo_uri}")
    # Guard against ever pointing these at the working database.
    assert TEST_DB.endswith("_test"), "integration tests must use a _test database"
    await client.drop_database(TEST_DB)
    await init_beanie(database=client[TEST_DB], document_models=ALL_MODELS)
    try:
        yield client[TEST_DB]
    finally:
        await client.drop_database(TEST_DB)
        client.close()


@pytest_asyncio.fixture
async def api(database):
    """An HTTP client over the real app, with the lifespan bypassed.

    `init_beanie` has already run against the test database; letting the app's own lifespan
    run would rebind the models to the working one.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def adult(database) -> User:
    user = User(
        email="teacher@example.com",
        name="Teacher",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value,
    )
    await user.insert()
    return user


@pytest_asyncio.fixture
async def learner(database, adult) -> Student:
    student = Student(name="Test Learner", guardian_parent_ids=[str(adult.id)])
    await student.insert()
    return student


def auth(subject_id: str, role: str) -> dict[str, str]:
    """Authorization header for a token the app itself would have issued."""
    return {"Authorization": f"Bearer {create_access_token(subject_id, role)}"}
