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

    # Multi-subject assignments may legitimately point at the same release and
    # scope. Install the narrower constraint before removing only the exact
    # legacy index, so startup never leaves this collection unconstrained.
    assignments = database["assignments"]
    await assignments.create_index(
        [("student_id", 1), ("release_id", 1), ("subject_id", 1), ("scope", 1)],
        unique=True,
        partialFilterExpression={"status": "active"},
        name="student_release_subject_scope_active_unique",
    )
    for name, definition in (await assignments.index_information()).items():
        if name == "student_release_subject_scope_active_unique":
            continue
        if definition.get("unique") and definition.get("key", []) == [
            ("student_id", 1),
            ("release_id", 1),
            ("scope", 1),
        ]:
            await assignments.drop_index(name)

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
    await system_settings.update_many(
        {"scoring.notifications": {"$exists": False}},
        {"$set": {"scoring.notifications": default_scoring_config()["notifications"]}},
    )
    # A user predating the notification preference fields has neither — and a Mongo query for
    # `email_digest_enabled: true` does not match a document where the field is simply absent,
    # so every existing account would silently never receive a digest or announcement email
    # despite the model default being `True`. Backfill so the query and the model agree.
    users = database["users"]
    await users.update_many(
        {"email_digest_enabled": {"$exists": False}},
        {"$set": {"email_digest_enabled": True}},
    )
    await users.update_many(
        {"email_announcements_enabled": {"$exists": False}},
        {"$set": {"email_announcements_enabled": True}},
    )
    await users.update_many(
        {"email_inactivity_enabled": {"$exists": False}},
        {"$set": {"email_inactivity_enabled": True}},
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
