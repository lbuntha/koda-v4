"""Request/response models for the admin feature."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class CreateUserIn(BaseModel):
    # Any built-in or custom role key (validated against the roles collection).
    role: str
    name: str
    email: EmailStr
    password: str = Field(min_length=8)


class UpdateUserIn(BaseModel):
    disabled: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    menu_ids: list[str] | None = None


class ResetPinIn(BaseModel):
    pin: str = Field(min_length=4, max_length=8)


class AdminUserOut(BaseModel):
    id: str
    role: str
    name: str
    email: str
    disabled: bool
    family_code: str | None = None
    child_count: int = 0
    menu_ids: list[str] = []


class AdminStudentOut(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    has_pin: bool
    guardians: list[str] = []
