"""Who is calling, and whether they may.

Two dependencies and one constant:

* `principal` turns a bearer token into a `Principal`, or refuses.
* `AUTHENTICATED` is what a router lists so **every** route under it is guarded
  by default — a guard you have to remember per route is a guard that will be
  forgotten, and the forgotten one is the one that matters.
* `require("permission")` adds the check for a specific act.
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials

from app.errors import Forbidden, Unauthorized
from app.models.auth import Principal
from app.security import policy
from app.security.scheme import bearer_scheme, oauth2_scheme
from app.security.tokens import read_access


async def principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    docs_token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> Principal:
    """Either declaration, one token.

    Both schemes read the same `Authorization: Bearer` header — listing both
    only changes what /docs offers, never what the API accepts.
    """
    presented = credentials.credentials if credentials else None
    scheme_ok = bool(credentials) and credentials.scheme.lower() == "bearer"
    token = (presented if scheme_ok else None) or docs_token
    if not token:
        raise Unauthorized()
    return read_access(token)


CurrentPrincipal = Annotated[Principal, Depends(principal)]

#: Guards a whole router: `APIRouter(dependencies=[AUTHENTICATED])`.
AUTHENTICATED = Depends(principal)


def principal_can(p: Principal, permission: str) -> bool:
    """The single answer to "may this caller do X".

    Used by `require()` to enforce and by the menu to decide what to draw, so a
    screen can never offer something the API then refuses — the two used to
    reason separately, and an admin lost half the sidebar because of it.
    """
    if p.permissions is not None:
        # New tokens carry the complete effective set, including a custom
        # platform role. Falling through to the static table here would make a
        # permission removed from a built-in role remain silently effective.
        if permission in p.permissions:
            return True
        # Staff tokens issued before platform permissions were embedded carry
        # an empty list. Let only those protected built-in roles use the legacy
        # table until their short-lived access token refreshes. A custom role
        # with no permissions must remain exactly that.
        if p.permissions or p.platform_role not in policy.PLATFORM_PERMISSIONS:
            return False
    if policy.role_can(p.role, permission):
        return True
    return policy.platform_can(p.platform_role, permission)


def require(*permissions: str):
    """Dependency: every listed permission, or 403.

    A permission comes from the caller's own effective set — their role plus the
    exceptions recorded for them — or, for staff and never for a child's record,
    from their platform role.
    """
    for permission in permissions:
        if permission not in policy.PERMISSIONS:
            raise ValueError(f"Unknown permission: {permission}")

    async def _check(p: CurrentPrincipal) -> Principal:
        for permission in permissions:
            if not principal_can(p, permission):
                raise Forbidden(f"This account cannot {permission.replace(':', ' ')}.")
        return p

    return _check
