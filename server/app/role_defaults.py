"""Protected platform roles shipped with every deployment."""

from app.security.policy import PLATFORM_PERMISSIONS

DEFAULT_PLATFORM_ROLES: list[dict] = [
    {
        "roleId": "admin",
        "name": "Admin",
        "description": "Full platform administration, users, roles, content, and settings.",
        "permissions": sorted(PLATFORM_PERMISSIONS["admin"]),
        "builtIn": True,
    },
    {
        "roleId": "developer",
        "name": "Developer",
        "description": "Builds and manages skills, art, menu content, and scoring.",
        "permissions": sorted(PLATFORM_PERMISSIONS["developer"]),
        "builtIn": True,
    },
    {
        "roleId": "support",
        "name": "Support",
        "description": "Read-only account, family, and device support access.",
        "permissions": sorted(PLATFORM_PERMISSIONS["support"]),
        "builtIn": True,
    },
]

DEFAULT_PLATFORM_ROLES_BY_ID = {role["roleId"]: role for role in DEFAULT_PLATFORM_ROLES}
