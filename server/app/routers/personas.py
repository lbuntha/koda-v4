"""Who Koda can be: the character roster.

Two audiences, and the split is the same one the plan catalogue makes.

* **Anyone signed in** reads the enabled characters. A parent choosing a teacher
  for their child has to see the choices, a device has to draw the one in force,
  and none of it is a secret.
* **An operator** edits the roster, behind `system:write` — the same right as
  the switchboard and the plan catalogue, because this is the same job: what
  every family on this deployment gets, rather than what one family sets.

The `manner` field is the only free text that reaches the model, and it is a
*style* instruction poured into a prompt the code owns — see
`persona_defaults`. An operator can change how a teacher speaks; they cannot
change what a teacher is allowed to do.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import Conflict, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.persona_defaults import DEFAULT_PERSONA, VOICES
from app.repos import personas as personas_repo

router = APIRouter(prefix="/personas", tags=["personas"], dependencies=[AUTHENTICATED])

CanOperate = Annotated[Principal, Depends(require("system:write"))]


class PersonaOut(Model):
    persona_id: str = Field(alias="personaId")
    name: str
    emoji: str
    blurb: str
    #: How this teacher speaks. Sent to operators and to the tutor proxy; a
    #: family's screen shows `blurb` instead, which is the human sentence.
    manner: str
    voice: str
    #: DiceBear seed. Opaque — it is an input to a drawing, never an identifier.
    avatar_seed: str = Field(alias="avatarSeed")
    min_age: int = Field(alias="minAge")
    max_age: int = Field(alias="maxAge")
    enabled: bool
    order: int


class PersonaIn(Model):
    """A character's wording. Absent fields are left as they are."""

    name: str | None = Field(default=None, min_length=1, max_length=40)
    blurb: str | None = Field(default=None, max_length=160)
    # Long enough for a real teaching manner, short enough that it cannot become
    # a second system prompt smuggled in through the roster.
    manner: str | None = Field(default=None, min_length=10, max_length=600)
    voice: str | None = None
    emoji: str | None = Field(default=None, max_length=8)
    avatar_seed: str | None = Field(default=None, min_length=1, max_length=64, alias="avatarSeed")
    min_age: int | None = Field(default=None, ge=3, le=18, alias="minAge")
    max_age: int | None = Field(default=None, ge=3, le=18, alias="maxAge")
    enabled: bool | None = None
    order: int | None = Field(default=None, ge=0, le=1000)


class PersonaCreate(PersonaIn):
    persona_id: str = Field(
        min_length=2, max_length=32, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", alias="personaId"
    )
    name: str = Field(min_length=1, max_length=40)
    manner: str = Field(min_length=10, max_length=600)


def _out(row: dict[str, Any]) -> PersonaOut:
    return PersonaOut(
        personaId=row["_id"],
        name=row.get("name", row["_id"]),
        emoji=row.get("emoji", "✨"),
        blurb=row.get("blurb", ""),
        manner=row.get("manner", ""),
        voice=row.get("voice", "Aoede"),
        # Falls back to the id, so a character created before this field existed
        # still has a stable face rather than a blank tile.
        avatarSeed=row.get("avatarSeed") or row["_id"],
        minAge=int(row.get("minAge", 4)),
        maxAge=int(row.get("maxAge", 12)),
        enabled=bool(row.get("enabled", True)),
        order=int(row.get("order", 100)),
    )


def _check_voice(voice: str | None) -> None:
    if voice is not None and voice not in VOICES:
        # Not free text: a voice the live API does not know is a character that
        # cannot speak, and the failure would surface as silence mid-lesson.
        raise Conflict(f"No such voice. Choose one of: {', '.join(VOICES)}.", "unknown_voice")


@router.get("")
async def roster(db: Db, p: CurrentPrincipal) -> dict[str, Any]:
    """The characters a child may be given, and the voices one may speak with."""
    return {
        "personas": [_out(row) for row in await personas_repo.listing(db, only_enabled=True)],
        "voices": list(VOICES),
        "defaultPersonaId": DEFAULT_PERSONA,
    }


@router.get("/all")
async def full_roster(db: Db, p: CanOperate) -> dict[str, Any]:
    """Every character including the retired ones — the operator's view."""
    return {
        "personas": [_out(row) for row in await personas_repo.listing(db)],
        "voices": list(VOICES),
        "defaultPersonaId": DEFAULT_PERSONA,
    }


@router.patch("/{persona_id}")
async def edit(persona_id: str, body: PersonaIn, db: Db, p: CanOperate) -> PersonaOut:
    patch = body.model_dump(by_alias=True, exclude_unset=True)
    _check_voice(patch.get("voice"))
    if persona_id == DEFAULT_PERSONA and patch.get("enabled") is False:
        # The floor every unchosen child falls back to. Retiring it would leave
        # a deployment whose default teacher does not exist.
        raise Conflict("The default character cannot be switched off.", "default_persona")

    row = await personas_repo.update(db, persona_id, patch)
    if not row:
        raise NotFound("No such character.")
    return _out(row)


@router.post("", status_code=201)
async def add(body: PersonaCreate, db: Db, p: CanOperate) -> PersonaOut:
    if await personas_repo.by_id(db, body.persona_id):
        raise Conflict("A character with that id already exists.", "persona_exists")
    _check_voice(body.voice)
    await personas_repo.seed_default(
        db,
        {
            "personaId": body.persona_id,
            "name": body.name,
            "emoji": body.emoji or "✨",
            "blurb": body.blurb or "",
            "manner": body.manner,
            "voice": body.voice or "Aoede",
            "avatarSeed": body.avatar_seed or body.persona_id,
            "minAge": body.min_age if body.min_age is not None else 4,
            "maxAge": body.max_age if body.max_age is not None else 12,
            "enabled": body.enabled if body.enabled is not None else True,
            "order": body.order if body.order is not None else 100,
        },
    )
    row = await personas_repo.by_id(db, body.persona_id)
    assert row is not None
    return _out(row)


@router.delete("/{persona_id}", status_code=204)
async def remove(persona_id: str, db: Db, p: CanOperate) -> None:
    if persona_id == DEFAULT_PERSONA:
        raise Conflict("The default character cannot be deleted.", "default_persona")
    if not await personas_repo.remove(db, persona_id):
        raise NotFound("No such character.")
