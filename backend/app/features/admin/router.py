"""Admin-only account management. Guarded by get_current_admin; this is the only
path (besides seed.py) that can create an admin account."""

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...models.user import User, Role
from ...models.student import Student
from ...models.menu import RoleDef
from ...core.deps import get_current_admin
from ...core.codes import unique_family_code
from ...core.security import hash_secret
from ...core.audit import record_audit
from .schemas import (
    CreateUserIn,
    UpdateUserIn,
    ResetPinIn,
    AdminUserOut,
    AdminStudentOut,
    PaginatedUsersOut,
)
from ..analytics.service import purge_learning_data

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

@router.get("/users", response_model=PaginatedUsersOut)
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    role: str | None = None,
    _: User = Depends(get_current_admin),
):
    filters = []
    if role and role != "all":
        filters.append(User.role == role)
    if search and search.strip():
        q = search.strip()
        filters.append({"$or": [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]})

    query = User.find(*filters) if filters else User.find_all()

    total = await query.count()
    total_pages = max(1, (total + limit - 1) // limit)
    skip = (page - 1) * limit

    users = await query.skip(skip).limit(limit).to_list()

    # 1 DB aggregation query to calculate child counts for all returned parents
    parent_ids = [str(u.id) for u in users if u.role == Role.parent]
    child_count_map: dict[str, int] = {}
    if parent_ids:
        pipeline = [
            {"$match": {"guardian_parent_ids": {"$in": parent_ids}}},
            {"$unwind": "$guardian_parent_ids"},
            {"$match": {"guardian_parent_ids": {"$in": parent_ids}}},
            {"$group": {"_id": "$guardian_parent_ids", "count": {"$sum": 1}}},
        ]
        counts = await Student.get_motor_collection().aggregate(pipeline).to_list(length=None)
        child_count_map = {item["_id"]: item["count"] for item in counts}

    items = [
        AdminUserOut(
            id=str(u.id),
            role=u.role,
            name=u.name,
            email=u.email,
            avatar=u.avatar,
            disabled=u.disabled_at is not None,
            family_code=u.family_code,
            child_count=child_count_map.get(str(u.id), 0),
            menu_ids=u.menu_ids,
        )
        for u in users
    ]

    return PaginatedUsersOut(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


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
        avatar=body.avatar,
    )
    if user.role == Role.parent:
        user.family_code = await unique_family_code()
    await user.insert()
    return AdminUserOut(
        id=str(user.id), role=user.role, name=user.name, email=user.email, avatar=user.avatar,
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
    if body.avatar is not None:
        user.avatar = body.avatar
    if body.menu_ids is not None:
        user.menu_ids = body.menu_ids
    await user.save()
    child_count = await Student.find(Student.guardian_parent_ids == str(user.id)).count() if user.role == Role.parent else 0
    return AdminUserOut(
        id=str(user.id), role=user.role, name=user.name, email=user.email, avatar=user.avatar,
        disabled=user.disabled_at is not None, family_code=user.family_code,
        child_count=child_count, menu_ids=user.menu_ids,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, admin: User = Depends(get_current_admin)):
    user = await _user_or_404(user_id)
    if str(user.id) == str(admin.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")

    # A parent's learner profiles must not become invisible orphans. Children shared
    # with another guardian stay intact; sole-guardian children are removed together
    # with all of their learning data through the same audited purge as manual deletion.
    if user.role == Role.parent:
        parent_id = str(user.id)
        children = await Student.find(Student.guardian_parent_ids == parent_id).to_list()
        for student in children:
            remaining_guardians = [
                guardian_id
                for guardian_id in student.guardian_parent_ids
                if guardian_id != parent_id
            ]
            if remaining_guardians:
                student.guardian_parent_ids = remaining_guardians
                await student.save()
                continue

            student_id = str(student.id)
            counts = await purge_learning_data(student_id, include_student=True)
            await record_audit(
                actor=admin,
                resource_type="student_data",
                action="child_profile_deleted_with_parent",
                owner_id=student_id,
                reason="Administrator deleted the learner's sole guardian account",
                summary={"studentId": student_id, "parentId": parent_id, "deletedCounts": counts},
            )
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
            guardian_parent_ids=[str(gid) for gid in s.guardian_parent_ids],
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
async def delete_student(student_id: str, admin: User = Depends(get_current_admin)):
    student = await _student_or_404(student_id)
    counts = await purge_learning_data(str(student.id), include_student=True)
    await record_audit(
        actor=admin,
        resource_type="student_data",
        action="child_profile_deleted",
        owner_id=student_id,
        reason="Administrator deleted child profile",
        summary={"studentId": student_id, "deletedCounts": counts},
    )
