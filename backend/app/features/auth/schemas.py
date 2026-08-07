"""Request/response models for the auth feature."""

from typing import Literal
from urllib.parse import unquote

from pydantic import BaseModel, EmailStr, Field, field_validator

from ..content.schemas import _validated_svg


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
    # Same values as signup: local ids, emoji, SVG-library artwork, and frozen remote art.
    avatar: str = Field(min_length=1, max_length=1_500_000)

    @field_validator("avatar")
    @classmethod
    def validate_signup_avatar(cls, avatar: str) -> str:
        if avatar.startswith("https://api.dicebear.com/7.x/"):
            return avatar
        if avatar.startswith("data:image/svg+xml"):
            if "," not in avatar:
                raise ValueError("SVG avatar data is malformed")
            _validated_svg(unquote(avatar.split(",", 1)[1]))
            return avatar
        if avatar.lstrip().lower().startswith("<svg"):
            _validated_svg(avatar)
            return avatar
        # Koda ids, legacy art keys, and emoji are short plain-text values rendered by React.
        if len(avatar) <= 64 and "://" not in avatar:
            return avatar
        raise ValueError("Avatar must be one of the supported signup choices")


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
