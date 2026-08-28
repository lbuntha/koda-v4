"""The family: who is in it, what they may do, and who may change that.

The permission table is served from here rather than duplicated in the client.
A screen that draws its own idea of the rules is a screen that will one day
disagree with the server — and the disagreement will always be discovered by
somebody being told they cannot do a thing the page just offered them.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import Conflict, Forbidden, NotFound, Unauthorized
from app.models.auth import Principal
from app.models.common import Model, now
from app.repos import devices, families, invites, learners, memberships, platform_roles, users
from app.security import passwords
from app.security import policy as rbac
from app.security.rate_limit import FAMILY_PIN_PER_FAMILY, INVITE_PER_IP, limiter
from app.services.codes import hash_code, new_code

# Every route here needs a signed-in caller; the permission each one needs
# is on the route itself.
router = APIRouter(prefix="/family", tags=["family"], dependencies=[AUTHENTICATED])

CanListMembers = Annotated[Principal, Depends(require("member:list"))]
CanSetRole = Annotated[Principal, Depends(require("member:role"))]
# `family:update` has sat in the permission table with no route behind it. The
# PIN is the first thing to need it: changing how the family itself is guarded
# is a property of the family, not of any one membership.
CanUpdateFamily = Annotated[Principal, Depends(require("family:update"))]
CanInvite = Annotated[Principal, Depends(require("member:invite"))]
CanRemove = Annotated[Principal, Depends(require("member:remove"))]

# What one adult may hand another from this screen. `owner` moves by
# transferring the family; `child` is not assigned at all — a child arrives with
# a join code on their own device, not by an adult picking a word from a list.
ASSIGNABLE_ROLES = ("parent", "caregiver", "student")


class MemberOut(Model):
    user_id: str = Field(alias="userId")
    email: str
    role: str
    is_you: bool = Field(alias="isYou")
    joined_at: str | None = Field(default=None, alias="joinedAt")
    # What the role gives, and the exceptions on top of it.
    permissions: list[str] = Field(default_factory=list)
    extra: list[str] = Field(default_factory=list)
    denied: list[str] = Field(default_factory=list)


class MembersOut(Model):
    family_id: str = Field(alias="familyId")
    family_name: str = Field(alias="familyName")
    members: list[MemberOut]


class RoleIn(Model):
    role: str


class RightsIn(Model):
    """Exceptions to the role, as the whole list each time.

    A whole list rather than add/remove operations: two people editing rights
    should not silently merge into a state neither of them chose, and a screen
    that shows checkboxes already knows the answer it wants.
    """

    extra: list[str] = Field(default_factory=list)
    denied: list[str] = Field(default_factory=list)


class MatrixOut(Model):
    """The §5 table, as the server actually holds it."""

    permissions: list[str]
    roles: dict[str, list[str]]
    platform_roles: dict[str, list[str]] = Field(alias="platformRoles")
    grant_only: list[str] = Field(alias="grantOnly")
    assignable_roles: list[str] = Field(alias="assignableRoles")


@router.get("/permissions")
async def permissions(db: Db, p: CurrentPrincipal) -> MatrixOut:
    """Readable by anyone signed in: it is the rules, not anyone's data."""
    return MatrixOut(
        permissions=sorted(rbac.PERMISSIONS),
        roles={role: sorted(perms) for role, perms in rbac.ROLE_PERMISSIONS.items()},
        platformRoles={
            role["roleId"]: sorted(role.get("permissions", []))
            for role in await platform_roles.all_roles(db)
        } | {"none": []},
        grantOnly=sorted(rbac.GRANT_ONLY),
        assignableRoles=list(ASSIGNABLE_ROLES),
    )


@router.get("/members")
async def list_members(db: Db, p: CanListMembers) -> MembersOut:
    if p.family_id is None:
        raise Forbidden("This account is not part of a family.", "no_family")

    family = await families.by_id(db, p.family_id)
    rows = await memberships.for_family(db, p.family_id)

    members = []
    for row in rows:
        user = await users.by_id(db, row["userId"])
        if not user:
            continue
        extra = row.get("extraPermissions") or []
        denied = row.get("deniedPermissions") or []
        members.append(
            MemberOut(
                userId=row["userId"],
                email=user["email"],
                role=row["role"],
                isYou=row["userId"] == p.subject_id,
                joinedAt=row["createdAt"].isoformat() if row.get("createdAt") else None,
                permissions=sorted(rbac.effective_permissions(row["role"], extra, denied)),
                extra=extra,
                denied=denied,
            )
        )

    return MembersOut(
        familyId=p.family_id,
        familyName=family["name"] if family else "",
        members=members,
    )


@router.patch("/members/{user_id}")
async def set_role(user_id: str, body: RoleIn, db: Db, p: CanSetRole) -> MemberOut:
    if p.family_id is None:
        raise Forbidden("This account is not part of a family.", "no_family")

    if body.role not in ASSIGNABLE_ROLES:
        # `owner` moves by transferring the family, not by editing a row — one
        # of those is a deliberate act with a confirmation, the other is a typo.
        raise Conflict(
            f"Role must be one of {', '.join(ASSIGNABLE_ROLES)}. "
            "Ownership moves by transferring the family, and a child signs in with a code.",
            "role_not_assignable",
        )

    current = await memberships.role_in(db, user_id, p.family_id)
    if current is None:
        raise NotFound("That person is not in this family.")
    if current == "owner":
        raise Conflict("The owner's role cannot be changed here.", "cannot_demote_owner")

    await memberships.set_role(db, user_id, p.family_id, body.role)
    user = await users.by_id(db, user_id)
    return MemberOut(
        userId=user_id,
        email=user["email"] if user else "",
        role=body.role,
        isYou=user_id == p.subject_id,
    )


@router.put("/members/{user_id}/rights")
async def set_rights(user_id: str, body: RightsIn, db: Db, p: CanSetRole) -> MemberOut:
    """Grant or withhold single permissions for one person.

    The role stays the thing you reason about — this is for the cases a role
    cannot express, like a grandparent who may edit lesson wording but still
    changes nothing else.
    """
    if p.family_id is None:
        raise Forbidden("This account is not part of a family.", "no_family")

    membership = await memberships.get(db, user_id, p.family_id)
    if membership is None:
        raise NotFound("That person is not in this family.")
    if membership["role"] == "owner":
        raise Conflict("The owner already has everything.", "owner_needs_no_rights")

    unknown = [x for x in (*body.extra, *body.denied) if x not in rbac.PERMISSIONS]
    if unknown:
        raise Conflict(f"Unknown permission: {unknown[0]}.", "unknown_permission")

    # Never grantable by hand, whatever a screen offers: rewriting a child's
    # record is nobody's, and a child's own device is not managed from here.
    forbidden = [x for x in body.extra if x in {"learner_data:write"}]
    if forbidden:
        raise Conflict(f"{forbidden[0]} cannot be granted to anyone.", "not_grantable")

    await memberships.set_rights(db, user_id, p.family_id, body.extra, body.denied)

    user = await users.by_id(db, user_id)
    return MemberOut(
        userId=user_id,
        email=user["email"] if user else "",
        role=membership["role"],
        isYou=user_id == p.subject_id,
        permissions=sorted(
            rbac.effective_permissions(membership["role"], body.extra, body.denied)
        ),
        extra=body.extra,
        denied=body.denied,
    )


# ---------------------------------------------------------------------------
# The parent PIN.
#
# What it is for, stated plainly so nobody mistakes it for more: a child who has
# been switched into on a shared tablet can open the account switcher and land
# back in their parent's session — billing, scoring, "remove child" — with one
# tap. This puts four digits in the way.
#
# What it is *not*: a cryptographic boundary. The parent's refresh token sits in
# the same `localStorage` the child's session can read, so a determined adult
# with the device is not stopped by this and is not meant to be. It is sized to
# the actual threat, which is a seven-year-old tapping. `routers/profile.py` is
# candid in the same way about reported-versus-observed figures; the honesty is
# the point, because a control described as more than it is gets trusted as
# more than it is.
# ---------------------------------------------------------------------------

PIN_LENGTH = 4


class PinIn(Model):
    pin: str = Field(min_length=PIN_LENGTH, max_length=PIN_LENGTH, pattern=r"^\d+$")


class PinStateOut(Model):
    is_set: bool = Field(alias="isSet")


def _caller_ip(request: Request) -> str:
    """Who to count an invite attempt against. Same reading as `auth._caller`."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _family_of(p: Principal) -> str:
    if p.family_id is None:
        raise Forbidden("This account is not part of a family.", "no_family")
    return p.family_id


@router.get("/pin")
async def pin_state(db: Db, p: CurrentPrincipal) -> PinStateOut:
    """Whether a PIN is set. Readable by anyone in the family, child included.

    A child's device has to know whether to *ask* — a switcher that prompts for
    a PIN nobody set, or silently switches past one that exists, is worse than
    either behaviour done consistently. Knowing one exists gives nothing away.
    """
    return PinStateOut(isSet=bool(await families.pin_hash_of(db, _family_of(p))))


@router.put("/pin", status_code=204)
async def set_pin(body: PinIn, db: Db, p: CanUpdateFamily) -> None:
    await families.set_pin(db, _family_of(p), passwords.hash_password(body.pin))


@router.delete("/pin", status_code=204)
async def clear_pin(db: Db, p: CanUpdateFamily) -> None:
    await families.clear_pin(db, _family_of(p))


@router.post("/pin/verify", status_code=204)
async def verify_pin(body: PinIn, db: Db, p: CurrentPrincipal) -> None:
    """Check a PIN. Deliberately callable by a child's session — that is who is
    being asked."""
    family_id = _family_of(p)
    await limiter.hit(db, "pin:family", family_id, FAMILY_PIN_PER_FAMILY)

    stored = await families.pin_hash_of(db, family_id)
    if not stored:
        # No PIN set is not a free pass and not an error: there is nothing to
        # verify, so the caller should not have asked. Saying so beats a 204
        # that a client would read as "correct".
        raise Conflict("This family has not set a PIN.", "pin_not_set")

    if not passwords.verify_password(stored, body.pin):
        raise Unauthorized("That PIN is not right.", "pin_invalid")

    await limiter.clear(db, "pin:family", family_id)


# ---------------------------------------------------------------------------
# Bringing a second adult in, and letting one go.
# ---------------------------------------------------------------------------

#: How long an invite stands. Long enough to reach somebody who is out for the
#: week, short enough that a code read aloud once is not a standing key.
INVITE_TTL = timedelta(days=7)

#: What an invite may make somebody. Not `owner` — that moves by transferring
#: the family — and not `child`, who arrives with a join code on their own
#: device rather than by an adult accepting an email's worth of text.
INVITABLE_ROLES = ("parent", "caregiver")


class InviteIn(Model):
    role: str = Field(default="parent")


class InviteOut(Model):
    id: str
    role: str
    expires_at: str = Field(alias="expiresAt")
    #: Only on the response that created it. It is never stored and never
    #: listed again — a code a screen can re-read is a code with no expiry.
    code: str | None = None


class RedeemIn(Model):
    code: str = Field(min_length=8, max_length=8)


class RedeemOut(Model):
    family_id: str = Field(alias="familyId")
    family_name: str = Field(alias="familyName")
    role: str


class FamilyIn(Model):
    name: str = Field(min_length=1, max_length=60)


@router.patch("")
async def rename_family(body: FamilyIn, db: Db, p: CanUpdateFamily) -> dict[str, str]:
    """Rename the family. The second thing `family:update` is good for."""
    row = await families.rename(db, _family_of(p), body.name)
    if not row:
        raise NotFound("No such family.")
    return {"familyId": row["_id"], "familyName": row["name"]}


@router.get("/invites")
async def list_invites(db: Db, p: CanInvite) -> dict[str, list[InviteOut]]:
    rows = await invites.outstanding(db, _family_of(p), now())
    return {
        "invites": [
            InviteOut(id=r["_id"], role=r["role"], expiresAt=r["expiresAt"].isoformat())
            for r in rows
        ]
    }


@router.post("/invites", status_code=201)
async def create_invite(body: InviteIn, db: Db, p: CanInvite) -> InviteOut:
    if body.role not in INVITABLE_ROLES:
        raise Conflict(
            f"An invite can make somebody {' or '.join(INVITABLE_ROLES)}. "
            "Ownership moves by transferring the family, and a child signs in with a code.",
            "role_not_invitable",
        )

    code = new_code()
    expires_at = now() + INVITE_TTL
    row = await invites.create(
        db,
        family_id=_family_of(p),
        code_hash=hash_code(code),
        role=body.role,
        created_by=p.subject_id,
        expires_at=expires_at,
    )
    return InviteOut(
        id=row["_id"], role=row["role"], expiresAt=expires_at.isoformat(), code=code
    )


@router.delete("/invites/{invite_id}", status_code=204)
async def revoke_invite(invite_id: str, db: Db, p: CanInvite) -> None:
    if not await invites.revoke(db, invite_id, _family_of(p)):
        raise NotFound("No such invite.")


@router.post("/invites/redeem")
async def redeem_invite(body: RedeemIn, db: Db, p: CurrentPrincipal, request: Request) -> RedeemOut:
    """Accept an invite, as somebody who already has an account.

    Signed in rather than public: an invite adds *a person* to a family, and the
    person has to exist first. So the flow is sign up, then redeem — which is
    also why the awkward case below has to be handled rather than refused.
    """
    await limiter.hit(db, "invite:ip", _caller_ip(request), INVITE_PER_IP)

    if p.kind != "user" or not p.subject_id:
        raise Forbidden("A child's device cannot accept an invite.", "not_an_account")

    invite = await invites.claim(db, hash_code(body.code.strip().upper()), now(), p.subject_id)
    if not invite:
        raise Unauthorized("That invite code is invalid, used or expired.", "invite_invalid")

    target = invite["familyId"]
    if p.family_id == target:
        raise Conflict("You are already in this family.", "already_a_member")

    # The awkward case, and it is the normal one.
    #
    # Signup always mints a family, so somebody invited as a second parent
    # arrives already owning an empty one. Refusing them would make the feature
    # unreachable; moving them blindly would strand whatever their old family
    # held. So: move them only when there is provably nothing to strand.
    if p.family_id:
        if await learners.for_family(db, p.family_id):
            raise Conflict(
                "Your current family has children in it. An account can only be in one "
                "family, so ask whoever invited you to invite a different email.",
                "family_not_empty",
            )
        others = [
            row for row in await memberships.for_family(db, p.family_id)
            if row["userId"] != p.subject_id
        ]
        if others:
            raise Conflict(
                "Somebody else is in your current family. An account can only be in one "
                "family, so ask whoever invited you to invite a different email.",
                "family_not_empty",
            )
        # Provably empty: no children, nobody else. The row is left behind
        # rather than deleted — an orphaned empty family costs nothing, and a
        # delete here would be the one destructive step in an accept flow.
        await memberships.remove(db, p.subject_id, p.family_id)

    await memberships.add(db, p.subject_id, target, role=invite["role"])
    # A refresh reads the family off the device row, so the sessions have to
    # move too or this person keeps being handed tokens for the family they left.
    await devices.reassign_family(db, p.subject_id, target)

    family = await families.by_id(db, target)
    return RedeemOut(
        familyId=target,
        familyName=(family or {}).get("name", ""),
        role=invite["role"],
    )


@router.delete("/members/{user_id}", status_code=204)
async def remove_member(user_id: str, db: Db, p: CanRemove) -> None:
    """Take somebody out of the family, and end what they were holding."""
    family_id = _family_of(p)

    if user_id == p.subject_id:
        # Removing yourself is a different act with different consequences —
        # possibly leaving a family with no adult in it — and it is not this one.
        raise Conflict("You cannot remove yourself from the family.", "cannot_remove_self")

    role = await memberships.role_in(db, user_id, family_id)
    if role is None:
        raise NotFound("That person is not in this family.")
    if role == "owner":
        raise Conflict("The owner cannot be removed. Transfer the family first.", "cannot_remove_owner")

    await memberships.remove(db, user_id, family_id)
    # Their sessions in *this* family only. An account that belongs somewhere
    # else keeps what it holds there.
    await devices.revoke_for_user_in_family(db, user_id, family_id)
