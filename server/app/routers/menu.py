"""What the sidebar draws.

Served rather than bundled so a deployment can change the menu without a
release — but the app still ships a default JSON, because a sidebar has to draw
before any request comes back, and a first run may have no network at all.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import Conflict, Forbidden, NotFound
from app.menu_defaults import DEFAULT_MENU
from app.models.auth import Principal
from app.models.common import Model
from app.repos import menu as menu_repo
from app.security import policy, principal_can
from app.security.policy import canonical_role

# Every route here needs a signed-in caller; the permission each one needs
# is on the route itself.
router = APIRouter(prefix="/menu", tags=["menu"], dependencies=[AUTHENTICATED])

CanEdit = Annotated[Principal, Depends(require("menu:manage"))]


class MenuItem(Model):
    id: str
    label: str
    icon: str
    badge: str | None = None
    # Two ways to say who sees an entry, and they answer different questions.
    # `requires` is capability — "whoever may change settings"; it keeps working
    # when roles change. `roles` is an explicit list — "these people" — for the
    # cases a capability cannot express. A row may use either, or neither.
    requires: str | None = None
    roles: list[str] | None = None
    order: int = 100
    enabled: bool = True


class MenuOut(Model):
    items: list[MenuItem]
    # What the caller may actually see, already filtered — the client filters
    # too, for the moment before this returns, but the server is the authority.
    filtered_for: str = Field(alias="filteredFor")


class MenuItemPatch(Model):
    label: str | None = None
    icon: str | None = None
    badge: str | None = None
    order: int | None = None
    enabled: bool | None = None
    # Sent explicitly as null to clear, which is why these are not "exclude_none"
    # like the rest — "visible to everyone" has to be expressible.
    requires: str | None = None
    roles: list[str] | None = None
    clear_requires: bool = Field(default=False, alias="clearRequires")
    clear_roles: bool = Field(default=False, alias="clearRoles")


@router.get("")
async def get_menu(db: Db, p: CurrentPrincipal) -> MenuOut:
    rows = await menu_repo.for_family(db, p.family_id)

    # An admin sees every entry, by definition: the operator of the service is
    # the one person who needs the whole map, and hiding a page from them just
    # means they cannot fix it. Everyone else is filtered by the same question
    # the guard asks, so the sidebar can never offer a page the API refuses.
    if p.platform_role == "admin" and p.family_id is None:
        visible = rows
    else:
        visible = [row for row in rows if _may_see(p, row)]

    return MenuOut(items=[_as_item(row) for row in visible], filteredFor=p.role)


def _as_item(row: dict) -> MenuItem:
    return MenuItem(
        id=row["itemId"],
        label=row.get("label", row["itemId"]),
        icon=row.get("icon", "home"),
        badge=row.get("badge"),
        requires=row.get("requires"),
        roles=row.get("roles"),
        order=row.get("order", 100),
        enabled=row.get("enabled", True),
    )


def _may_see(p: Principal, row: dict) -> bool:
    """Both rules, when both are set: the entry is for people who satisfy each.

    A row with neither is visible to everyone signed in — which is what a menu
    entry is by default, and what `home` and `settings` stay.
    """
    # Startup reconciliation now keeps these rows honest, so these two are a
    # backstop rather than the rule: administering the menu or the roles is
    # platform-only whatever a pinned or hand-edited row happens to say.
    if row.get("itemId") == "menu":
        return principal_can(p, "menu:manage")
    if row.get("itemId") == "roles":
        return principal_can(p, "role:manage")

    roles = row.get("roles")
    if roles and canonical_role(p.role) not in {canonical_role(r) for r in roles}:
        return False

    requires = row.get("requires")
    return not requires or principal_can(p, requires)


@router.get("/all")
async def all_items(db: Db, p: CanEdit) -> MenuOut:
    """Every entry including hidden ones — what the Menu screen edits.

    Separate from `GET /menu` on purpose: that one answers "what do I draw",
    and quietly returning hidden rows there would put them in the sidebar.
    """
    rows = await menu_repo.for_family(db, p.family_id, include_disabled=True)
    return MenuOut(items=[_as_item(row) for row in rows], filteredFor=p.role)


@router.delete("/{item_id}", status_code=204)
async def reset_item(item_id: str, db: Db, p: CanEdit) -> None:
    """Forget the changes made to one entry.

    For a family that is their override, so the entry follows the shipped
    default again. For an operator — who has no family — it is the default
    itself, put back to what the code ships.
    """
    if p.family_id is None:
        _require_operator(p)
        for item in DEFAULT_MENU:
            if item["itemId"] == item_id:
                await menu_repo.reset_default(db, {**item, "enabled": True})
                return
        raise NotFound("No such menu entry.")

    await menu_repo.clear_family_override(db, p.family_id, item_id)


@router.patch("/{item_id}")
async def edit_item(item_id: str, body: MenuItemPatch, db: Db, p: CanEdit) -> MenuItem:
    """A family's own override of one entry — renaming it, hiding it, moving it."""
    patch = body.model_dump(exclude_none=True, exclude={"clear_requires", "clear_roles"})

    if body.requires and body.requires not in policy.PERMISSIONS:
        raise Conflict(f"Unknown permission: {body.requires}.", "unknown_permission")
    if body.roles:
        unknown = [r for r in body.roles if canonical_role(r) not in policy.ROLE_PERMISSIONS]
        if unknown:
            raise Conflict(f"Unknown role: {unknown[0]}.", "unknown_role")

    # Clearing is its own instruction: "visible to everyone" cannot be said by
    # omitting a field, because omitting is how the rest of a patch says
    # "leave this alone".
    if body.clear_requires:
        patch["requires"] = None
    if body.clear_roles:
        patch["roles"] = None

    if p.family_id is None:
        # An operator edits the *shipped default* — the entry every family
        # starts from — because they have no family of their own to override.
        _require_operator(p)
        # Deciding who sees an entry takes that decision off the code: startup
        # re-applies the shipped rule to every other row, and would otherwise
        # undo this one on the next boot. `DELETE /menu/{id}` hands it back.
        if "requires" in patch or "roles" in patch:
            patch["visibilityPinned"] = True
        await menu_repo.set_default(db, item_id, patch)
        row = await menu_repo.get_default(db, item_id) or {"itemId": item_id}
    else:
        row = await menu_repo.set_for_family(db, p.family_id, item_id, patch)

    return _as_item({**row, "itemId": item_id})


def _require_operator(p: Principal) -> None:
    """Editing what every family starts from is an operator's act, not a parent's."""
    if p.platform_role not in ("admin", "developer"):
        raise Forbidden("Only an operator can change the shipped menu.", "not_an_operator")
