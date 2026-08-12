"""Owner-scoped CRUD for reusable mascot style templates."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ...core.deps import get_current_author
from ...models.mascot_style import MascotStyle
from ...models.user import User
from .cast_styles import seed_cast_styles
from .router import MascotDocumentIn

router = APIRouter(prefix="/mascot-styles", tags=["mascot-styles"])


class MascotStyleIn(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=80)
    document: MascotDocumentIn
    createdAt: str
    updatedAt: str


class HiddenMascotPresetsIn(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=200)


@router.get("/hidden-presets")
async def get_hidden_mascot_presets(user: User = Depends(get_current_author)):
    return {"ids": user.hidden_mascot_preset_ids}


@router.put("/hidden-presets")
async def update_hidden_mascot_presets(
    body: HiddenMascotPresetsIn,
    user: User = Depends(get_current_author),
):
    # Preserve order for a stable response while preventing duplicate or blank
    # tombstones from accumulating in the user document.
    user.hidden_mascot_preset_ids = list(dict.fromkeys(preset_id.strip() for preset_id in body.ids if preset_id.strip()))
    await user.save()
    return {"ids": user.hidden_mascot_preset_ids}


@router.get("")
async def list_mascot_styles(user: User = Depends(get_current_author)):
    owner_id = str(user.id)
    # The shelf is where a canvas looks for its guide, so it cannot start empty:
    # see `cast_styles` for the four moments a question has and why each needs a
    # face of its own. Seeded on first read, never over the top of existing work.
    await seed_cast_styles(owner_id)
    rows = await MascotStyle.find(MascotStyle.owner_id == owner_id).sort("-updated_at").to_list()
    return [{"id": row.style_id, "name": row.name, "document": row.document,
             "createdAt": row.created_at.isoformat(), "updatedAt": row.updated_at.isoformat()} for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_mascot_style(body: MascotStyleIn, user: User = Depends(get_current_author)):
    owner_id = str(user.id)
    if await MascotStyle.find_one(MascotStyle.owner_id == owner_id, MascotStyle.style_id == body.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Mascot style already exists")
    now = datetime.now(timezone.utc)
    row = MascotStyle(owner_id=owner_id, style_id=body.id, name=body.name,
                      document=body.document.model_dump(), created_at=now, updated_at=now)
    await row.insert()
    return {"id": row.style_id, "name": row.name, "document": row.document,
            "createdAt": row.created_at.isoformat(), "updatedAt": row.updated_at.isoformat()}


@router.put("/{style_id}")
async def update_mascot_style(style_id: str, body: MascotStyleIn, user: User = Depends(get_current_author)):
    row = await MascotStyle.find_one(MascotStyle.owner_id == str(user.id), MascotStyle.style_id == style_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mascot style not found")
    row.name = body.name
    row.document = body.document.model_dump()
    row.updated_at = datetime.now(timezone.utc)
    await row.save()
    return {"id": row.style_id, "name": row.name, "document": row.document,
            "createdAt": row.created_at.isoformat(), "updatedAt": row.updated_at.isoformat()}


@router.delete("/{style_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mascot_style(style_id: str, user: User = Depends(get_current_author)):
    row = await MascotStyle.find_one(MascotStyle.owner_id == str(user.id), MascotStyle.style_id == style_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mascot style not found")
    await row.delete()
