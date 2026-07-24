"""MongoDB connection + Beanie ODM initialization."""

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from .config import settings
from .scoring_config import default_scoring_config
from ..models import ALL_MODELS

_client: AsyncIOMotorClient | None = None


async def init_db() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongo_uri)
    database = _client[settings.mongo_db]

    # One curriculum per owner was the original storage model. Remove only
    # that legacy unique index and assign stable ids before Beanie reconciles
    # the new multi-curriculum indexes. Existing documents remain untouched.
    curriculum = database["curriculum"]
    for name, definition in (await curriculum.index_information()).items():
        keys = definition.get("key", [])
        if definition.get("unique") and keys == [("owner_id", 1)]:
            await curriculum.drop_index(name)
    await curriculum.update_many(
        {"curriculum_id": {"$exists": False}},
        [{"$set": {"curriculum_id": {"$toString": "$_id"}}}],
    )
    system_settings = database["system_settings"]
    await system_settings.update_many(
        {"scoring": {"$exists": False}},
        {"$set": {"scoring": default_scoring_config(), "scoring_revision": 1}},
    )
    await system_settings.update_many(
        {"scoring_revision": {"$exists": False}},
        {"$set": {"scoring_revision": 1}},
    )
    await system_settings.update_many(
        {"scoring.recommendation": {"$exists": False}},
        {"$set": {"scoring.recommendation": default_scoring_config()["recommendation"]}},
    )
    audit_events = database["content_audit_events"]
    for legacy in await curriculum.find({}, {"owner_id": 1, "curriculum_id": 1}).to_list(length=None):
        await audit_events.update_many(
            {
                "owner_id": legacy.get("owner_id"),
                "resource_type": "curriculum",
                "curriculum_id": {"$exists": False},
            },
            {"$set": {"curriculum_id": legacy.get("curriculum_id")}},
        )

    await init_beanie(database=database, document_models=ALL_MODELS)


async def close_db() -> None:
    if _client is not None:
        _client.close()
