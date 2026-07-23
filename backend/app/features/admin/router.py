"""Admin-only account management. Guarded by get_current_admin; this is the only
path (besides seed.py) that can create an admin account."""

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...models.user import User, Role
from ...models.student import Student
from ...models.menu import RoleDef
from ...core.deps import get_current_admin
from ...core.codes import unique_family_code
from ...core.security import hash_secret
from .schemas import CreateUserIn, UpdateUserIn, ResetPinIn, AdminUserOut, AdminStudentOut

router = APIRouter(prefix="/admin", tags=["admin"])


async def _user_or_404(user_id: str) -> User:
    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        user = None
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


async def _student_or_404(student_id: str) -> Student:
    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


# ── Users (adults) ───────────────────────────────────────────────────────────

@router.get("/users", response_model=list[AdminUserOut])
async def list_users(_: User = Depends(get_current_admin)):
    users = await User.find_all().to_list()
    out: list[AdminUserOut] = []
    for u in users:
        child_count = 0
        if u.role == Role.parent:
            child_count = await Student.find(Student.guardian_parent_ids == str(u.id)).count()
        out.append(AdminUserOut(
            id=str(u.id), role=u.role, name=u.name, email=u.email,
            disabled=u.disabled_at is not None, family_code=u.family_code,
            child_count=child_count, menu_ids=u.menu_ids,
        ))
    return out


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUserIn, _: User = Depends(get_current_admin)):
    if await User.find_one(User.email == body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    # Role must be a built-in role or an existing custom role.
    if body.role not in Role.values() and not await RoleDef.find_one(RoleDef.key == body.role):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role: {body.role}")
    user = User(
        role=body.role,
        email=body.email,
        password_hash=hash_secret(body.password),
        name=body.name,
    )
    if user.role == Role.parent:
        user.family_code = await unique_family_code()
    await user.insert()
    return AdminUserOut(
        id=str(user.id), role=user.role, name=user.name, email=user.email,
        disabled=False, family_code=user.family_code, child_count=0, menu_ids=user.menu_ids,
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(user_id: str, body: UpdateUserIn, admin: User = Depends(get_current_admin)):
    user = await _user_or_404(user_id)
    if str(user.id) == str(admin.id) and body.disabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot disable your own account")
    if body.disabled is not None:
        user.disabled_at = datetime.now(timezone.utc) if body.disabled else None
    if body.password is not None:
        user.password_hash = hash_secret(body.password)
    if body.menu_ids is not None:
        user.menu_ids = body.menu_ids
    await user.save()
    child_count = await Student.find(Student.guardian_parent_ids == str(user.id)).count() if user.role == Role.parent else 0
    return AdminUserOut(
        id=str(user.id), role=user.role, name=user.name, email=user.email,
        disabled=user.disabled_at is not None, family_code=user.family_code,
        child_count=child_count, menu_ids=user.menu_ids,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, admin: User = Depends(get_current_admin)):
    user = await _user_or_404(user_id)
    if str(user.id) == str(admin.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")
    await user.delete()


# ── Students (kids) ──────────────────────────────────────────────────────────

@router.get("/students", response_model=list[AdminStudentOut])
async def list_students(_: User = Depends(get_current_admin)):
    students = await Student.find_all().to_list()
    # One lookup of all parents to resolve guardian names.
    parents = await User.find(User.role == Role.parent).to_list()
    name_by_id = {str(p.id): p.name for p in parents}
    return [
        AdminStudentOut(
            id=str(s.id), name=s.name, avatar=s.avatar, has_pin=s.pin_hash is not None,
            guardians=[name_by_id.get(gid, "—") for gid in s.guardian_parent_ids],
        )
        for s in students
    ]


@router.post("/students/{student_id}/reset-pin", response_model=AdminStudentOut)
async def reset_pin(student_id: str, body: ResetPinIn, _: User = Depends(get_current_admin)):
    student = await _student_or_404(student_id)
    student.pin_hash = hash_secret(body.pin)
    await student.save()
    return AdminStudentOut(
        id=str(student.id), name=student.name, avatar=student.avatar,
        has_pin=True, guardians=[],
    )


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(student_id: str, _: User = Depends(get_current_admin)):
    student = await _student_or_404(student_id)
    await student.delete()
