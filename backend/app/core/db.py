"""MongoDB connection + Beanie ODM initialization."""

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from .config import settings
from ..models import ALL_MODELS

_client: AsyncIOMotorClient | None = None


async def init_db() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongo_uri)
    await init_beanie(database=_client[settings.mongo_db], document_models=ALL_MODELS)


async def close_db() -> None:
    if _client is not None:
        _client.close()
