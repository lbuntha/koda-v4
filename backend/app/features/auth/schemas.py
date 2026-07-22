"""Request/response models for the auth feature."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RegisterIn(BaseModel):
    role: Literal["parent", "teacher", "admin"]
    email: EmailStr
    password: str = Field(min_length=8)
    name: str


class RefreshIn(BaseModel):
    refresh_token: str


class StudentLoginIn(BaseModel):
    family_code: str
    name: str
    pin: str


class LaunchIn(BaseModel):
    student_id: str
