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

#: Per-process, not just per-run. Two pytest processes sharing one test database
#: destroy each other: every test drops the database on setup and teardown, so one
#: process's teardown deletes the other's fixtures mid-test and aborts its index
#: builds ("Index build failed ... caused by :: dropDatabase"). That surfaced as an
#: intermittent DuplicateKeyError in unrelated fixtures, which is a miserable thing
#: to debug. Including the pid makes concurrent runs — two terminals, a watcher, or
#: xdist later — independent by construction.
TEST_DB_PREFIX = f"{settings.mongo_db}_test_"
TEST_DB = f"{TEST_DB_PREFIX}{os.getpid()}"


def _process_is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # Someone else's process, but alive — leave its database alone.
    except OSError:
        return True  # Unclear: assume alive rather than delete a live run's data.
    return True


@pytest.fixture(scope="session", autouse=True)
def sweep_abandoned_test_databases():
    """Drop test databases whose owning process is gone.

    Naming per pid means a run killed mid-test (Ctrl-C, a timeout) leaves its
    database behind. Rather than let those accumulate, each session clears the ones
    whose pid no longer exists — never one belonging to a live process, or this
    would reintroduce exactly the cross-run interference the naming scheme fixes.
    """
    from pymongo import MongoClient

    try:
        client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=1500)
        for name in client.list_database_names():
            if not name.startswith(TEST_DB_PREFIX) or name == TEST_DB:
                continue
            suffix = name[len(TEST_DB_PREFIX):]
            if suffix.isdigit() and not _process_is_running(int(suffix)):
                client.drop_database(name)
        client.close()
    except Exception:
        # Mongo unreachable: the `database` fixture skips these tests anyway.
        pass


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
    assert TEST_DB.startswith(TEST_DB_PREFIX), "integration tests must use a _test_<pid> database"
    assert TEST_DB != settings.mongo_db, "integration tests must never use the working database"
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
