"""Menu resolution + inspection.

  GET /menus/me   — the signed-in user's sidebar, grouped by main menu.
  GET /menus      — all seeded menus (admin).
  GET /menus/roles — all roles and their menu access (admin).

Access = the role's menu_keys (["*"] = all) ∪ the user's own menu_ids.
"""

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ...models.user import User, Role
from ...models.menu import Menu, RoleDef
from ...core.deps import Principal, get_principal, get_current_admin

router = APIRouter(prefix="/menus", tags=["menus"])


class RoleMenusUpdate(BaseModel):
    menu_keys: list[str]


class RoleIn(BaseModel):
    key: str
    label: str


class MenuIn(BaseModel):
    key: str
    section: str
    section_label: str
    label: str
    icon: str = "Circle"
    order: int = 0


class MenuUpdate(BaseModel):
    section: str | None = None
    section_label: str | None = None
    label: str | None = None
    icon: str | None = None
    order: int | None = None


async def _allowed_keys(principal: Principal, all_keys: list[str]) -> set[str]:
    role_def = await RoleDef.find_one(RoleDef.key == principal.role)
    allowed: set[str] = set()
    if role_def:
        allowed = set(all_keys) if "*" in role_def.menu_keys else set(role_def.menu_keys)
    # Per-user grants (adults carry menu_ids on their User record).
    if principal.role != Role.student.value:
        user = await User.get(PydanticObjectId(principal.id))
        if user:
            allowed |= set(user.menu_ids)
    return allowed


@router.get("/me")
async def my_menus(principal: Principal = Depends(get_principal)):
    menus = await Menu.find_all().sort("+order").to_list()
    allowed = await _allowed_keys(principal, [m.key for m in menus])

    sections: dict[str, dict] = {}
    order: list[str] = []
    for m in menus:
        if m.key not in allowed:
            continue
        if m.section not in sections:
            sections[m.section] = {"id": m.section, "label": m.section_label, "items": []}
            order.append(m.section)
        sections[m.section]["items"].append({"id": m.key, "label": m.label, "icon": m.icon})

    return {"menus": [sections[s] for s in order]}


@router.get("")
async def list_menus(_: User = Depends(get_current_admin)):
    menus = await Menu.find_all().sort("+order").to_list()
    return [m.model_dump(mode="json") for m in menus]


@router.get("/roles")
async def list_roles(_: User = Depends(get_current_admin)):
    roles = await RoleDef.find_all().to_list()
    return [r.model_dump(mode="json") for r in roles]


@router.patch("/roles/{key}")
async def update_role_menus(key: str, body: RoleMenusUpdate, _: User = Depends(get_current_admin)):
    role = await RoleDef.find_one(RoleDef.key == key)
    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    role.menu_keys = body.menu_keys
    await role.save()
    return role.model_dump(mode="json")


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(body: RoleIn, _: User = Depends(get_current_admin)):
    if await RoleDef.find_one(RoleDef.key == body.key):
        raise HTTPException(status.HTTP_409_CONFLICT, "Role key already exists")
    role = RoleDef(key=body.key.strip().lower(), label=body.label, menu_keys=[])
    await role.insert()
    return role.model_dump(mode="json")


@router.delete("/roles/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(key: str, _: User = Depends(get_current_admin)):
    if key in Role.values():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete a built-in role")
    role = await RoleDef.find_one(RoleDef.key == key)
    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    await role.delete()


# ── Menu CRUD (design menus) ─────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_menu(body: MenuIn, _: User = Depends(get_current_admin)):
    if await Menu.find_one(Menu.key == body.key):
        raise HTTPException(status.HTTP_409_CONFLICT, "Menu key already exists")
    menu = Menu(**body.model_dump())
    menu.key = menu.key.strip().lower()
    await menu.insert()
    return menu.model_dump(mode="json")


@router.patch("/{key}")
async def update_menu(key: str, body: MenuUpdate, _: User = Depends(get_current_admin)):
    menu = await Menu.find_one(Menu.key == key)
    if not menu:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(menu, field, value)
    await menu.save()
    return menu.model_dump(mode="json")


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(key: str, _: User = Depends(get_current_admin)):
    menu = await Menu.find_one(Menu.key == key)
    if not menu:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu not found")
    await menu.delete()
