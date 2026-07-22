"""Adult accounts: admin, teacher, parent (students live in student.py)."""

from datetime import datetime, timezone
from enum import Enum

from beanie import Document
from pydantic import EmailStr, Field
from pymongo import IndexModel


class Role(str, Enum):
    admin = "admin"
    teacher = "teacher"
    parent = "parent"
    student = "student"  # students are the Student document, but share the enum


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Document):
    role: Role
    email: EmailStr
    password_hash: str
    name: str
    # Parents get a short shareable code kids use for independent sign-in.
    family_code: str | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "users"
        indexes = [
            IndexModel("email", unique=True),
            IndexModel("family_code", unique=True, sparse=True),
        ]
