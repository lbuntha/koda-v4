"""Mongo-backed management API for the deploy-wide SVG library."""

import re
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Conflict, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import art as art_repo
from app.security import principal_can

router = APIRouter(prefix="/art", tags=["art"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]


def _may_author(p: CurrentPrincipal) -> Principal:
    """One gate for the whole library, and it says why in the refusal.

    This used to be two: the route asked for `settings:write` — which every
    parent holds — and then each handler re-checked the platform role. The
    checks agreed, so a family was correctly refused, but the *sidebar* read the
    first one and offered a parent an Art page the API would never let them
    save. `content:write` is now the single answer both the guard and the menu
    entry use, so what is on screen is what is allowed.
    """
    if not principal_can(p, "content:write"):
        raise Forbidden("Only an operator can change the shared art library.", "not_an_operator")
    return p


# Reading stays on `settings:read` — every device needs the art to draw a lesson.
CanWrite = Annotated[Principal, Depends(_may_author)]

NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_NAME_LENGTH = 64
MAX_ART_BYTES = 512 * 1024
UNCATEGORISED = "uncategorised"

# This mirrors the browser's fast refusal. Rendering still runs the full DOM
# allowlist sanitiser, but the API must never persist executable SVG content.
UNSAFE_MARKUP = re.compile(
    r"<\s*(script|iframe|object|embed|foreignObject)\b|\bon[a-z]+\s*=|javascript\s*:",
    re.IGNORECASE,
)


class ArtAsset(Model):
    id: str
    category: str
    markup: str
    rev: int = 1
    modified: int


class ArtList(Model):
    assets: list[ArtAsset]


class ArtWrite(Model):
    markup: str
    category: str = UNCATEGORISED


class ArtMove(Model):
    to_id: str | None = Field(default=None, alias="toId")
    category: str | None = None


class ArtSaved(ArtAsset):
    created: bool
    moved: bool


def _name(value: str, field: str) -> str:
    value = value.strip()
    if len(value) > MAX_NAME_LENGTH or not NAME_PATTERN.fullmatch(value):
        raise AppError(
            400,
            f"invalid_{field}",
            f"{field.title()} must be lowercase words joined by single hyphens.",
        )
    return value


def _category(value: str | None) -> str:
    return _name(value or UNCATEGORISED, "category")


def _markup(value: str) -> str:
    markup = value.strip()
    if not markup.lower().startswith("<svg"):
        raise AppError(400, "invalid_svg", "Markup must start with an SVG element.")
    if len(markup.encode("utf-8")) > MAX_ART_BYTES:
        raise AppError(413, "art_too_large", "SVG markup is larger than 512 KB.")
    if UNSAFE_MARKUP.search(markup):
        raise AppError(
            400, "unsafe_svg", "SVG scripts, event handlers, and embeds are not allowed."
        )
    return markup


def _out(row: dict) -> ArtAsset:
    updated = row.get("updatedAt")
    modified = int(updated.timestamp() * 1000) if isinstance(updated, datetime) else 0
    return ArtAsset(
        id=row["id"],
        category=row.get("category", UNCATEGORISED),
        markup=row.get("markup", ""),
        rev=row.get("rev", 1),
        modified=modified,
    )


@router.get("")
async def list_art(db: Db, _: CanRead) -> ArtList:
    return ArtList(assets=[_out(row) for row in await art_repo.list_all(db)])


@router.put("/{asset_id}")
async def save_art(asset_id: str, body: ArtWrite, db: Db, p: CanWrite) -> ArtSaved:
    asset_id = _name(asset_id, "id")
    row, created, moved = await art_repo.put(
        db, asset_id, _category(body.category), _markup(body.markup), p.subject_id
    )
    return ArtSaved(**_out(row).model_dump(), created=created, moved=moved)


@router.patch("/{asset_id}")
async def move_art(asset_id: str, body: ArtMove, db: Db, p: CanWrite) -> ArtAsset:
    asset_id = _name(asset_id, "id")
    existing = await art_repo.get(db, asset_id)
    if existing is None:
        raise NotFound(f'No art asset "{asset_id}".', "art_not_found")

    to_id = _name(body.to_id or asset_id, "id")
    category = _category(body.category or existing.get("category"))
    if to_id != asset_id and await art_repo.get(db, to_id):
        raise Conflict(f'An art asset with id "{to_id}" already exists.', "art_id_exists")

    row = await art_repo.move(db, asset_id, to_id, category, p.subject_id)
    assert row is not None
    return _out(row)


@router.delete("/{asset_id}", status_code=204)
async def delete_art(asset_id: str, db: Db, p: CanWrite) -> None:
    asset_id = _name(asset_id, "id")
    if not await art_repo.delete(db, asset_id, p.subject_id):
        raise NotFound(f'No art asset "{asset_id}".', "art_not_found")
