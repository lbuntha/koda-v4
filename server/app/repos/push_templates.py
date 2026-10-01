"""The words a notification uses, when an operator has changed them.

Overrides only. `push_defaults.py` holds what every kind says out of the box,
and a row exists here solely because somebody edited one — which makes "reset
to default" a delete rather than a second copy of the shipped wording, and
means a release that improves the default copy reaches every deployment that
never touched it.

The same split the switchboard makes, for the same reason: the code says what a
thing *is*, the database holds the decisions somebody made about it.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

BASE_LANGUAGE = "en"


def with_language(row_id: str, language: str = BASE_LANGUAGE) -> str:
    """The row for one language's edit.

    English keeps the ids it always had, so every existing edit is still the
    English one; another language's edit sits beside it as `<id>@<code>` — its
    own row, so resetting Khmer is deleting the Khmer row and nothing else.
    """
    return row_id if language == BASE_LANGUAGE else f"{row_id}@{language}"


async def overrides(db: AsyncIOMotorDatabase) -> dict[str, dict[str, Any]]:
    rows = await db.push_templates.find({}).to_list(length=100)
    return {row["_id"]: row for row in rows}


async def get(db: AsyncIOMotorDatabase, kind: str, language: str = BASE_LANGUAGE) -> dict[str, Any] | None:
    return await db.push_templates.find_one({"_id": with_language(kind, language)})


async def set_wording(
    db: AsyncIOMotorDatabase,
    kind: str,
    *,
    title: str,
    body: str,
    updated_by: str | None,
    language: str = BASE_LANGUAGE,
) -> None:
    await db.push_templates.update_one(
        {"_id": with_language(kind, language)},
        {"$set": {"title": title, "body": body, "updatedAt": now(), "updatedBy": updated_by}},
        upsert=True,
    )


async def reset(db: AsyncIOMotorDatabase, kind: str, language: str = BASE_LANGUAGE) -> bool:
    """Back to what the code ships. Deleting the row *is* the reset."""
    result = await db.push_templates.delete_one({"_id": with_language(kind, language)})
    return result.deleted_count > 0


# --- email wording -----------------------------------------------------------
#
# The same collection and the same override-only rule, under prefixed ids: a
# kind id never starts with `email:`, so the push row and the email row for one
# kind cannot collide, and a reset is still a delete.

EMAIL_PREFIX = "email:"
FRAME_ID = "email:frame"


async def get_email(db: AsyncIOMotorDatabase, kind: str, language: str = BASE_LANGUAGE) -> dict[str, Any] | None:
    return await db.push_templates.find_one({"_id": with_language(EMAIL_PREFIX + kind, language)})


async def set_email(
    db: AsyncIOMotorDatabase,
    kind: str,
    *,
    subject: str,
    body: str,
    updated_by: str | None,
    language: str = BASE_LANGUAGE,
) -> None:
    await db.push_templates.update_one(
        {"_id": with_language(EMAIL_PREFIX + kind, language)},
        {"$set": {"subject": subject, "body": body, "updatedAt": now(), "updatedBy": updated_by}},
        upsert=True,
    )


async def reset_email(db: AsyncIOMotorDatabase, kind: str, language: str = BASE_LANGUAGE) -> bool:
    result = await db.push_templates.delete_one({"_id": with_language(EMAIL_PREFIX + kind, language)})
    return result.deleted_count > 0


async def get_frame(db: AsyncIOMotorDatabase, language: str = BASE_LANGUAGE) -> dict[str, Any] | None:
    return await db.push_templates.find_one({"_id": with_language(FRAME_ID, language)})


async def set_frame(
    db: AsyncIOMotorDatabase,
    *,
    body: str,
    footer: str,
    account_footer: str,
    updated_by: str | None,
    language: str = BASE_LANGUAGE,
) -> None:
    await db.push_templates.update_one(
        {"_id": with_language(FRAME_ID, language)},
        {
            "$set": {
                "body": body,
                "footer": footer,
                "accountFooter": account_footer,
                "updatedAt": now(),
                "updatedBy": updated_by,
            }
        },
        upsert=True,
    )


async def reset_frame(db: AsyncIOMotorDatabase, language: str = BASE_LANGUAGE) -> bool:
    result = await db.push_templates.delete_one({"_id": with_language(FRAME_ID, language)})
    return result.deleted_count > 0
