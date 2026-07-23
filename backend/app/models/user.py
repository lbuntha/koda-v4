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
    # Parents get a short shareable code kids use for independent sign-in.
    family_code: str | None = None
    # Set to disable an account: it can no longer authenticate.
    disabled_at: datetime | None = None
    # Extra menu ids granted to this specific user, on top of their role's menus.
    menu_ids: list[str] = Field(default_factory=list)
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
