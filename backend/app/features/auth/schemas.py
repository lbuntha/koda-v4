"""Request/response models for the auth feature."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RegisterIn(BaseModel):
    # Public sign-up is parent/teacher only. Admins are created by another admin
    # (POST /admin/users) or the seed script — never through this endpoint.
    role: Literal["parent", "teacher"]
    email: EmailStr
    password: str = Field(min_length=8)
    name: str


class RefreshIn(BaseModel):
    refresh_token: str


class StudentLoginIn(BaseModel):
    family_code: str
    name: str
    pin: str


class StudentAvatarIn(BaseModel):
    avatar: Literal[
        "koda-kid:boy-sky",
        "koda-kid:boy-mint",
        "koda-kid:boy-sun",
        "koda-kid:boy-violet",
        "koda-kid:girl-rose",
        "koda-kid:girl-mint",
        "koda-kid:girl-sun",
        "koda-kid:girl-violet",
    ]


class LaunchIn(BaseModel):
    student_id: str


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=16, max_length=200)
    #: Same floor as registration — a reset must not be a way to weaken a password.
    password: str = Field(min_length=8, max_length=200)


class ProfileUpdateIn(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    avatar: str | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8)
