"""The permission table — the only place a role is named.

Roles are checked nowhere else in the service: routers ask for a permission and
`deps.require()` looks it up here. That is what keeps `docs/BACKEND.md` §5 and
the running code the same thing.
"""

from typing import Literal

FamilyRole = Literal["owner", "parent", "caregiver", "child", "student"]
PlatformRole = str

# `learner` was the first name for `child`. Tokens and membership rows written
# before the rename still say it, and they stay valid — a rename must not sign
# anybody out.
ROLE_ALIASES = {"learner": "child"}

# Verb-on-resource. "own" restrictions — a child reading their own record — are
# tenancy rather than permission, and are enforced by the query filter in repos.
PERMISSIONS = {
    "family:read",
    "family:update",
    "family:delete",
    "family:transfer",
    "member:invite",
    "member:list",
    "member:role",
    "member:remove",
    "learner:create",
    "learner:read",
    "learner:update",
    "learner:delete",
    "learner_data:read",
    # Two different acts, and conflating them is what made a parent's own tablet
    # unable to record a round. `append` is a device adding events for a round
    # just played; `write` is rewriting a record that already exists — which
    # nobody holds, because an adult editing what a child answered would make
    # the record fiction.
    "learner_data:append",
    "learner_data:write",
    "settings:read",
    "settings:write",
    # Split out of `settings:write` because it is not the same risk. Changing a
    # skill's wording is content; re-pricing XP rewrites what every star a child
    # already earned was worth. A parent may be given it, but is not handed it
    # with the role.
    #
    # The Gemini key used to sit beside this as `api_key:write`. It does not any
    # more: the key is the deployment's, not a family's, so it is governed by
    # `system:write` below and there is nothing here for a family to hold.
    "scoring:write",
    # Authoring the *shared* library — the SVG art every family draws from, and
    # anything else seeded for the whole deployment. Split out of
    # `settings:write` because the two are not the same act: a parent changing
    # `settings:write` changes their own family, while editing the art library
    # changes what every family on the service sees. That is an operator's job,
    # so this sits with the platform roles below and no family role holds it —
    # which is also why the Art entry vanished from a parent's sidebar.
    #
    # Reading is deliberately *not* split: every device has to load the art to
    # draw a lesson, so listing stays on `settings:read`.
    "content:write",
    "device:list",
    "device:revoke",
    # Platform account lifecycle. Kept separate from family membership roles:
    # an owner manages a household, while an admin manages the deployment's
    # sign-in accounts.
    "user:manage",
    # Defines platform roles and their permission sets. Like user management,
    # this is never grantable through a family membership.
    "role:manage",
    # Sidebar/menu administration is a platform concern, never a family
    # setting. Keeping it separate from settings:write prevents parents from
    # changing the navigation shown to everyone.
    "menu:manage",
    # The deployment's own switchboard — see `system_defaults.py`. Not in any
    # family role's set and not grantable to one: an owner runs their family,
    # an operator runs the service, and this is the service.
    "system:write",
}

#: What a child's device may do. Reads family settings, writes only its own
#: record — which is why Skills, Art and Menu are parent-only on a kid's tablet.
_CHILD = {
    "family:read",
    "learner:read",
    "learner_data:read",
    "learner_data:append",
    "settings:read",
    "device:list",
    "device:revoke",
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    # Signed up. Everything in the family — except rewriting a child's record,
    # and except the switchboard, which is not theirs however senior they are:
    # it governs every family on the deployment, not just this one.
    "owner": PERMISSIONS
    - {
        "learner_data:write",
        "system:write",
        "user:manage",
        "role:manage",
        "menu:manage",
        # The shared library belongs to the deployment, not to the most senior
        # adult in one household.
        "content:write",
    },
    # A second adult: everything except destroying or handing over the family,
    # and except the two the owner keeps — see `scoring:write` above. The Roles
    # page grants either to a particular parent when a family wants that.
    "parent": PERMISSIONS
    - {
        "family:delete",
        "family:transfer",
        "member:role",
        "member:remove",
        "learner_data:write",
        "scoring:write",
        "system:write",
        "user:manage",
        "role:manage",
        "menu:manage",
        "content:write",
    },
    # A grandparent or tutor: reads the children and their records, changes nothing.
    "caregiver": {
        "family:read",
        "member:list",
        "learner:read",
        "learner_data:read",
        "settings:read",
        "device:list",
    },
    "child": set(_CHILD),
    # An older learner with their own sign-in rather than a parent's device.
    # They own their own experience — settings, skills, their own record — but
    # nobody else's, and there are no children under them.
    "student": _CHILD
    | {
        "learner:update",
        "settings:write",
    },
}

PLATFORM_PERMISSIONS: dict[str, set[str]] = {
    "none": set(),
    # First line: account shape only. Enough to answer "can they sign in?".
    "support": {"family:read", "member:list", "device:list"},
    # Builds the product: skills, art, the menu, scoring. Content, never
    # children — a developer has no business in a learning record, and needing
    # one is what a grant is for.
    "developer": {
        "settings:read",
        "settings:write",
        "content:write",
        "scoring:write",
        "menu:manage",
    },
    # Runs the service: account lifecycle, devices, deletion requests — plus the
    # content a developer manages, because an operator has to be able to fix it.
    "admin": {
        "settings:read",
        "settings:write",
        "content:write",
        "scoring:write",
        "system:write",
        "family:read",
        "family:delete",
        "family:transfer",
        "member:list",
        "member:role",
        "member:remove",
        "learner:read",
        "learner:delete",
        "device:list",
        "device:revoke",
        "user:manage",
        "role:manage",
        "menu:manage",
    },
}

# Staff never hold these, whatever their platform role says. Reaching a child's
# record takes a time-boxed grant (P2.5), never a role.
GRANT_ONLY = {"learner_data:read", "learner_data:append", "learner_data:write"}


def canonical_role(role: str) -> str:
    """The current name for a role, so an old token still resolves."""
    return ROLE_ALIASES.get(role, role)


def role_can(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(canonical_role(role), set())


def platform_can(platform_role: str, permission: str) -> bool:
    if permission in GRANT_ONLY:
        return False
    return permission in PLATFORM_PERMISSIONS.get(platform_role, set())


def effective_permissions(
    role: str,
    extra: list[str] | None = None,
    denied: list[str] | None = None,
) -> set[str]:
    """What one person may actually do.

    The role is the base and stays the thing you reason about; the two lists are
    exceptions for the case a role cannot express — "this grandparent may edit
    lesson wording", "this parent must not change scoring". Unknown names are
    dropped rather than trusted, so a stale client cannot invent a permission.
    """
    allowed = set(ROLE_PERMISSIONS.get(canonical_role(role), set()))
    allowed |= {p for p in (extra or []) if p in PERMISSIONS}
    allowed -= {p for p in (denied or []) if p in PERMISSIONS}
    # The ones no row may hand out: rewriting a child's record, the deployment's
    # switchboard, account and role administration, and the shared content
    # library. A family membership cannot reach any of them.
    allowed -= {
        "learner_data:write",
        "system:write",
        "user:manage",
        "role:manage",
        # The shared library is the deployment's, not a family's — see above.
        "content:write",
    }
    return allowed
