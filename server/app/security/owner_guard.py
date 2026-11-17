"""The Koda owner (`core`) is the one account no Admin can act on.

An Admin manages users and roles, so without this they could make themselves
the owner, reset the owner's password, suspend or delete them, or build a role
that carries the owner's rights. Each of those is refused unless the caller is
a Koda owner themselves.
"""

from app.errors import Forbidden
from app.models.auth import Principal
from app.security.policy import OWNER_ONLY

OWNER_ROLE = "core"
#: Roles that count as administrators for "at least one must remain".
ADMIN_ROLES = ("admin", OWNER_ROLE)


def is_owner(p: Principal) -> bool:
    return p.platform_role == OWNER_ROLE


def guard_account(p: Principal, target: dict | None, next_role: str | None = None) -> None:
    """Only a Koda owner may touch an owner's account, or make anyone an owner."""
    touches_owner = (target or {}).get("platformRole") == OWNER_ROLE or next_role == OWNER_ROLE
    if touches_owner and not is_owner(p):
        raise Forbidden("Only the Koda owner can change the owner's account or make an owner.", "owner_only")


def guard_permissions(p: Principal, permissions: list[str] | set[str]) -> None:
    """A role may carry the owner's rights only if the owner builds it."""
    if set(permissions) & OWNER_ONLY and not is_owner(p):
        raise Forbidden("Only the Koda owner can give a role these rights.", "owner_only")
