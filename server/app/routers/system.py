"""The deployment's switchboard: what exists at all, before any family decides.

Two audiences, two routes, and the split matters. Every signed-in device needs
the *effective values* — a client that does not know the live voice coach is off
will draw the button and fail on the tap. Only an operator needs the rows behind
them, and only an operator may write one.

These settings are a **ceiling**. A family may switch a thing off for
themselves; nothing they do switches on what is off here. The client is told so
it can stop offering the thing, and the routes that spend money or take writes
check it again — because a hidden button is a hint, not a rule.
"""

import secrets as stdlib_secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import maintenance as maintenance_repo
from app.repos import system as system_repo
from app.security.rate_limit import PUSH_TEST_PER_ACCOUNT, limiter
from app.services import push as push_service
from app.settings import settings
from app.system_defaults import BY_ID, with_master_applied

router = APIRouter(prefix="/system", tags=["system"], dependencies=[AUTHENTICATED])

CanOperate = Annotated[Principal, Depends(require("system:write"))]


class SettingOut(Model):
    """One row, as an operator sees it.

    A `secret` row carries `value: None` however it is fetched — `isSet` and
    `hint` are the whole of what a screen may know about a credential.
    """

    id: str
    group: str
    label: str
    description: str
    type: str
    value: Any = None
    is_set: bool = Field(default=False, alias="isSet")
    hint: str | None = None
    updated_at: str | None = Field(default=None, alias="updatedAt")


class SettingsOut(Model):
    settings: list[SettingOut]


class ValueIn(Model):
    value: Any


class MaintenanceVersions(Model):
    learning_version: int = Field(alias="learningVersion")
    registrations_version: int = Field(alias="registrationsVersion")


class MaintenanceResult(Model):
    versions: MaintenanceVersions
    deleted: dict[str, int]


#: Enough to recognise which key is stored, not enough to use it. Gemini keys
#: are long, so four characters give away nothing an attacker could not guess.
HINT_CHARS = 4


def _hint(value: str) -> str:
    return value[-HINT_CHARS:] if len(value) > HINT_CHARS else "••••"


def _out(row: dict) -> SettingOut:
    updated = row.get("updatedAt")
    is_secret = row.get("type") == "secret"
    stored = row.get("value")
    return SettingOut(
        id=row["settingId"],
        group=row.get("group", "Other"),
        label=row.get("label", row["settingId"]),
        description=row.get("description", ""),
        type=row.get("type", "bool"),
        # The redaction that lets a credential share a collection with the
        # switches: a secret's value never leaves in a response like this.
        value=None if is_secret else stored,
        isSet=bool(stored) if is_secret else False,
        hint=_hint(str(stored)) if is_secret and stored else None,
        updatedAt=updated.isoformat() if updated else None,
    )


@router.get("")
async def effective(db: Db, p: CurrentPrincipal) -> dict[str, Any]:
    """`{settingId: value}`, for anyone signed in.

    Deliberately not gated: this is what the app needs to know what to draw, and
    a device that cannot read it would draw everything. The values say what the
    deployment offers, never anything about a person.

    Falls back to the shipped defaults for anything the database has not been
    seeded with yet, so a client is never handed a half-answer.
    """
    stored = {row["settingId"]: row.get("value") for row in await system_repo.all_settings(db)}
    # Secrets are omitted outright rather than sent as null: this is the one
    # response every signed-in device receives, and a credential has no business
    # in it. Nothing the app draws depends on the key's value — only the tutor
    # server needs that, through `/resolve`.
    # The master switch is folded in here rather than left to each client: this
    # is the one answer every device and the tutor proxy share, so a capability
    # that reads `true` while Ask Koda is off could not exist even in a stale
    # cache. The operator's own rows are unchanged — see `with_master_applied`.
    return with_master_applied(
        {
            key: stored.get(key, item["value"])
            for key, item in BY_ID.items()
            if item["type"] != "secret"
        }
    )


@router.get("/maintenance/versions")
async def maintenance_versions(db: Db, p: CurrentPrincipal) -> MaintenanceVersions:
    """Reset generations are readable by every device so offline data expires."""
    return MaintenanceVersions(**await maintenance_repo.state(db))


@router.post("/maintenance/learning/reset")
async def reset_learning(db: Db, p: CanOperate) -> MaintenanceResult:
    versions, deleted = await maintenance_repo.reset_learning(db, p.subject_id)
    return MaintenanceResult(versions=MaintenanceVersions(**versions), deleted=deleted)


@router.post("/maintenance/registrations/reset")
async def reset_registrations(db: Db, p: CanOperate) -> MaintenanceResult:
    versions, deleted = await maintenance_repo.reset_registrations(db, p.subject_id)
    return MaintenanceResult(versions=MaintenanceVersions(**versions), deleted=deleted)


@router.get("/settings")
async def listing(db: Db, p: CanOperate) -> SettingsOut:
    """The rows themselves — labels, groups, when each was last changed."""
    rows = await system_repo.all_settings(db)
    known = [row for row in rows if row["settingId"] in BY_ID]
    return SettingsOut(settings=[_out(row) for row in known])


@router.patch("/settings/{setting_id}")
async def update(setting_id: str, body: ValueIn, db: Db, p: CanOperate) -> SettingOut:
    definition = BY_ID.get(setting_id)
    if not definition:
        # A setting needs code behind it, so an unknown id is a client bug
        # rather than a new setting. Same rule as the menu.
        raise NotFound(f"There is no system setting called '{setting_id}'.")

    value = body.value
    if definition["type"] == "bool":
        if not isinstance(value, bool):
            raise AppError(400, "bad_value", f"'{setting_id}' is a switch: send true or false.")
    elif definition["type"] == "secret":
        if not isinstance(value, str):
            raise AppError(400, "bad_value", f"'{setting_id}' is a credential.")
        value = value.strip()
        # Blank clears it, which is how a credential is withdrawn — there is no
        # separate delete, because "set it to nothing" is the same act.
        if value and len(value) < 8:
            raise AppError(400, "bad_value", "That does not look like a key.")
        value = value[:512]
    else:
        if not isinstance(value, str):
            raise AppError(400, "bad_value", f"'{setting_id}' is text.")
        value = value.strip()[:500]

    row = await system_repo.set_value(db, setting_id, value, p.subject_id)
    if not row:
        raise NotFound(f"'{setting_id}' has not been seeded yet.")
    return _out(row)


@router.post("/settings/{setting_id}/resolve")
async def resolve(
    setting_id: str,
    db: Db,
    p: CurrentPrincipal,
    x_service_token: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    """A secret's actual value, for the tutor server and nothing else.

    Two credentials, and neither is enough alone. `X-Service-Token` says "this
    is the tutor server" — that header is given to that process and to nothing
    else. The caller's own token is required on top because every route here is,
    and because a request with nobody signed in behind it has no business
    spending the deployment's Gemini quota.

    Note what is *not* checked: `system:write`. Any signed-in learner causes this
    to be called merely by talking to Koda, so the caller's rights cannot be the
    bar — only the service token can be.
    """
    definition = BY_ID.get(setting_id)
    if not definition or definition["type"] != "secret":
        raise NotFound(f"There is no secret called '{setting_id}'.")

    expected = settings().tutor_service_token
    if not expected or not x_service_token:
        raise Forbidden("This deployment has no tutor server configured.")
    # Constant-time: a token that can be guessed a character at a time is not a
    # token.
    if not stdlib_secrets.compare_digest(x_service_token, expected):
        raise Forbidden("Not the tutor server.")

    value = await system_repo.value_of(db, setting_id, "")
    if not value:
        raise NotFound(f"'{setting_id}' is not set on this deployment.")
    return {"value": value}


@router.get("/push/preflight")
async def push_preflight(db: Db, p: CanOperate) -> dict[str, Any]:
    """Is push actually working here? Answered without sending anything.

    Run against a fresh deployment, from a laptop, before a single parent is
    told the feature exists — and afterwards from the deploy, because a `curl`
    of this turns "we shipped notifications" into something CI can assert.
    """
    return await push_service.preflight(db)


@router.post("/push/test")
async def push_test(db: Db, p: CanOperate) -> dict[str, Any]:
    """Ring the caller's own browsers, and nobody else's.

    Note what this route does not take: a recipient. Not a family, not a user,
    not an email. A test endpoint that accepts a target is an arbitrary-push
    primitive wearing an admin badge.
    """
    await limiter.hit(db, "push:test", p.subject_id, PUSH_TEST_PER_ACCOUNT)
    return await push_service.send_test(db, p.subject_id)
