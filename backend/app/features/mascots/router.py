"""Owner-scoped CRUD for reusable, animated SVG mascot documents."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ...core.deps import get_current_author
from ...models.mascot import Mascot
from ...models.user import User

router = APIRouter(prefix="/mascots", tags=["mascots"])


class MascotDocumentIn(BaseModel):
    schemaVersion: int = 1
    starterVersion: int | None = None
    id: str
    name: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=1, max_length=100)
    purpose: str = Field(default="custom", min_length=1, max_length=40)
    description: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=20)
    canvas: dict[str, Any]
    palette: dict[str, str]
    behavior: dict[str, Any] | None = None
    groups: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    anchors: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    clips: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    activeClipId: str | None = None
    layers: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    createdAt: str
    updatedAt: str


PURPOSES = ["happy", "welcome", "sad", "excited", "loading", "waiting"]
STARTER_VERSION = 2

STYLE = {
    "happy": ("Happy", "body-boulder", "pattern-freckles", "accessory-antenna", "eyes-happy", "mouth-smile-big", "#534AB7", "#7C6DD8", "#EF9F27"),
    "welcome": ("Welcome", "body-bell", "pattern-buttons", "accessory-tuft", "eyes-even", "mouth-laugh", "#3B82F6", "#06B6D4", "#F97316"),
    "sad": ("Sad", "body-gumdrop", "pattern-patch", "accessory-nub", "eyes-down", "mouth-frown", "#6366F1", "#818CF8", "#F59E0B"),
    "excited": ("Excited", "body-blob", "pattern-zig", "accessory-spikes", "eyes-googly", "mouth-laugh", "#C026D3", "#7E22CE", "#F59E0B"),
    "loading": ("Loading", "body-cube", "pattern-spiral", "accessory-loop", "eyes-dots", "mouth-line", "#534AB7", "#7C6DD8", "#EF9F27"),
    "waiting": ("Waiting", "body-loaf", "pattern-stitches", "accessory-curl", "eyes-side", "mouth-pout", "#0D9488", "#34D399", "#FB7185"),
}

PLACEMENT = {
    "body": (128, 143, 1.25),
    "pattern": (128, 151, .82),
    "accessory": (128, 72, .82),
    "eyes": (128, 126, .72),
    "mouth": (128, 164, .6),
}

MOTION = {
    "happy": {"body": ("bounce", 2.2), "accessory": ("float", 2.0), "pattern": ("pulse", 2.8)},
    "welcome": {"body": ("float", 3.0), "accessory": ("wiggle", 2.2)},
    "sad": {"body": ("pulse", 4.0), "accessory": ("float", 4.5)},
    "excited": {"body": ("bounce", 1.25), "accessory": ("wiggle", 1.0), "pattern": ("pulse", 1.4)},
    "loading": {"body": ("pulse", 1.2), "pattern": ("spin", 1.4), "accessory": ("float", 1.8)},
    "waiting": {"body": ("float", 4.5), "accessory": ("float", 5.0)},
}


def _layer(asset_id: str, category: str, name: str, animation: str = "none", duration: float = 1.5) -> dict[str, Any]:
    x, y, scale = PLACEMENT[category]
    return {
        "id": f"{asset_id}-starter", "assetId": asset_id, "category": category,
        "name": name, "x": x, "y": y, "scale": scale, "rotation": 0,
        "opacity": 1, "visible": True, "animation": animation,
        "duration": duration, "delay": 0,
    }


def _starter_document(purpose: str) -> dict[str, Any]:
    name, body, pattern, accessory, eyes, mouth, primary, secondary, accent = STYLE[purpose]
    now = datetime.now(timezone.utc).isoformat()
    motion = MOTION[purpose]
    body_motion = motion.get("body", ("none", 1.5))
    pattern_motion = motion.get("pattern", ("none", 1.5))
    accessory_motion = motion.get("accessory", ("none", 1.5))
    layers = [
        _layer(body, "body", body.removeprefix("body-").replace("-", " ").title(), *body_motion),
        _layer(pattern, "pattern", pattern.removeprefix("pattern-").replace("-", " ").title(), *pattern_motion),
        _layer(accessory, "accessory", accessory.removeprefix("accessory-").replace("-", " ").title(), *accessory_motion),
        _layer(eyes, "eyes", eyes.removeprefix("eyes-").replace("-", " ").title(), "blink", 4),
        _layer(mouth, "mouth", mouth.removeprefix("mouth-").replace("-", " ").title()),
    ]
    return {
        "schemaVersion": 1,
        "starterVersion": STARTER_VERSION,
        "id": f"mascot-{purpose}",
        "name": name,
        "slug": f"koda-{purpose}",
        "purpose": purpose,
        "description": "",
        "tags": [purpose],
        "canvas": {"width": 256, "height": 256, "viewBox": "0 0 256 256"},
        "palette": {"primary": primary, "secondary": secondary, "accent": accent, "ink": "#0E0B55", "white": "#FFFFFF"},
        "layers": layers,
        "createdAt": now,
        "updatedAt": now,
    }


async def _seed_starters(owner_id: str) -> None:
    owner_rows = await Mascot.find(Mascot.owner_id == owner_id).to_list()
    seed_missing = not owner_rows or not any(row.starter_version > 0 for row in owner_rows)
    for purpose in PURPOSES:
        document = _starter_document(purpose)
        existing = await Mascot.find_one(Mascot.owner_id == owner_id, Mascot.mascot_id == document["id"])
        if not existing and seed_missing:
            await Mascot(owner_id=owner_id, mascot_id=document["id"], purpose=purpose,
                         name=document["name"], slug=document["slug"], document=document,
                         starter_version=STARTER_VERSION).insert()
        elif existing and existing.starter_version < STARTER_VERSION:
            existing.purpose = purpose
            existing.name = document["name"]
            existing.slug = document["slug"]
            existing.document = document
            existing.starter_version = STARTER_VERSION
            existing.updated_at = datetime.now(timezone.utc)
            await existing.save()


@router.get("")
async def list_mascots(user: User = Depends(get_current_author)):
    owner_id = str(user.id)
    await _seed_starters(owner_id)
    rows = await Mascot.find(Mascot.owner_id == owner_id).sort("+purpose", "+name").to_list()
    return [row.document for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_mascot(body: MascotDocumentIn, user: User = Depends(get_current_author)):
    owner_id = str(user.id)
    if await Mascot.find_one(Mascot.owner_id == owner_id, Mascot.mascot_id == body.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Mascot already exists")
    payload = body.model_dump()
    row = Mascot(owner_id=owner_id, mascot_id=body.id, purpose=body.purpose,
                 name=body.name, slug=body.slug, document=payload)
    await row.insert()
    return row.document


@router.put("/{mascot_id}")
async def update_mascot(mascot_id: str, body: MascotDocumentIn, user: User = Depends(get_current_author)):
    owner_id = str(user.id)
    row = await Mascot.find_one(Mascot.owner_id == owner_id, Mascot.mascot_id == mascot_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mascot not found")
    payload = body.model_dump()
    payload["id"] = mascot_id
    payload["updatedAt"] = datetime.now(timezone.utc).isoformat()
    row.purpose = body.purpose
    row.name = body.name
    row.slug = body.slug
    row.document = payload
    row.updated_at = datetime.now(timezone.utc)
    await row.save()
    return row.document


@router.delete("/{mascot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mascot(mascot_id: str, user: User = Depends(get_current_author)):
    row = await Mascot.find_one(Mascot.owner_id == str(user.id), Mascot.mascot_id == mascot_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mascot not found")
    await row.delete()
