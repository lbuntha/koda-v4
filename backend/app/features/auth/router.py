"""Authentication: adult register/login/refresh/reset + the two kid sign-in flows."""

from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from ...models.user import User, Role
from ...models.student import Student
from ...models.assignment import Assignment
from ...models.academic import Grade, resolve_layout_band
from ...core.deps import (
    Principal,
    get_principal,
    get_current_parent,
    get_current_student,
    get_current_user,
)
from ...core.codes import unique_family_code
from ...core.security import (
    hash_secret,
    verify_secret,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from ...core.logging import get_logger
from ...core.throttle import ADULT_LOGIN, STUDENT_PIN
from ..notifications.service import notify_pin_lockout
from .guard import address_scope, clear, enforce, note_failure
from . import reset as reset_service
from .schemas import (
    TokenPair, RegisterIn, RefreshIn, StudentLoginIn, StudentAvatarIn, LaunchIn,
    PasswordResetRequestIn, PasswordResetConfirmIn, ProfileUpdateIn,
)

#: Verified against nothing, purely to spend the same time as a real check when an account
#: does not exist. Without it, a fast rejection tells an attacker the address is unknown.
_DUMMY_HASH = hash_secret("timing-equalisation-placeholder")

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger("auth.router")


def _issue(sub: str, role: str) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(sub, role),
        refresh_token=create_refresh_token(sub, role),
        role=role,
    )


# ── Adult accounts ───────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn):
    if await User.find_one(User.email == body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        role=body.role,
        email=body.email,
        password_hash=hash_secret(body.password),
        name=body.name,
    )
    if user.role == Role.parent:
        user.family_code = await unique_family_code()
    await user.insert()
    return _issue(str(user.id), user.role)


@router.post("/login", response_model=TokenPair)
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends()):
    scopes = [(f"adult:{form.username.strip().lower()}", ADULT_LOGIN), address_scope(request)]
    await enforce(scopes)

    user = await User.find_one(User.email == form.username)
    # Always verify something: skipping the hash for an unknown address returns in a fraction
    # of the time and turns the endpoint into a way to discover who has an account.
    correct = verify_secret(form.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not correct:
        await note_failure(scopes)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if user.disabled_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    await clear([key for key, _ in scopes])
    return _issue(str(user.id), user.role)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshIn):
    try:
        payload = decode_token(body.refresh_token)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not a refresh token")
    # A valid signature was previously enough, so a disabled account — or one whose password
    # had just been reset — could refresh indefinitely.
    if payload.get("role") != Role.student.value:
        user = await User.get(payload["sub"])
        if not user or user.disabled_at is not None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
        issued_at = datetime.fromtimestamp(payload.get("iat", 0), tz=timezone.utc)
        changed_at = user.credentials_changed_at
        if changed_at:
            changed_at = changed_at if changed_at.tzinfo else changed_at.replace(tzinfo=timezone.utc)
            if issued_at < changed_at:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return _issue(payload["sub"], payload["role"])


async def _student_grade_band(student_id: str) -> str:
    """Resolve which student-page layout band this kid gets.

    Derived from the highest-priority active assignment's grade (grade_id maps to
    ``Grade.key``). Falls back to ``"student"`` (the neutral middle) when the kid
    has no active assignment or the grade is missing.
    """
    assignments = await Assignment.find(
        Assignment.student_id == student_id,
        Assignment.status == "active",
    ).sort("priority", "created_at").to_list()
    if not assignments:
        return "student"
    grade = await Grade.find_one(Grade.key == assignments[0].grade_id)
    return resolve_layout_band(grade) if grade else "student"


@router.get("/me")
async def me(principal: Principal = Depends(get_principal)):
    if principal.role == Role.student.value:
        student = await Student.get(PydanticObjectId(principal.id))
        if not student:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
        return {
            "id": principal.id,
            "role": "student",
            "name": student.name,
            "avatar": student.avatar,
            "gradeBand": await _student_grade_band(principal.id),
        }
    user = await User.get(PydanticObjectId(principal.id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    return {
        "id": principal.id,
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "avatar": getattr(user, "avatar", None),
        "family_code": user.family_code,
        "menu_ids": user.menu_ids,
        "email_digest_enabled": user.email_digest_enabled,
        "email_inactivity_enabled": user.email_inactivity_enabled,
        "email_announcements_enabled": user.email_announcements_enabled,
    }


@router.patch("/profile")
async def update_profile(body: ProfileUpdateIn, parent: User = Depends(get_current_user)):
    """Any signed-in adult edits their own record — admins and teachers have the same
    name/email/avatar/password needs as parents, and the dependency scopes every write
    to the caller, so this cannot touch another account."""
    if body.name is not None:
        parent.name = body.name.strip()
    if body.avatar is not None:
        parent.avatar = body.avatar
    if body.email is not None and body.email.strip().lower() != parent.email.lower():
        new_email = body.email.strip().lower()
        if await User.find_one(User.email == new_email):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
        parent.email = new_email
    if body.new_password:
        if not body.current_password or not verify_secret(body.current_password, parent.password_hash):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
        parent.password_hash = hash_secret(body.new_password)
        parent.credentials_changed_at = datetime.now(timezone.utc)
    await parent.save()
    return {
        "id": str(parent.id),
        "role": parent.role,
        "name": parent.name,
        "email": parent.email,
        "avatar": parent.avatar,
        "family_code": parent.family_code,
    }


@router.patch("/student/avatar")
async def update_student_avatar(body: StudentAvatarIn, student: Student = Depends(get_current_student)):
    """Let a signed-in learner use the same avatar choices offered during signup."""
    student.avatar = body.avatar
    await student.save()
    return {"avatar": student.avatar}


# ── Kid sign-in ──────────────────────────────────────────────────────────────

@router.post("/student/login", response_model=TokenPair)
async def student_login(request: Request, body: StudentLoginIn):
    """Independent flow: kid signs in with the family code + their name + PIN."""
    family_code = body.family_code.upper()
    # Counted per family + child name, so guessing one child's PIN cannot be spread across
    # siblings, and a locked child does not lock the whole household out.
    scopes = [
        (f"pin:{family_code}:{body.name.strip().lower()}", STUDENT_PIN),
        address_scope(request),
    ]
    await enforce(scopes)

    parent = await User.find_one(
        User.family_code == family_code, User.role == Role.parent
    )
    student = await Student.find_one(
        Student.guardian_parent_ids == str(parent.id), Student.name == body.name
    ) if parent else None
    correct = verify_secret(body.pin, student.pin_hash if student and student.pin_hash else _DUMMY_HASH)
    if not student or not student.pin_hash or not correct:
        newly_locked = await note_failure(scopes)
        # Only alert when a real child of a real family just got locked out — that is the case
        # worth telling a guardian about, and it keeps a wrong *name* from generating mail about
        # a child who does not exist. Notifying is best-effort: a mail failure must not turn a
        # failed sign-in into a 500, nor change the answer below.
        pin_scope = scopes[0][0]
        if student and parent and pin_scope in newly_locked:
            try:
                await notify_pin_lockout(parent, student, newly_locked[pin_scope])
            except Exception:
                logger.exception("pin lockout alert failed student_id=%s", student.id)
        # One message for every failure: an unknown family code, a wrong name and a wrong PIN
        # must be indistinguishable, or the endpoint enumerates households and children.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect family code, name, or PIN")
    await clear([key for key, _ in scopes])
    return _issue(str(student.id), Role.student.value)


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(request: Request, body: PasswordResetRequestIn):
    """Email a reset link, if that address has an account.

    Always answers the same way. Saying "no such account" here would turn the endpoint into a
    way to find out who is a customer, and the throttle keeps it from being swept.
    """
    address = body.email.strip().lower()
    scopes = [(f"reset:{address}", ADULT_LOGIN), address_scope(request)]
    await enforce(scopes)
    await note_failure(scopes)

    user = await User.find_one(User.email == address)
    if user and user.disabled_at is None:
        await reset_service.issue(user)
    return {"detail": "If that email has an account, a reset link is on its way."}


@router.post("/password-reset/confirm", response_model=TokenPair)
async def confirm_password_reset(request: Request, body: PasswordResetConfirmIn):
    scopes = [address_scope(request)]
    await enforce(scopes)

    user = await reset_service.consume(body.token)
    if not user:
        await note_failure(scopes)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired."
        )
    user.password_hash = hash_secret(body.password)
    # Evicts every session issued before now, including whoever else knew the old password.
    user.credentials_changed_at = datetime.now(timezone.utc)
    await user.save()
    # A locked-out parent who resets should be able to sign in straight away.
    await clear([f"adult:{str(user.email).lower()}", f"reset:{str(user.email).lower()}"])
    return _issue(str(user.id), user.role)


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
