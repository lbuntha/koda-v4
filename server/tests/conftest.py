"""A real app against a throwaway database.

No mocks: the things worth testing here are index constraints, query filters and
token rotation, and a fake Mongo would test none of them.
"""

import os
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("JWT_SECRET", "test-secret")

from app import db as database  # noqa: E402
from app.indexes import ensure_indexes  # noqa: E402
from app.main import create_app  # noqa: E402
from app.settings import settings  # noqa: E402


@pytest.fixture(autouse=True)
def email_verification_disabled_by_default(monkeypatch):
    """A developer's local opt-in must not change unrelated auth contracts."""
    monkeypatch.setattr(settings(), "require_email_verification", False)


@pytest_asyncio.fixture
async def db():
    name = f"koda_test_{uuid4().hex[:8]}"
    handle = database.connect(settings().mongodb_uri, name)
    await ensure_indexes(handle)
    yield handle
    await handle.client.drop_database(name)
    await database.close()


@pytest_asyncio.fixture
async def client(db):
    app = create_app()
    # The database is already connected by the fixture, so the app's own
    # lifespan is skipped — the test owns the handle.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/v1") as c:
        yield c


@pytest.fixture
def signup_body():
    def _make(email: str = "parent@example.com", password: str = "correct horse battery"):
        return {"email": email, "password": password, "familyName": "The Riveras"}

    return _make
