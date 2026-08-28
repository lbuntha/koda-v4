"""The Motor client, and nothing else.

Held in a module-level slot rather than passed around: there is one client per
process by design — it owns the connection pool — and repos take the database
handle as an argument so tests can point them at a throwaway database.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.settings import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def connect(uri: str | None = None, db_name: str | None = None) -> AsyncIOMotorDatabase:
    global _client, _db
    cfg = settings()
    _client = AsyncIOMotorClient(uri or cfg.mongodb_uri, tz_aware=True)
    _db = _client[db_name or cfg.mongodb_db]
    return _db


async def close() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client, _db = None, None


def db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not connected — connect() runs in the app lifespan.")
    return _db


async def ping() -> bool:
    await db().command("ping")
    return True
