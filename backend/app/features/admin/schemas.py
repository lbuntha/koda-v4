"""Request/response models for the admin feature."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class CreateUserIn(BaseModel):
    # Any built-in or custom role key (validated against the roles collection).
    role: str
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    avatar: str | None = None


class UpdateUserIn(BaseModel):
    disabled: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    avatar: str | None = None
    menu_ids: list[str] | None = None


class ResetPinIn(BaseModel):
    pin: str = Field(min_length=4, max_length=8)


class AdminUserOut(BaseModel):
    id: str
    role: str
    name: str
    email: str
    avatar: str | None = None
    disabled: bool
    family_code: str | None = None
    child_count: int = 0
    menu_ids: list[str] = []


class PaginatedUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminStudentOut(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    has_pin: bool
    guardians: list[str] = []
    guardian_parent_ids: list[str] = []
