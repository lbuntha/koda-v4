"""Protected platform roles shipped with every deployment."""

from app.security.policy import PLATFORM_PERMISSIONS

DEFAULT_PLATFORM_ROLES: list[dict] = [
    {
        "roleId": "core",
        "name": "Koda owner",
        "description": "Everything an Admin does, plus everyone's content and Koda's shared AI keys. Only an owner can make another.",
        "permissions": sorted(PLATFORM_PERMISSIONS["core"]),
        "builtIn": True,
    },
    {
        "roleId": "admin",
        "name": "Admin",
        "description": "Users, roles, settings and families; makes their own content with their own AI key.",
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
        "roleId": "creator",
        "name": "Content creator",
        "description": "Makes books, quizzes, Trace and art, and sees only their own.",
        "permissions": sorted(PLATFORM_PERMISSIONS["creator"]),
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
