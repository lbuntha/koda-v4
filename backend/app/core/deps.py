"""FastAPI dependencies: resolve the bearer token into a principal, load the
concrete User/Student, and gate endpoints by role."""

from dataclasses import dataclass

from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from ..models.user import User, Role
from ..models.student import Student
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


@dataclass
class Principal:
    id: str
    role: str


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, {"WWW-Authenticate": "Bearer"})


async def get_principal(token: str = Depends(oauth2_scheme)) -> Principal:
    try:
        payload = decode_token(token)
    except Exception:
        raise _unauthorized("Invalid or expired token")
    if payload.get("type") != "access":
        raise _unauthorized("Not an access token")
    sub, role = payload.get("sub"), payload.get("role")
    if not sub or not role:
        raise _unauthorized("Malformed token")
    return Principal(id=sub, role=role)


def require_role(*roles: str):
    async def checker(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return principal
    return checker


async def get_current_user(principal: Principal = Depends(get_principal)) -> User:
    if principal.role == Role.student.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Adult account required")
    user = await User.get(PydanticObjectId(principal.id))
    if not user:
        raise _unauthorized("Account not found")
    if user.disabled_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    return user


async def get_current_parent(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.parent:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Parent account required")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin account required")
    return user


async def get_current_author(user: User = Depends(get_current_user)) -> User:
    """Admin or teacher — the roles that author content.

    Distinct from `get_current_admin` because teachers author too, and distinct from
    `get_current_user` because authoring tools must not be reachable from a parent's or a
    child's token. A learner's device is the least trusted place a token lives.
    """
    if user.role not in (Role.admin, Role.teacher):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Authoring account required")
    return user


async def get_current_student(principal: Principal = Depends(get_principal)) -> Student:
    if principal.role != Role.student.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Student account required")
    student = await Student.get(PydanticObjectId(principal.id))
    if not student:
        raise _unauthorized("Student not found")
    return student
