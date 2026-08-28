"""Custom platform roles and the permissions attached to them."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import Field
from pymongo.errors import DuplicateKeyError

from app.deps import AUTHENTICATED, Db, require
from app.errors import Conflict, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import devices, platform_roles
from app.security import policy

router = APIRouter(prefix="/admin/roles", tags=["admin roles"], dependencies=[AUTHENTICATED])
CanManageRoles = Annotated[Principal, Depends(require("role:manage"))]


class RoleOut(Model):
    id: str
    name: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)
    built_in: bool = Field(default=False, alias="builtIn")
    users_count: int = Field(default=0, alias="usersCount")


class RolesOut(Model):
    roles: list[RoleOut]
    available_permissions: list[str] = Field(alias="availablePermissions")


class RoleCreateIn(Model):
    name: str = Field(min_length=2, max_length=60)
    description: str = Field(default="", max_length=240)
    permissions: list[str] = Field(default_factory=list)


class RolePatchIn(Model):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=240)
    permissions: list[str] | None = None


def _role_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50]


def _permissions(values: list[str]) -> list[str]:
    unknown = sorted(set(values) - policy.PERMISSIONS)
    if unknown:
        raise Conflict(f"Unknown permission: {unknown[0]}.", "unknown_permission")
    forbidden = sorted(set(values) & policy.GRANT_ONLY)
    if forbidden:
        raise Conflict(
            f"{forbidden[0]} requires a time-boxed data grant, not a platform role.",
            "grant_only_permission",
        )
    return sorted(set(values))


async def _out(db: Db, row: dict) -> RoleOut:
    return RoleOut(
        id=row["roleId"],
        name=row.get("name", row["roleId"].title()),
        description=row.get("description", ""),
        permissions=sorted(row.get("permissions", [])),
        builtIn=row.get("builtIn", False),
        usersCount=await db.users.count_documents({"platformRole": row["roleId"]}),
    )


@router.get("")
async def listing(db: Db) -> RolesOut:
    rows = await platform_roles.all_roles(db)
    return RolesOut(
        roles=[await _out(db, row) for row in rows],
        availablePermissions=sorted(policy.PERMISSIONS - policy.GRANT_ONLY),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_role(body: RoleCreateIn, db: Db, p: CanManageRoles) -> RoleOut:
    role_id = _role_id(body.name)
    if not role_id or role_id == "none":
        raise Conflict("Choose a role name with letters or numbers.", "invalid_role_name")
    if role_id in policy.ROLE_PERMISSIONS:
        raise Conflict(
            "That name belongs to a family role. Choose a distinct platform role name.",
            "reserved_role_name",
        )
    if await platform_roles.by_id(db, role_id):
        raise Conflict("A platform role with that name already exists.", "role_exists")
    try:
        row = await platform_roles.create(
            db,
            role_id,
            body.name.strip(),
            body.description.strip(),
            _permissions(body.permissions),
            p.subject_id,
        )
    except DuplicateKeyError as exc:
        raise Conflict("A platform role with that name already exists.", "role_exists") from exc
    return await _out(db, row)


@router.patch("/{role_id}")
async def update_role(role_id: str, body: RolePatchIn, db: Db, p: CanManageRoles) -> RoleOut:
    current = await platform_roles.by_id(db, role_id)
    if not current:
        raise NotFound("No such platform role.")
    if current.get("builtIn"):
        raise Conflict(
            "Built-in roles are protected. Create a custom role instead.",
            "built_in_role",
        )

    patch = body.model_dump(exclude_none=True)
    if "name" in patch:
        patch["name"] = patch["name"].strip()
    if "description" in patch:
        patch["description"] = patch["description"].strip()
    if "permissions" in patch:
        patch["permissions"] = _permissions(patch["permissions"])
    row = await platform_roles.update(db, role_id, patch)
    if not row:
        raise NotFound("No such custom platform role.")

    # Permission changes take effect on the next sign-in; end refresh sessions
    # so an old permission set cannot be renewed indefinitely.
    user_ids = await db.users.distinct("_id", {"platformRole": role_id})
    for user_id in user_ids:
        await devices.revoke_all_for_user(db, user_id)
    return await _out(db, row)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(role_id: str, db: Db, p: CanManageRoles) -> None:
    current = await platform_roles.by_id(db, role_id)
    if not current:
        raise NotFound("No such platform role.")
    if current.get("builtIn"):
        raise Conflict("Built-in roles cannot be deleted.", "built_in_role")
    assigned = await db.users.count_documents({"platformRole": role_id})
    if assigned:
        raise Conflict(
            f"Move {assigned} assigned user(s) to another role before deleting this one.",
            "role_in_use",
        )
    if not await platform_roles.delete(db, role_id):
        raise NotFound("No such custom platform role.")
