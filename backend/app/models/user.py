"""Adult accounts: admin, teacher, parent (students live in student.py)."""

from datetime import datetime, timezone
from enum import Enum

from beanie import Document
from pydantic import EmailStr, Field
from pymongo import IndexModel


class Role(str, Enum):
    """The built-in (system) roles. Custom roles may also exist in the `roles`
    collection; a User.role is a free string keyed to a role definition."""

    admin = "admin"
    teacher = "teacher"
    parent = "parent"
    student = "student"  # students are the Student document, but share the key

    @classmethod
    def values(cls) -> set[str]:
        return {r.value for r in cls}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Document):
    role: str  # role key — a built-in Role or a custom role in the `roles` collection
    email: EmailStr
    password_hash: str
    name: str
    avatar: str | None = None
    # Parents get a short shareable code kids use for independent sign-in.
    family_code: str | None = None
    # Set to disable an account: it can no longer authenticate.
    disabled_at: datetime | None = None
    #: Set when the password changes. Refresh tokens issued before this are rejected, which
    #: is what makes a reset actually evict whoever else was signed in.
    credentials_changed_at: datetime | None = None
    # Extra menu ids granted to this specific user, on top of their role's menus.
    menu_ids: list[str] = Field(default_factory=list)
    # Personal notification preferences, one per feature a guardian can receive —
    # separate from the admin-level kill switches in SystemSettings, which control
    # whether the type exists at all. One field per feature rather than a shared
    # flag: a parent who wants the weekly summary but not the quiet-learner nudge
    # was previously forced to take both.
    email_digest_enabled: bool = True
    email_inactivity_enabled: bool = True
    email_announcements_enabled: bool = True
    # Built-in Mascot Studio starting points that this author has removed from
    # their picker. The presets remain shipped with the app, so keeping a
    # per-owner tombstone makes removal durable without mutating source data.
    hidden_mascot_preset_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "users"
        indexes = [
            IndexModel("email", unique=True),
            # Unique only among real (string) codes — many accounts have no
            # family_code (null), which a sparse index would wrongly collide on.
            IndexModel(
                "family_code",
                unique=True,
                partialFilterExpression={"family_code": {"$type": "string"}},
            ),
        ]
