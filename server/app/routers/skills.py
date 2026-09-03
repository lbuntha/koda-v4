"""Mongo-backed registration and publication API for bundled skills."""

from datetime import datetime
from math import floor, isfinite
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import Forbidden, NotFound, PaymentRequired
from app.models.auth import Principal
from app.models.common import Model
from app.repos import skills as skills_repo
from app.repos import users as users_repo
from app.security.permissions import principal_can
from app.services.entitlements import has_feature

router = APIRouter(prefix="/skills", tags=["skills"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]

def _may_publish(p: CurrentPrincipal) -> Principal:
    # Publication changes the deployment for every family. Family settings
    # writers may tune their own copy but cannot release code platform-wide.
    if p.family_id is not None or not principal_can(p, "content:write"):
        raise Forbidden("Only an operator can publish a shared skill.", "not_an_operator")
    return p


CanPublish = Annotated[Principal, Depends(_may_publish)]


class PublicationActor(Model):
    id: str
    display_name: str = Field(alias="displayName")


class RegisteredSkill(Model):
    id: str
    name: str
    version: str
    description: str
    category: str
    author: str
    icon_name: str = Field(alias="iconName")
    # An operator's own name for the skill. `name` follows the deployed
    # manifest and is not editable here, so a rename lives in its own field or
    # the next deploy silently undoes it.
    title: str | None = None
    tagline: str | None = None
    thumbnail: str | None = None
    status: Literal["draft", "published"]
    audience: dict[str, Any]
    teaches: list[str] = Field(default_factory=list)
    requires: list[str] = Field(default_factory=list)
    rev: int = 1
    modified: int = 0
    published_by: PublicationActor | None = Field(default=None, alias="publishedBy")
    published_at: int | None = Field(default=None, alias="publishedAt")
    status_changed_by: PublicationActor | None = Field(default=None, alias="statusChangedBy")
    status_changed_at: int | None = Field(default=None, alias="statusChangedAt")
    is_enabled: bool = Field(default=True, alias="isEnabled")
    features: list[dict[str, Any]] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)
    lesson_content: dict[str, dict[str, Any]] = Field(
        default_factory=dict, alias="lessonContent"
    )
    lessons: list[dict[str, Any]] = Field(default_factory=list)
    configuration_changed_by: PublicationActor | None = Field(
        default=None, alias="configurationChangedBy"
    )
    configuration_changed_at: int | None = Field(
        default=None, alias="configurationChangedAt"
    )
class SkillList(Model):
    skills: list[RegisteredSkill]


class LessonAccess(Model):
    skill_id: str = Field(alias="skillId")
    lesson_id: str = Field(alias="lessonId")
    tier: Literal["free", "premium"]
    allowed: bool = True


class PublicationWrite(Model):
    status: Literal["draft", "published"]


class SkillConfigurationWrite(Model):
    is_enabled: bool = Field(alias="isEnabled")
    title: str | None = Field(default=None, max_length=60)
    tagline: str | None = Field(default=None, max_length=160)
    thumbnail: str | None = Field(default=None, max_length=500)
    features: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    settings: dict[str, Any] = Field(default_factory=dict)
    lesson_content: dict[str, dict[str, Any]] = Field(
        default_factory=dict, alias="lessonContent"
    )


def _out(row: dict[str, Any]) -> RegisteredSkill:
    updated = row.get("updatedAt")
    published = row.get("publishedAt")
    status_changed = row.get("statusChangedAt")
    configuration_changed = row.get("configurationChangedAt")
    modified = int(updated.timestamp() * 1000) if isinstance(updated, datetime) else 0
    return RegisteredSkill(
        id=row["id"],
        name=row.get("name", row["id"]),
        version=row.get("version", "0.0.0"),
        description=row.get("description", ""),
        category=row.get("category", "core"),
        author=row.get("author", ""),
        iconName=row.get("iconName", "Puzzle"),
        title=row.get("title"),
        tagline=row.get("tagline"),
        thumbnail=row.get("thumbnail"),
        status=row.get("status", "draft"),
        audience=row.get("audience") or {"ages": [3, 12], "category": "number-sense"},
        teaches=row.get("teaches") or [],
        requires=row.get("requires") or [],
        rev=row.get("rev", 1),
        modified=modified,
        publishedBy=row.get("publishedBy"),
        publishedAt=(
            int(published.timestamp() * 1000) if isinstance(published, datetime) else None
        ),
        statusChangedBy=row.get("statusChangedBy"),
        statusChangedAt=(
            int(status_changed.timestamp() * 1000)
            if isinstance(status_changed, datetime)
            else None
        ),
        isEnabled=row.get("isEnabled", True),
        features=row.get("features") or [],
        settings=row.get("settings") or {},
        lessonContent=row.get("lessonContent") or {},
        lessons=row.get("lessons") or [],
        configurationChangedBy=row.get("configurationChangedBy"),
        configurationChangedAt=(
            int(configuration_changed.timestamp() * 1000)
            if isinstance(configuration_changed, datetime)
            else None
        ),
    )


def _premium_position(row: dict[str, Any]) -> int | None:
    """First premium lesson position, or None when this skill charges nothing."""
    enabled = any(
        feature.get("id") == "premium_lessons" and feature.get("isEnabled") is True
        for feature in row.get("features") or []
        if isinstance(feature, dict)
    )
    if not enabled:
        return None
    try:
        raw = float((row.get("settings") or {}).get("freeLessons", 10))
        free = max(0, floor(raw)) if isfinite(raw) else 0
    except (TypeError, ValueError):
        free = 0
    return free + 1


@router.get("")
async def list_skills(db: Db, _: CanRead) -> SkillList:
    return SkillList(skills=[_out(row) for row in await skills_repo.list_all(db)])


@router.get("/{skill_id}/lessons/{lesson_id}/access")
async def lesson_access(
    skill_id: str, lesson_id: str, db: Db, p: CurrentPrincipal
) -> LessonAccess:
    """Authorize the server-owned subscription boundary before a paid round.

    The browser may describe a node as premium, but that claim grants nothing:
    this route resolves the lesson and its position from Mongo, then asks the
    effective (including expiry/status) subscription for the paid feature.
    """
    row = await skills_repo.get(db, skill_id)
    if row is None:
        raise NotFound(f'No registered skill "{skill_id}".', "skill_not_found")

    lessons = row.get("lessons") or []
    position = next(
        (
            index
            for index, lesson in enumerate(lessons, start=1)
            if isinstance(lesson, dict) and lesson.get("id") == lesson_id
        ),
        None,
    )
    if position is None:
        raise NotFound(f'No lesson "{lesson_id}" in skill "{skill_id}".', "lesson_not_found")

    premium_from = _premium_position(row)
    premium = premium_from is not None and position >= premium_from
    if premium and not await has_feature(
        db,
        p.family_id,
        "course.premium",
        staff=principal_can(p, "system:write"),
    ):
        raise PaymentRequired(
            "This lesson needs a plan that includes the full course.",
            "premium_lesson_required",
        )

    return LessonAccess(
        skillId=skill_id,
        lessonId=lesson_id,
        tier="premium" if premium else "free",
    )


@router.patch("/{skill_id}/publication")
async def publish_skill(
    skill_id: str, body: PublicationWrite, db: Db, p: CanPublish
) -> RegisteredSkill:
    user = await users_repo.by_id(db, p.subject_id)
    actor = {
        "id": p.subject_id,
        "displayName": (
            (user or {}).get("displayName")
            or (user or {}).get("email")
            or p.platform_role.title()
            or "Operator"
        ),
    }
    row = await skills_repo.set_status(db, skill_id, body.status, actor)
    if row is None:
        raise NotFound(f'No registered skill "{skill_id}".', "skill_not_found")
    return _out(row)


@router.put("/{skill_id}/configuration")
async def save_skill_configuration(
    skill_id: str, body: SkillConfigurationWrite, db: Db, p: CanPublish
) -> RegisteredSkill:
    user = await users_repo.by_id(db, p.subject_id)
    actor = {
        "id": p.subject_id,
        "displayName": (
            (user or {}).get("displayName")
            or (user or {}).get("email")
            or p.platform_role.title()
            or "Operator"
        ),
    }
    row = await skills_repo.set_configuration(
        db,
        skill_id,
        {
            "isEnabled": body.is_enabled,
            "title": body.title,
            "tagline": body.tagline,
            "thumbnail": body.thumbnail,
            "features": body.features,
            "settings": body.settings,
            "lessonContent": body.lesson_content,
        },
        actor,
    )
    if row is None:
        raise NotFound(f'No registered skill "{skill_id}".', "skill_not_found")
    return _out(row)
