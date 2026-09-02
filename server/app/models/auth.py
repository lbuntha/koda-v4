"""The auth wire format, and the principal every route is handed."""

from typing import Literal

from pydantic import EmailStr, Field

from app.models.common import Model


class SignupIn(Model):
    email: EmailStr
    # No length rule while this is a prototype — the accounts are dev accounts
    # and a refused `123456` is friction with nothing behind it. Restore a
    # minimum here (and in AccountForm) before real families sign up; the hash
    # and the lockout are what actually protect an account, and both stay.
    password: str = Field(min_length=1, max_length=200)
    family_name: str | None = Field(default=None, max_length=60, alias="familyName")
    device_name: str = Field(default="This device", max_length=60, alias="deviceName")
    account_type: Literal["parent", "student"] = Field(default="parent", alias="accountType")
    # A stable id the client keeps for the life of an install.
    #
    # Optional, and absent from an older client, which is exactly the case the
    # device list is bad at: without it every sign-in writes another row, so one
    # laptop signed into a dozen times reads as a dozen devices and the tablet
    # somebody actually lost cannot be found in the list.
    install_id: str | None = Field(default=None, max_length=64, alias="installId")


class EmailVerificationPending(Model):
    verification_required: Literal[True] = Field(default=True, alias="verificationRequired")
    email: EmailStr
    email_sent: bool = Field(alias="emailSent")


class EmailVerificationResendIn(Model):
    email: EmailStr


class EmailVerificationIn(Model):
    token: str = Field(min_length=16, max_length=200)
    device_name: str = Field(default="This device", max_length=60, alias="deviceName")
    install_id: str | None = Field(default=None, max_length=64, alias="installId")


class ForgotIn(Model):
    email: EmailStr


class ResetIn(Model):
    token: str = Field(min_length=16, max_length=200)
    new_password: str = Field(min_length=1, max_length=200, alias="newPassword")


class PasswordChangeIn(Model):
    """Changing your own password, which takes knowing the current one.

    No minimum on the new one, matching `SignupIn` above: the same prototype
    reasoning applies, and a rule enforced here but not there would only be
    inconsistent.
    """

    current_password: str = Field(min_length=1, max_length=200, alias="currentPassword")
    new_password: str = Field(min_length=1, max_length=200, alias="newPassword")


class PasswordChangeOut(Model):
    """What changing it cost, so the client can say so.

    *Sessions*, not devices, and the distinction is not pedantry: a device row
    is written per sign-in, so one laptop signed into a dozen times is a dozen
    rows. Reporting that as "12 devices signed out" tells somebody they have
    eleven machines they have never owned.
    """

    signed_out_sessions: int = Field(alias="signedOutSessions")


class LoginIn(Model):
    email: EmailStr
    password: str
    device_name: str = Field(default="This device", max_length=60, alias="deviceName")
    # A stable id the client keeps for the life of an install.
    #
    # Optional, and absent from an older client, which is exactly the case the
    # device list is bad at: without it every sign-in writes another row, so one
    # laptop signed into a dozen times reads as a dozen devices and the tablet
    # somebody actually lost cannot be found in the list.
    install_id: str | None = Field(default=None, max_length=64, alias="installId")


class GoogleAuthIn(Model):
    """A Google ID token exchanged for Koda's ordinary session pair."""

    credential: str = Field(min_length=100, max_length=10_000)
    create_account: bool = Field(default=False, alias="createAccount")
    family_name: str | None = Field(default=None, max_length=60, alias="familyName")
    device_name: str = Field(default="This device", max_length=60, alias="deviceName")
    install_id: str | None = Field(default=None, max_length=64, alias="installId")


class JoinIn(Model):
    code: str = Field(min_length=8, max_length=8)
    device_name: str = Field(default="This device", max_length=60, alias="deviceName")
    # A stable id the client keeps for the life of an install.
    #
    # Optional, and absent from an older client, which is exactly the case the
    # device list is bad at: without it every sign-in writes another row, so one
    # laptop signed into a dozen times reads as a dozen devices and the tablet
    # somebody actually lost cannot be found in the list.
    install_id: str | None = Field(default=None, max_length=64, alias="installId")


class SwitchIn(Model):
    """Opening a child on this device.

    Carries the same two fields a sign-in does, and for the same reason: a
    switch issues a session, so it must be able to recognise the install it is
    issuing it on. Every field has a default — an older client sends no body at
    all, and gets the old behaviour rather than a 422.
    """

    device_name: str = Field(default="This device", max_length=60, alias="deviceName")
    install_id: str | None = Field(default=None, max_length=64, alias="installId")


class RefreshIn(Model):
    refresh_token: str = Field(alias="refreshToken")


class TokenPair(Model):
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    expires_in: int = Field(alias="expiresIn")
    device_id: str = Field(alias="deviceId")
    family_id: str | None = Field(default=None, alias="familyId")
    role: str
    platform_role: str = Field(default="none", alias="platformRole")
    permissions: list[str] = Field(default_factory=list)


class MeOut(Model):
    user_id: str | None = Field(default=None, alias="userId")
    email: str | None = None
    display_name: str | None = Field(default=None, alias="displayName")
    avatar_seed: str = Field(alias="avatarSeed")
    # Staff belong to no family, so both are absent for them.
    family_id: str | None = Field(default=None, alias="familyId")
    family_name: str | None = Field(default=None, alias="familyName")
    role: str
    platform_role: str = Field(default="none", alias="platformRole")
    learner_id: str | None = Field(default=None, alias="learnerId")
    learner_name: str | None = Field(default=None, alias="learnerName")
    learner_birth_year: int | None = Field(default=None, alias="learnerBirthYear")
    permissions: list[str] = Field(default_factory=list)
    # When this account first existed — the child's row for a child, the user's
    # for everybody else. The profile page prints it as "Joined August 2026",
    # which was the one thing on that page it had to make up before this.
    joined_at: str | None = Field(default=None, alias="joinedAt")


class ProfileIn(Model):
    """A self-service edit. Only fields that are present are written."""

    display_name: str | None = Field(default=None, min_length=1, max_length=80,
                                     alias="displayName")
    avatar_seed: str | None = Field(default=None, min_length=8, max_length=100,
                                    alias="avatarSeed")


class AvatarIn(Model):
    avatar_seed: str = Field(min_length=8, max_length=100, alias="avatarSeed")


class AvatarOut(Model):
    avatar_seed: str = Field(alias="avatarSeed")


class Principal(Model):
    """Who is calling. Built from the token, never from the request body."""

    subject_id: str
    kind: str  # "user" | "device"
    # Absent for staff: an admin is not a member of anyone's family, so there is
    # no family to scope their queries to. Family routes refuse them; admin
    # routes read across families on purpose.
    family_id: str | None = None
    role: str
    learner_id: str | None = None
    platform_role: str = "none"
    device_id: str | None = None
    # The effective set, when the token carries one. Absent for tokens issued
    # before per-person rights existed, which then fall back to the role.
    permissions: list[str] | None = None
