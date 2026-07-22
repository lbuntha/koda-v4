"""Authentication: adult register/login/refresh + the two kid sign-in flows."""

import secrets
import string
from typing import Literal

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field

from ..models.user import User, Role
from ..models.student import Student
from ..auth.deps import Principal, get_principal, get_current_parent
from ..auth.security import (
    hash_secret,
    verify_secret,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_CODE_ALPHABET = string.ascii_uppercase + string.digits


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


def _issue(sub: str, role: str) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(sub, role),
        refresh_token=create_refresh_token(sub, role),
        role=role,
    )


async def _unique_family_code() -> str:
    for _ in range(10):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not await User.find_one(User.family_code == code):
            return code
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate family code")


# ── Adult accounts ───────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    role: Literal["parent", "teacher", "admin"]
    email: EmailStr
    password: str = Field(min_length=8)
    name: str


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn):
    if await User.find_one(User.email == body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        role=Role(body.role),
        email=body.email,
        password_hash=hash_secret(body.password),
        name=body.name,
    )
    if user.role == Role.parent:
        user.family_code = await _unique_family_code()
    await user.insert()
    return _issue(str(user.id), user.role.value)


@router.post("/login", response_model=TokenPair)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await User.find_one(User.email == form.username)
    if not user or not verify_secret(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _issue(str(user.id), user.role.value)


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshIn):
    try:
        payload = decode_token(body.refresh_token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not a refresh token")
    return _issue(payload["sub"], payload["role"])


@router.get("/me")
async def me(principal: Principal = Depends(get_principal)):
    if principal.role == Role.student.value:
        student = await Student.get(PydanticObjectId(principal.id))
        if not student:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
        return {"id": principal.id, "role": "student", "name": student.name, "avatar": student.avatar}
    user = await User.get(PydanticObjectId(principal.id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    return {
        "id": principal.id,
        "role": user.role.value,
        "name": user.name,
        "email": user.email,
        "family_code": user.family_code,
    }


# ── Kid sign-in ──────────────────────────────────────────────────────────────

class StudentLoginIn(BaseModel):
    family_code: str
    name: str
    pin: str


@router.post("/student/login", response_model=TokenPair)
async def student_login(body: StudentLoginIn):
    """Independent flow: kid signs in with the family code + their name + PIN."""
    parent = await User.find_one(
        User.family_code == body.family_code.upper(), User.role == Role.parent
    )
    if not parent:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown family code")
    student = await Student.find_one(
        Student.guardian_parent_ids == str(parent.id), Student.name == body.name
    )
    if not student or not student.pin_hash or not verify_secret(body.pin, student.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect name or PIN")
    return _issue(str(student.id), Role.student.value)


class LaunchIn(BaseModel):
    student_id: str


@router.post("/student/launch", response_model=TokenPair)
async def student_launch(body: LaunchIn, parent: User = Depends(get_current_parent)):
    """Parent-launched flow: a logged-in parent starts a session for their child."""
    try:
        student = await Student.get(PydanticObjectId(body.student_id))
    except Exception:
        student = None
    if not student or str(parent.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your child")
    return _issue(str(student.id), Role.student.value)
