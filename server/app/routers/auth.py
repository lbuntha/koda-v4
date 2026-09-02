"""Signing in: people by password, child devices by refresh token.

A child never appears here — they arrive with a join code (P2), which mints the
same device row this module does.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import Conflict, Forbidden, NotFound, Unauthorized
from app.models.auth import (
    AvatarIn,
    AvatarOut,
    EmailVerificationIn,
    EmailVerificationPending,
    EmailVerificationResendIn,
    ForgotIn,
    GoogleAuthIn,
    JoinIn,
    LoginIn,
    MeOut,
    PasswordChangeIn,
    PasswordChangeOut,
    Principal,
    ProfileIn,
    RefreshIn,
    ResetIn,
    SignupIn,
    SwitchIn,
    TokenPair,
)
from app.models.common import now
from app.repos import devices, families, learners, memberships, platform_roles, users
from app.repos import system as system_repo
from app.security import passwords, tokens
from app.security import policy as rbac
from app.security.rate_limit import (
    FORGOT_PER_ACCOUNT,
    FORGOT_PER_IP,
    JOIN_CODE_PER_IP,
    JOIN_CODE_PER_VALUE,
    LOGIN_PER_ACCOUNT,
    LOGIN_PER_IP,
    SIGNUP_PER_IP,
    VERIFY_RESEND_PER_ACCOUNT,
    VERIFY_RESEND_PER_IP,
    VERIFY_TOKEN_PER_IP,
    limiter,
)
from app.services import google_identity, mail, push
from app.services.codes import hash_code
from app.settings import settings

# Deliberately *not* guarded as a whole: signup, login and refresh are how a
# caller gets a token in the first place. The two routes that need one say so
# individually, which is the only place in the service that happens.
router = APIRouter(prefix="/auth", tags=["auth"])

CanSwitchLearner = Annotated[Principal, Depends(require("learner:read"))]


async def _issue(db, family_id: str | None, role: str, *, user_id=None, learner_id=None,
                 device_name="This device", device_id=None, platform_role="none",
                 extra=None, denied=None, install_id=None) -> TokenPair:
    refresh, refresh_hash = tokens.new_refresh_token()

    # Signing in again on a machine that has signed in before rotates the row it
    # already has. Without this every sign-in wrote another one, so a device list
    # showed one laptop a dozen times and the tablet somebody actually lost could
    # not be picked out of it.
    if device_id is None and install_id:
        existing = await devices.live_install(
            db, install_id, user_id=user_id, learner_id=learner_id
        )
        if existing:
            device_id = existing["_id"]

    if device_id is None:
        device = await devices.register(
            db,
            family_id=family_id,
            name=device_name,
            kind="user" if user_id else "child",
            refresh_hash=refresh_hash,
            user_id=user_id,
            learner_id=learner_id,
            install_id=install_id,
        )
        device_id = device["_id"]
        # A *new* row, not a rotation: this is a machine the family has not
        # signed in from before, which is the one thing about a sign-in worth
        # telling somebody. Signing in again on a tablet they use every day is
        # not news, and a notification for it would teach a parent to ignore
        # the ones that matter.
        #
        # Awaited rather than handed to a background task: on the console driver
        # it is a log line, and the sign-in it sits inside already spends far
        # longer hashing a password. If the real driver ever makes a login feel
        # slow, this is the call that moves to `BackgroundTasks` at the route.
        if family_id:
            await push.send(
                db,
                to=push.Recipient(family_id=family_id, exclude_device_id=device_id),
                kind="device.new_signin",
                title="New device signed in",
                body=f"{device_name} just signed in to Koda.",
                # The device list, once the app can be opened at a screen. It is
                # a tab in state today, so every deep link lands on the default
                # one — the client half of that is the notifications phase.
                path="/",
            )
    else:
        await devices.rotate(db, device_id, refresh_hash)

    permissions = rbac.effective_permissions(role, extra, denied) if family_id else set()
    # Platform roles belong to staff accounts. A family member may have a
    # stale or administrative platformRole field, but signing in through a
    # family must never turn that into deployment-wide access.
    if family_id is None:
        permissions |= await platform_roles.permissions_for(db, platform_role)
    permissions = sorted(permissions)

    principal = Principal(
        subject_id=user_id or device_id,
        kind="user" if user_id else "device",
        family_id=family_id,
        role=role,
        learner_id=learner_id,
        device_id=device_id,
        platform_role=platform_role,
        permissions=permissions,
    )
    access, expires_in = tokens.issue_access(principal)
    return TokenPair(
        accessToken=access,
        refreshToken=refresh,
        expiresIn=expires_in,
        deviceId=device_id,
        familyId=family_id,
        role=role,
        platformRole=platform_role,
        permissions=permissions,
    )


async def _issue_for_user(db, user: dict, *, device_name: str, install_id: str | None) -> TokenPair:
    """Turn an authenticated user into the same Koda session, however they signed in."""
    rows = await memberships.for_user(db, user["_id"])
    platform_role = user.get("platformRole", "none")

    if rows:
        membership = rows[0]
        return await _issue(
            db,
            membership["familyId"],
            membership["role"],
            user_id=user["_id"],
            device_name=device_name,
            install_id=install_id,
            platform_role=platform_role,
            extra=membership.get("extraPermissions"),
            denied=membership.get("deniedPermissions"),
        )

    if platform_role != "none":
        return await _issue(
            db,
            None,
            platform_role,
            user_id=user["_id"],
            device_name=device_name,
            install_id=install_id,
            platform_role=platform_role,
        )

    raise Unauthorized("That account is not part of a family yet.", "no_family")


async def _send_verification(db, user: dict) -> bool:
    """Replace the outstanding token and send its one-time link."""
    cfg = settings()
    raw, hashed = tokens.new_refresh_token()
    expires = now() + timedelta(hours=cfg.email_verification_ttl_hours)
    await users.set_verification_token(db, user["_id"], hashed, expires)
    link = f"{cfg.app_base_url}/verify-email?token={raw}"
    return await mail.send(
        user["email"],
        "Verify your Koda email",
        (
            "Welcome to Koda. Confirm that this email belongs to you by opening "
            f"this link:\n\n{link}\n\n"
            f"The link works once and expires in {cfg.email_verification_ttl_hours} hours.\n\n"
            "If you did not create this account, you can ignore this message."
        ),
    )


def _name_from_email(email: str) -> str:
    """Something to call a student until they rename themselves.

    The local part, tidied: "alex.rivera@example.com" becomes "Alex Rivera".
    Not clever, and it does not need to be — it is a placeholder on a profile
    the person owns and can edit from the moment they arrive.
    """
    local = email.split("@")[0]
    words = [w for w in local.replace(".", " ").replace("_", " ").replace("-", " ").split() if w]
    return " ".join(w.capitalize() for w in words)[:80] or "Me"


def _caller(request: Request) -> str:
    """Who to count against. Behind a proxy this is the proxy unless it
    forwards — so the header is read, and the socket is the fallback."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/join")
async def join(body: JoinIn, db: Db, request: Request) -> TokenPair:
    normalized = body.code.strip().upper()
    await limiter.hit(db, "join:ip", _caller(request), JOIN_CODE_PER_IP)
    await limiter.hit(db, "join:code", hash_code(normalized), JOIN_CODE_PER_VALUE)
    learner = await learners.claim_code(db, hash_code(normalized), now())
    if not learner:
        raise Unauthorized("That child code is invalid or has expired.", "join_code_invalid")
    return await _issue(
        db,
        learner["familyId"],
        "child",
        learner_id=learner["_id"],
        device_name=body.device_name,
        install_id=body.install_id,
    )


@router.post("/switch/{learner_id}")
async def switch_to_learner(
    learner_id: str, db: Db, p: CanSwitchLearner, body: SwitchIn | None = None
) -> TokenPair:
    if p.family_id is None or p.learner_id:
        raise Forbidden("Only a family account can switch to a child.", "child_switch_forbidden")
    learner = await learners.by_id(db, learner_id, p.family_id)
    if not learner:
        raise NotFound("No such child.")
    # The install matters here as much as it does at sign-in, and for longer:
    # a parent opening their child on the family tablet does this every day, so
    # a switch that identified nothing wrote a fresh "This device" row every
    # time — the single largest source of the rows this list drowned in.
    body = body or SwitchIn()
    return await _issue(
        db,
        p.family_id,
        "child",
        learner_id=learner_id,
        device_name=body.device_name,
        install_id=body.install_id,
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupIn, db: Db, request: Request
) -> TokenPair | EmailVerificationPending:
    await limiter.hit(db, "signup:ip", _caller(request), SIGNUP_PER_IP)

    # The deployment's own switch, not a family's. Checked before the email is
    # even looked up, so a closed deployment does not confirm which addresses
    # already have accounts.
    if not await system_repo.value_of(db, "account.signupOpen", True):
        raise Forbidden("This deployment is not accepting new accounts.", "signup_closed")

    if await users.by_email(db, body.email):
        raise Conflict("That email already has an account. Sign in instead.", "email_taken")

    verification_required = settings().require_email_verification
    user = await users.create(
        db,
        body.email,
        passwords.hash_password(body.password),
        email_verified=not verification_required,
    )
    fallback_name = "My family" if body.account_type == "parent" else "My learning space"
    family_name = body.family_name or fallback_name
    family = await families.create(db, family_name, owner_id=user["_id"])
    role = "owner" if body.account_type == "parent" else "student"
    await memberships.add(db, user["_id"], family["_id"], role=role)

    # A student is their own learner, and needs the row to prove it.
    #
    # Without one they had a `learnerId` of `None`, and every learner-scoped
    # thing in the service quietly had nowhere to go: progress and the daily
    # goal fell back to a per-device id, `childSettings` could not be written
    # for them at all, and `/sync/profile` had no subject. The role existed and
    # almost nothing behind it did.
    #
    # A parent gets no row here on purpose — an adult managing a household is
    # not a learner, and their children get rows of their own when they are
    # added.
    learner_id = None
    if role == "student":
        learner = await learners.create(db, family["_id"], _name_from_email(body.email))
        learner_id = learner["_id"]

    if verification_required:
        sent = await _send_verification(db, user)
        return EmailVerificationPending(email=body.email, emailSent=sent)

    return await _issue(db, family["_id"], role, user_id=user["_id"],
                        learner_id=learner_id, device_name=body.device_name,
                        install_id=body.install_id)


@router.post("/email/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_verification(
    body: EmailVerificationResendIn, db: Db, request: Request
) -> None:
    """Send a fresh link without revealing whether the address is registered."""
    await limiter.hit(db, "verify:ip", _caller(request), VERIFY_RESEND_PER_IP)
    await limiter.hit(
        db, "verify:email", body.email.lower(), VERIFY_RESEND_PER_ACCOUNT
    )
    user = await users.by_email(db, body.email)
    if not user or user.get("status", "active") == "suspended":
        return
    # Missing means a legacy account that predates verification and remains
    # valid. A timestamp means it has already completed the flow.
    if "emailVerifiedAt" not in user or user.get("emailVerifiedAt") is not None:
        return
    await _send_verification(db, user)


@router.post("/email/verify")
async def verify_email(
    body: EmailVerificationIn, db: Db, request: Request
) -> TokenPair:
    await limiter.hit(db, "verify:token:ip", _caller(request), VERIFY_TOKEN_PER_IP)
    user = await users.verify_email_token(db, tokens.hash_refresh(body.token), now())
    if not user:
        raise Unauthorized(
            "That verification link has expired or has already been used.",
            "verification_invalid",
        )
    await limiter.clear(db, "verify:email", user["email"].lower())
    await users.touch_login(db, user["_id"])
    return await _issue_for_user(
        db, user, device_name=body.device_name, install_id=body.install_id
    )


@router.post("/login")
async def login(body: LoginIn, db: Db, request: Request) -> TokenPair:
    # Two windows: one machine grinding through accounts, and a distributed
    # attempt at one account. Either alone leaves the other open.
    await limiter.hit(db, "login:ip", _caller(request), LOGIN_PER_IP)
    await limiter.hit(db, "login:email", body.email.lower(), LOGIN_PER_ACCOUNT)

    user = await users.by_email(db, body.email)
    # Same message either way: which half was wrong is not the caller's business.
    if not user or not user.get("passwordHash") or not passwords.verify_password(user["passwordHash"], body.password):
        raise Unauthorized("That email and password do not match.", "bad_credentials")
    if user.get("status", "active") == "suspended":
        raise Forbidden("This account is suspended. Contact an administrator.", "account_suspended")
    if "emailVerifiedAt" in user and user.get("emailVerifiedAt") is None:
        raise Forbidden(
            "Verify your email before signing in. You can request a new link from the sign-in screen.",
            "email_not_verified",
        )

    # A correct password clears the budget, so a person who mistyped twice and
    # then got it right is not still counted against on their next sign-in.
    await limiter.clear(db, "login:email", body.email.lower())

    await users.touch_login(db, user["_id"])
    return await _issue_for_user(
        db, user, device_name=body.device_name, install_id=body.install_id
    )


def _google_controls_email(claims: dict) -> bool:
    """Whether Google remains authoritative for the address in this token."""
    email = str(claims.get("email", "")).lower()
    return email.endswith("@gmail.com") or bool(claims.get("hd"))


@router.post("/google")
async def google_auth(body: GoogleAuthIn, db: Db, request: Request) -> TokenPair:
    """Exchange a verified Google identity for Koda's normal token pair."""
    cfg = settings()
    if not cfg.google_client_id:
        raise Forbidden("Google sign-in is not configured.", "google_not_configured")

    # Token verification performs a public-key lookup and is synchronous, so it
    # belongs off the event loop. Limit the caller first so it cannot be used as
    # an unlimited verification proxy.
    await limiter.hit(db, "google:ip", _caller(request), LOGIN_PER_IP)
    try:
        claims = await run_in_threadpool(
            google_identity.verify, body.credential, cfg.google_client_id
        )
    except (ValueError, TypeError):
        raise Unauthorized(
            "Google sign-in could not be verified.", "google_token_invalid"
        ) from None

    subject = claims.get("sub")
    email = str(claims.get("email", "")).strip().lower()
    if not subject or not email or claims.get("email_verified") is not True:
        raise Unauthorized(
            "Google did not provide a verified email address.", "google_email_unverified"
        )

    await limiter.hit(db, "google:account", str(subject), LOGIN_PER_ACCOUNT)
    user = await users.by_google_sub(db, str(subject))

    if not user:
        user = await users.by_email(db, email)
        if user:
            # Gmail and Workspace addresses remain controlled by Google. For a
            # third-party address Google only knows it was verified sometime in
            # the past, so silently linking it could join the wrong account.
            if not _google_controls_email(claims):
                raise Conflict(
                    "That email already has a Koda account. Sign in with its password instead.",
                    "google_link_required",
                )
            linked = await users.link_google(db, user["_id"], str(subject))
            if not linked:
                raise Conflict(
                    "That Koda account is already connected to another Google account.",
                    "google_identity_conflict",
                )
        else:
            if not body.create_account:
                raise NotFound(
                    "No Koda account uses this Google account. Choose Create account first.",
                    "google_account_missing",
                )
            if not await system_repo.value_of(db, "account.signupOpen", True):
                raise Forbidden(
                    "This deployment is not accepting new accounts.", "signup_closed"
                )

            display_name = str(claims.get("name", "")).strip()[:80] or None
            user = await users.create(
                db,
                email,
                None,
                display_name=display_name,
                google_sub=str(subject),
            )
            family = await families.create(
                db, body.family_name or "My family", owner_id=user["_id"]
            )
            await memberships.add(db, user["_id"], family["_id"], role="owner")

    if user.get("status", "active") == "suspended":
        raise Forbidden(
            "This account is suspended. Contact an administrator.", "account_suspended"
        )

    await limiter.clear(db, "google:account", str(subject))
    await users.touch_login(db, user["_id"])
    return await _issue_for_user(
        db, user, device_name=body.device_name, install_id=body.install_id
    )


#: How long a reset link works. Long enough to walk to another device and read
#: the mail; short enough that a message left open in an inbox is not a standing
#: key to the account.
RESET_TTL = timedelta(minutes=30)


@router.post("/password/forgot", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(body: ForgotIn, db: Db, request: Request) -> None:
    """Send a reset link, if that address has an account.

    **Always 204**, whatever happens. The signup route already takes care not to
    confirm which addresses have accounts, and this is the same rule: a
    different answer for a known address turns this endpoint into a way to
    enumerate every family on the deployment.

    That also means a failure to send is silent to the caller. It is logged, and
    the person can ask again — which is the right trade for not leaking.
    """
    await limiter.hit(db, "forgot:ip", _caller(request), FORGOT_PER_IP)
    await limiter.hit(db, "forgot:email", body.email.lower(), FORGOT_PER_ACCOUNT)

    user = await users.by_email(db, body.email)
    if not user or user.get("status", "active") == "suspended":
        return

    token, token_hash = tokens.new_refresh_token()
    await users.set_reset_token(db, user["_id"], token_hash, now() + RESET_TTL)

    link = f"{settings().app_base_url}/reset?token={token}"
    await mail.send(
        user["email"],
        "Reset your Koda password",
        (
            "Somebody asked to reset the password on this Koda account.\n\n"
            f"Open this link to choose a new one:\n{link}\n\n"
            "The link works once and expires in 30 minutes.\n\n"
            "If this was not you, nothing has changed and you can ignore this "
            "message — your password still works."
        ),
    )


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(body: ResetIn, db: Db, request: Request) -> None:
    """Spend a reset token for a new password.

    Every session ends, and this one is not spared — unlike a deliberate change
    by somebody who knows their current password. A reset is what you do when
    you think another person has your account, so anything already signed in is
    exactly what has to go.
    """
    await limiter.hit(db, "reset:ip", _caller(request), FORGOT_PER_IP)

    user = await users.by_reset_token(db, tokens.hash_refresh(body.token), now())
    if not user:
        raise Unauthorized("That reset link has expired or has already been used.", "reset_invalid")

    await users.set_password(db, user["_id"], passwords.hash_password(body.new_password))
    # Single use, and spent whether or not anything below it succeeds.
    await users.clear_reset_token(db, user["_id"])
    await devices.revoke_all_for_user(db, user["_id"])


@router.post("/token", include_in_schema=True)
async def token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Db,
    request: Request,
) -> dict:
    """The same sign-in, form-encoded, for the Swagger Authorize box.

    Exists so a developer reading /docs can sign in there rather than pasting a
    token. `username` is the email — the field name is fixed by the form spec,
    not by us. The app itself uses `/auth/login`.
    """
    pair = await login(
        LoginIn(email=form.username, password=form.password, deviceName="API docs"),
        db,
        request,
    )
    return {
        "access_token": pair.access_token,
        "token_type": "bearer",
        "expires_in": pair.expires_in,
        "refresh_token": pair.refresh_token,
    }


@router.post("/refresh")
async def refresh(body: RefreshIn, db: Db) -> TokenPair:
    device = await devices.by_refresh_hash(db, tokens.hash_refresh(body.refresh_token))
    if not device:
        raise Unauthorized("Please sign in again.", "refresh_invalid")

    # A refresh token is opaque, so its lifetime cannot live inside it the way
    # an access token's does — the only record of its age is when the row it
    # rotates was last seen. Checked here because this is the sole place one is
    # spent: without it `refresh_ttl_days` was a setting nothing read, sessions
    # never ended on their own, and a device list was a list of forever.
    last_seen = device.get("lastSeenAt")
    if last_seen and last_seen < devices.stale_before():
        await devices.revoke(db, device["_id"])
        raise Unauthorized("That session has expired. Sign in again.", "refresh_expired")

    role = "child"
    platform_role = "none"
    extra: list[str] | None = None
    denied: list[str] | None = None
    if device.get("userId"):
        user = await users.by_id(db, device["userId"])
        if not user or user.get("status", "active") == "suspended":
            await devices.revoke(db, device["_id"])
            raise Unauthorized("This account is no longer active.", "account_suspended")
        platform_role = (user or {}).get("platformRole", "none")
        if device.get("familyId"):
            membership = await memberships.get(db, device["userId"], device["familyId"])
            role = (membership or {}).get("role", "parent")
            extra = (membership or {}).get("extraPermissions")
            denied = (membership or {}).get("deniedPermissions")
        else:
            role = platform_role

    # Rotation: the presented token dies as the new one is written.
    return await _issue(db, device.get("familyId"), role, user_id=device.get("userId"),
                        learner_id=device.get("learnerId"), device_id=device["_id"],
                        platform_role=platform_role, extra=extra, denied=denied)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[AUTHENTICATED])
async def logout(p: CurrentPrincipal, db: Db) -> None:
    if p.device_id:
        await devices.revoke(db, p.device_id)


@router.get("/me", dependencies=[AUTHENTICATED])
async def me(p: CurrentPrincipal, db: Db) -> MeOut:
    family = await families.by_id(db, p.family_id) if p.family_id else None
    user = await users.by_id(db, p.subject_id) if p.kind == "user" else None
    learner = (
        await learners.by_id(db, p.learner_id, p.family_id)
        if p.learner_id and p.family_id
        else None
    )
    avatar_seed = (
        await users.ensure_avatar_seed(db, user["_id"])
        if user
        else await learners.ensure_avatar_seed(db, learner["_id"], p.family_id)
        if learner and p.family_id
        else f"a_{p.subject_id}"
    )
    # A child joined when their profile was made; everybody else when their
    # account was. Absent only for a device with neither, which cannot happen
    # behind AUTHENTICATED but is typed as possible.
    joined = (learner or user or {}).get("createdAt")
    return MeOut(
        joinedAt=joined.isoformat() if joined else None,
        userId=user["_id"] if user else None,
        email=user["email"] if user else None,
        displayName=user.get("displayName") if user else None,
        avatarSeed=avatar_seed,
        familyId=p.family_id,
        familyName=family["name"] if family else None,
        role=p.role,
        platformRole=p.platform_role,
        learnerId=p.learner_id,
        learnerName=learner["displayName"] if learner else None,
        learnerBirthYear=learner.get("birthYear") if learner else None,
        permissions=(
            p.permissions
            if p.permissions is not None
            else sorted(rbac.effective_permissions(p.role))
        ),
    )


@router.patch("/me/avatar", dependencies=[AUTHENTICATED])
async def update_my_avatar(body: AvatarIn, p: CurrentPrincipal, db: Db) -> AvatarOut:
    """Change only the avatar owned by the currently authenticated account."""
    seed = body.avatar_seed.strip()
    row = None
    if p.learner_id and p.family_id:
        row = await learners.update(db, p.learner_id, p.family_id, {"avatarSeed": seed})
    # Both, for a student — see `update_my_profile` below.
    if p.kind == "user":
        row = await users.update_account(db, p.subject_id, {"avatarSeed": seed}) or row
    if not row:
        raise NotFound("No account is available for this avatar.")
    return AvatarOut(avatarSeed=seed)


@router.patch("/me/password", dependencies=[AUTHENTICATED])
async def change_my_password(
    body: PasswordChangeIn, p: CurrentPrincipal, db: Db
) -> PasswordChangeOut:
    """Change the password of whoever is holding the token.

    Like `PATCH /auth/me`, no permission is named: the only account this can
    reach is the one the token was issued for. Knowing the current password is
    what authorises it — a device left unlocked on a kitchen table should not be
    enough to lock its owner out of their own family.

    Deliberately separate from `POST /admin/users/{id}/password`, which is an
    administrator acting on somebody else and needs `user:manage`. Same effect,
    different act, different authority.
    """
    if p.kind != "user" or not p.subject_id:
        # A child's device has no password to change. It joined with a code.
        raise Forbidden("This device does not sign in with a password.", "no_password_account")

    user = await users.by_id(db, p.subject_id)
    if not user:
        raise NotFound("No account is available to edit.")

    # Budgeted per account. Nobody types their own password ten times a minute,
    # and a borrowed unlocked laptop should not be an unlimited guessing seat.
    await limiter.hit(db, "password:user", p.subject_id, LOGIN_PER_ACCOUNT)

    if not user.get("passwordHash"):
        raise Forbidden(
            "This account signs in with Google and does not have a password.",
            "no_password_account",
        )
    if not passwords.verify_password(user["passwordHash"], body.current_password):
        raise Unauthorized("That is not your current password.", "bad_credentials")

    await limiter.clear(db, "password:user", p.subject_id)
    await users.set_password(db, p.subject_id, passwords.hash_password(body.new_password))

    # Every other session ends. Somebody changing their password may be doing it
    # because another person has been in the account — and this device is spared
    # so the act itself does not sign them out for performing it.
    signed_out = await devices.revoke_all_for_user(
        db, p.subject_id, except_device_id=p.device_id
    )
    return PasswordChangeOut(signedOutSessions=signed_out)


@router.patch("/me", dependencies=[AUTHENTICATED])
async def update_my_profile(body: ProfileIn, p: CurrentPrincipal, db: Db) -> MeOut:
    """Edit the profile of whoever is holding the token, and nobody else.

    Deliberately not `/admin/users/{id}` with the caller's own id: this needs no
    right at all, because the only account it can reach is the one the token was
    issued for. A child editing their own name here is the same gesture as a
    parent editing theirs, which is why one route serves both.
    """
    patch: dict[str, str] = {}
    if body.display_name is not None:
        patch["displayName"] = body.display_name.strip()
    if body.avatar_seed is not None:
        patch["avatarSeed"] = body.avatar_seed.strip()

    if patch:
        row = None
        if p.learner_id and p.family_id:
            row = await learners.update(db, p.learner_id, p.family_id, patch)
        # Not `elif`. A student is one person with two rows — the account they
        # sign in with and the learner they are — and `/auth/me` reads
        # `displayName` off the user while `learnerName` comes off the learner.
        # Writing only one gives the same person two different names, and which
        # one a screen showed would depend on which field it happened to read.
        if p.kind == "user":
            row = await users.update_account(db, p.subject_id, patch) or row
        if not row:
            raise NotFound("No account is available to edit.")

    # Return the whole profile rather than the patch, so the client stores one
    # answer from one place instead of merging two shapes.
    return await me(p, db)
