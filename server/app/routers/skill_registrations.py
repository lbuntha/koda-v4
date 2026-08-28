"""The current learner's personal skill library."""

from datetime import datetime

from fastapi import APIRouter, status
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db
from app.errors import Forbidden, NotFound
from app.models.common import Model
from app.repos import learners as learners_repo
from app.repos import skill_registrations as registrations_repo
from app.repos import skills as skills_repo

router = APIRouter(
    prefix="/skill-registrations",
    tags=["skill-registrations"],
    dependencies=[AUTHENTICATED],
)


class SkillRegistration(Model):
    skill_id: str = Field(alias="skillId")
    registered_at: int = Field(alias="registeredAt")


class SkillRegistrationList(Model):
    registrations: list[SkillRegistration]


def _owner(p: CurrentPrincipal) -> tuple[str, str]:
    if p.learner_id:
        return "learner", p.learner_id
    return "user", p.subject_id


def _out(row: dict) -> SkillRegistration:
    registered = row.get("registeredAt")
    return SkillRegistration(
        skillId=row["skillId"],
        registeredAt=(
            int(registered.timestamp() * 1000)
            if isinstance(registered, datetime)
            else int(registered or 0)
        ),
    )


async def _eligible_skill(skill_id: str, db: Db, p: CurrentPrincipal) -> dict:
    skill = await skills_repo.get(db, skill_id)
    if not skill or skill.get("status") != "published" or not skill.get("isEnabled", True):
        raise NotFound("That skill is not available.", "skill_unavailable")

    if p.learner_id and p.family_id:
        learner = await learners_repo.by_id(db, p.learner_id, p.family_id)
        birth_year = (learner or {}).get("birthYear")
        ages = (skill.get("audience") or {}).get("ages")
        if birth_year and isinstance(ages, list) and len(ages) == 2:
            age = datetime.now().year - int(birth_year)
            if age < int(ages[0]) or age > int(ages[1]):
                raise Forbidden(
                    "That skill is outside this learner's age range.",
                    "skill_outside_age_range",
                )
    return skill


@router.get("")
async def list_registrations(db: Db, p: CurrentPrincipal) -> SkillRegistrationList:
    owner_type, owner_id = _owner(p)
    rows = await registrations_repo.list_for_owner(db, owner_type, owner_id)
    return SkillRegistrationList(registrations=[_out(row) for row in rows])


@router.post("/{skill_id}", status_code=status.HTTP_201_CREATED)
async def register_skill(skill_id: str, db: Db, p: CurrentPrincipal) -> SkillRegistration:
    await _eligible_skill(skill_id, db, p)
    owner_type, owner_id = _owner(p)
    existing = await registrations_repo.get(db, owner_type, owner_id, skill_id)
    row = await registrations_repo.register(
        db,
        owner_type=owner_type,
        owner_id=owner_id,
        family_id=p.family_id,
        skill_id=skill_id,
    )
    if existing and existing.get("removedAt") is not None:
        row = await registrations_repo.refresh_registration_time(
            db, owner_type, owner_id, skill_id
        ) or row
    return _out(row)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_skill(skill_id: str, db: Db, p: CurrentPrincipal) -> None:
    owner_type, owner_id = _owner(p)
    await registrations_repo.remove(db, owner_type, owner_id, skill_id)
