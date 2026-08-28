"""Platform-wide user administration.

Family roles stay on `/family/members`; these routes manage the account around
those memberships: whether it may sign in, staff access, credentials, and the
rare deletion of an unowned staff account. Every operation is intentionally
admin-only through the dedicated `user:manage` permission.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import EmailStr, Field

from app.deps import AUTHENTICATED, Db, require
from app.errors import Conflict, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import devices, memberships, platform_roles, users
from app.security import passwords

router = APIRouter(prefix="/admin/users", tags=["admin users"], dependencies=[AUTHENTICATED])

CanManageUsers = Annotated[Principal, Depends(require("user:manage"))]
AccountStatus = Literal["active", "suspended"]
OnboardingStatus = Literal["pending", "completed", "blocked"]
MembershipRole = Literal["owner", "parent", "caregiver", "child", "student"]


class MembershipOut(Model):
    family_id: str = Field(alias="familyId")
    family_name: str = Field(alias="familyName")
    role: str
    #: What this family is actually on. Carried here so an operator looking at a
    #: person can see and change their plan without going to Billing and
    #: guessing which family name belongs to the email in front of them.
    plan_id: str = Field(default="free", alias="planId")
    plan_name: str = Field(default="Free", alias="planName")
    #: Whether a paid plan is being honoured — an expired grant is not.
    live: bool = False


class UserOut(Model):
    id: str
    email: str
    display_name: str | None = Field(default=None, alias="displayName")
    avatar_seed: str = Field(alias="avatarSeed")
    platform_role: str = Field(default="none", alias="platformRole")
    status: AccountStatus = "active"
    memberships: list[MembershipOut] = Field(default_factory=list)
    active_session_count: int = Field(default=0, alias="activeSessionCount")
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    last_login_at: str | None = Field(default=None, alias="lastLoginAt")
    is_you: bool = Field(default=False, alias="isYou")
    onboarding_status: OnboardingStatus = Field(alias="onboardingStatus")


class StatsOut(Model):
    total: int
    active: int
    suspended: int
    staff: int
    pending_onboarding: int = Field(alias="pendingOnboarding")
    completed_onboarding: int = Field(alias="completedOnboarding")
    blocked_onboarding: int = Field(alias="blockedOnboarding")


class UsersOut(Model):
    users: list[UserOut]
    page: int
    page_size: int = Field(alias="pageSize")
    total: int
    pages: int
    stats: StatsOut


class CreateUserIn(Model):
    email: EmailStr
    display_name: str | None = Field(default=None, max_length=80, alias="displayName")
    password: str = Field(min_length=8, max_length=200)
    platform_role: str = Field(min_length=1, max_length=50, alias="platformRole")


class UpdateUserIn(Model):
    email: EmailStr | None = None
    display_name: str | None = Field(default=None, max_length=80, alias="displayName")
    platform_role: str | None = Field(
        default=None, min_length=1, max_length=50, alias="platformRole"
    )
    status: AccountStatus | None = None


class PasswordIn(Model):
    password: str = Field(min_length=8, max_length=200)


class MembershipRoleIn(Model):
    role: MembershipRole


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _out(row: dict, current_id: str) -> UserOut:
    onboarding_status: OnboardingStatus = (
        "blocked"
        if row.get("status") == "suspended"
        else "completed"
        if row.get("lastLoginAt")
        else "pending"
    )
    return UserOut(
        id=row["_id"],
        email=row["email"],
        displayName=row.get("displayName"),
        avatarSeed=row.get("avatarSeed") or row["_id"],
        platformRole=row.get("platformRole", "none"),
        status=row.get("status", "active"),
        memberships=row.get("memberships", []),
        activeSessionCount=row.get("activeSessionCount", 0),
        createdAt=_iso(row.get("createdAt")),
        updatedAt=_iso(row.get("updatedAt")),
        lastLoginAt=_iso(row.get("lastLoginAt")),
        isYou=row["_id"] == current_id,
        onboardingStatus=onboarding_status,
    )


async def _full_user(db: Db, user_id: str) -> dict | None:
    row = await users.by_id(db, user_id)
    if not row:
        return None
    row["avatarSeed"] = await users.ensure_avatar_seed(db, user_id)
    member_rows = await memberships.for_user(db, user_id)
    family_ids = [item["familyId"] for item in member_rows]
    family_rows = (
        await db.families.find({"_id": {"$in": family_ids}}).to_list(length=50)
        if family_ids else []
    )
    names = {item["_id"]: item.get("name", "") for item in family_rows}
    row["memberships"] = [
        {
            "familyId": item["familyId"],
            "familyName": names.get(item["familyId"], ""),
            "role": item["role"],
        }
        for item in member_rows
    ]
    row["activeSessionCount"] = await db.devices.count_documents(
        {"userId": user_id, "revokedAt": None, "refreshHash": {"$type": "string"}}
    )
    return row


@router.get("")
async def listing(
    db: Db,
    p: CanManageUsers,
    q: Annotated[str, Query(max_length=100)] = "",
    account_status: Annotated[AccountStatus | None, Query(alias="status")] = None,
    role: Annotated[str | None, Query(max_length=30)] = None,
    onboarding: Annotated[OnboardingStatus | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=5, le=100)] = 25,
) -> UsersOut:
    rows, total = await users.list_for_admin(
        db, query=q, status=account_status, role=role, onboarding=onboarding,
        page=page, page_size=page_size,
    )
    for row in rows:
        row["avatarSeed"] = await users.ensure_avatar_seed(db, row["_id"])
    stats = await users.admin_stats(db)
    return UsersOut(
        users=[_out(row, p.subject_id) for row in rows],
        page=page,
        pageSize=page_size,
        total=total,
        pages=max(1, (total + page_size - 1) // page_size),
        stats=StatsOut(**stats),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUserIn, db: Db, p: CanManageUsers) -> UserOut:
    if await users.by_email(db, body.email):
        raise Conflict("That email already has an account.", "email_taken")
    if body.platform_role == "none" or not await platform_roles.by_id(db, body.platform_role):
        raise Conflict("Choose an existing platform role.", "unknown_platform_role")
    row = await users.create(
        db,
        body.email,
        passwords.hash_password(body.password),
        platform_role=body.platform_role,
        display_name=body.display_name,
    )
    row["memberships"] = []
    row["activeSessionCount"] = 0
    return _out(row, p.subject_id)


@router.patch("/{user_id}")
async def update_user(user_id: str, body: UpdateUserIn, db: Db, p: CanManageUsers) -> UserOut:
    target = await users.by_id(db, user_id)
    if not target:
        raise NotFound("No such user account.")

    patch: dict = {}
    if body.email is not None and body.email.lower() != target["email"]:
        existing = await users.by_email(db, body.email)
        if existing and existing["_id"] != user_id:
            raise Conflict("That email already has an account.", "email_taken")
        patch["email"] = body.email.lower()
    if body.display_name is not None:
        patch["displayName"] = body.display_name.strip() or None

    current_role = target.get("platformRole", "none")
    current_status = target.get("status", "active")
    next_role = body.platform_role or current_role
    next_status = body.status or current_status

    if user_id == p.subject_id and next_status != current_status:
        raise Conflict(
            "You cannot change your own account status.",
            "cannot_change_self_access",
        )

    if body.platform_role is not None and body.platform_role != current_role:
        if body.platform_role != "none" and not await platform_roles.by_id(db, body.platform_role):
            raise Conflict("Choose an existing platform role.", "unknown_platform_role")
        patch["platformRole"] = body.platform_role

    removes_active_admin = (
        current_role == "admin"
        and current_status == "active"
        and (next_role != "admin" or next_status != "active")
    )
    if removes_active_admin and await users.active_admin_count(db) <= 1:
        raise Conflict("At least one active administrator must remain.", "last_active_admin")

    if body.status is not None and body.status != current_status:
        patch["status"] = body.status

    if patch:
        await users.update_account(db, user_id, patch)
    if body.platform_role is not None and body.platform_role != current_role:
        await devices.revoke_all_for_user(db, user_id)
    if body.status == "suspended" and body.status != current_status:
        await devices.revoke_all_for_user(db, user_id)
    row = await _full_user(db, user_id)
    return _out(row, p.subject_id)


@router.patch("/{user_id}/memberships/{family_id}")
async def update_membership_role(
    user_id: str,
    family_id: str,
    body: MembershipRoleIn,
    db: Db,
    p: CanManageUsers,
) -> UserOut:
    target = await users.by_id(db, user_id)
    membership = await memberships.get(db, user_id, family_id)
    if not target or not membership:
        raise NotFound("No such family membership for this user.")

    current_role = membership.get("role", "parent")
    if current_role == "owner" and body.role != "owner":
        raise Conflict(
            "Transfer family ownership before changing the owner's role.",
            "cannot_demote_owner",
        )
    if current_role != "owner" and body.role == "owner":
        raise Conflict(
            "Ownership must be transferred so the family keeps exactly one owner.",
            "ownership_requires_transfer",
        )
    if body.role != current_role:
        await memberships.set_role(db, user_id, family_id, body.role)
        await devices.revoke_all_for_user(db, user_id)

    row = await _full_user(db, user_id)
    return _out(row, p.subject_id)


@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(user_id: str, body: PasswordIn, db: Db, p: CanManageUsers) -> None:
    if not await users.set_password(db, user_id, passwords.hash_password(body.password)):
        raise NotFound("No such user account.")
    await devices.revoke_all_for_user(db, user_id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, db: Db, p: CanManageUsers) -> None:
    target = await users.by_id(db, user_id)
    if not target:
        raise NotFound("No such user account.")
    if user_id == p.subject_id:
        raise Conflict("You cannot delete the account you are using.", "cannot_delete_self")
    if await memberships.for_user(db, user_id):
        raise Conflict(
            "This account belongs to a family. Suspend it here or remove its membership first.",
            "user_has_family",
        )
    if (
        target.get("platformRole") == "admin"
        and target.get("status", "active") == "active"
        and await users.active_admin_count(db) <= 1
    ):
        raise Conflict("At least one active administrator must remain.", "last_active_admin")
    if not await users.delete_account(db, user_id):
        raise NotFound("No such user account.")
