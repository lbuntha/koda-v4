"""Every index in one list.

Mongo needs index management, not schema migration, so this file *is* the
migration story: it is applied on startup and by `python -m app.cli migrate`.
Creating an index that already exists is a no-op, which is what makes that safe.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo.errors import OperationFailure

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        # Looking a reset token up by its hash. Sparse: almost no user has one
        # outstanding at any moment, and an index over mostly-absent fields
        # should not carry a row for every account.
        IndexModel([("resetTokenHash", ASCENDING)], name="by_reset_token", sparse=True),
        IndexModel(
            [("verificationTokenHash", ASCENDING)],
            name="by_verification_token",
            sparse=True,
        ),
        IndexModel([("email", ASCENDING)], unique=True, name="email_unique"),
        # Google's `sub`, not an email address, is the durable provider identity.
        # Partial so password-only users carrying null do not collide.
        IndexModel(
            [("googleSub", ASCENDING)],
            unique=True,
            name="google_sub_unique",
            partialFilterExpression={"googleSub": {"$type": "string"}},
        ),
    ],
    "platform_roles": [
        IndexModel([("roleId", ASCENDING)], unique=True, name="platform_role_unique"),
    ],
    "families": [
        IndexModel([("ownerId", ASCENDING)], name="by_owner"),
    ],
    "memberships": [
        IndexModel(
            [("userId", ASCENDING), ("familyId", ASCENDING)],
            unique=True,
            name="user_family_unique",
        ),
        IndexModel([("familyId", ASCENDING)], name="by_family"),
    ],
    "learners": [
        IndexModel([("familyId", ASCENDING)], name="by_family"),
    ],
    "invites": [
        # Redeeming looks a code up by its hash; the code itself is never stored.
        IndexModel([("codeHash", ASCENDING)], unique=True, name="invite_code_unique"),
        IndexModel([("familyId", ASCENDING)], name="by_family"),
    ],
    "devices": [
        # The refresh token is looked up by its hash — the token itself is never
        # stored, so a database leak cannot be replayed as a session.
        #
        # Partial, not sparse: `sparse` only skips documents where the field is
        # *missing*, so two revoked devices both holding `null` collide on a
        # unique index. Restricting the index to actual strings is what makes
        # "revoke every session" possible at all.
        IndexModel(
            [("refreshHash", ASCENDING)],
            unique=True,
            name="refresh_unique",
            partialFilterExpression={"refreshHash": {"$type": "string"}},
        ),
        # Compound, because the device list is always read in one order —
        # most recently used first — and paging an unindexed sort makes the
        # server sort the whole family for every page.
        IndexModel(
            [("familyId", ASCENDING), ("lastSeenAt", DESCENDING)],
            name="by_family",
        ),
        # Finding the row an install already owns, so signing in again rotates
        # it rather than writing another "This device".
        IndexModel([("installId", ASCENDING), ("revokedAt", ASCENDING)], name="by_install"),
    ],
    "events": [
        # The whole idempotency story: a replayed batch inserts nothing twice.
        IndexModel(
            [("familyId", ASCENDING), ("eventId", ASCENDING)],
            unique=True,
            name="event_unique",
        ),
        IndexModel(
            [("familyId", ASCENDING), ("learnerId", ASCENDING), ("serverSeq", ASCENDING)],
            name="by_learner_seq",
        ),
        # Raw detail ages out; the rollup does not. 400 days keeps "a year of
        # practice still counts" true without an unbounded collection.
        IndexModel([("receivedAt", ASCENDING)], expireAfterSeconds=400 * 24 * 3600,
                   name="ttl_400d"),
    ],
    "docs": [
        IndexModel(
            [("familyId", ASCENDING), ("kind", ASCENDING), ("key", ASCENDING)],
            unique=True,
            name="doc_unique",
        ),
        # Pulls read strictly by cursor, so this is the only access path that
        # has to be fast as a family accumulates settings.
        IndexModel([("familyId", ASCENDING), ("serverSeq", ASCENDING)], name="by_seq"),
    ],
    "rate_limits": [
        # Counters clean themselves up; a limiter nobody prunes becomes a table
        # of every IP that ever signed in.
        IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0, name="ttl"),
    ],
    "menu_items": [
        # One row per (family, item). `familyId: null` is the shipped default.
        IndexModel(
            [("familyId", ASCENDING), ("itemId", ASCENDING)],
            unique=True,
            name="menu_item_unique",
        ),
    ],
    "art_assets": [
        IndexModel([("id", ASCENDING)], unique=True, name="art_id_unique"),
        IndexModel([("category", ASCENDING), ("id", ASCENDING)], name="art_by_category"),
    ],
    "skill_registry": [
        IndexModel([("id", ASCENDING)], unique=True, name="skill_id_unique"),
        IndexModel([("status", ASCENDING), ("id", ASCENDING)], name="skills_by_status"),
    ],
    "skill_registrations": [
        IndexModel(
            [("ownerType", ASCENDING), ("ownerId", ASCENDING), ("skillId", ASCENDING)],
            unique=True,
            name="owner_skill_unique",
        ),
        IndexModel(
            [("ownerType", ASCENDING), ("ownerId", ASCENDING), ("registeredAt", ASCENDING)],
            name="owner_registration_order",
        ),
    ],
    "system_settings": [
        # Global: there is no family in the key, which is the whole point.
        IndexModel([("settingId", ASCENDING)], unique=True, name="system_setting_unique"),
    ],
    "concept_totals": [
        IndexModel(
            [("familyId", ASCENDING), ("learnerId", ASCENDING), ("conceptKey", ASCENDING)],
            unique=True,
            name="learner_concept_unique",
        ),
    ],
}


async def ensure_indexes(database: AsyncIOMotorDatabase) -> dict[str, list[str]]:
    """Apply the list, replacing any index whose options have since changed.

    Mongo refuses to redefine an existing index with different options, which
    would otherwise mean a fix like `sparse` → `partialFilterExpression` never
    reaches a database that already ran the old version.
    """
    created: dict[str, list[str]] = {}
    for collection, models in INDEXES.items():
        if not models:
            continue
        try:
            created[collection] = await database[collection].create_indexes(models)
        except OperationFailure as exc:
            # 85 IndexOptionsConflict · 86 IndexKeySpecsConflict
            if exc.code not in (85, 86):
                raise
            for model in models:
                name = model.document["name"]
                await database[collection].drop_index(name)
            created[collection] = await database[collection].create_indexes(models)
    return created
