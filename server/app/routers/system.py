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
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header
from pydantic import Field, ValidationError

from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.models.subjects import SubjectCatalog
from app.push_defaults import (
    BODY_MAX,
    BY_KIND,
    DEFAULT_KINDS,
    EMAIL_BODY_MAX,
    EMAIL_FRAME,
    EMAIL_FRAME_PLACEHOLDERS,
    EMAIL_FRAME_REQUIRED,
    EMAIL_MASTER,
    EMAIL_SENDS,
    EMAIL_SUBJECT_MAX,
    MASTER,
    SENDS,
    TITLE_MAX,
    placeholders_for,
    unknown_placeholders,
)
from app.repos import maintenance as maintenance_repo
from app.repos import notify_jobs, notify_prefs, notify_schedule, push_log, push_templates, push_tokens
from app.repos import system as system_repo
from app.repos import users as users_repo
from app.security.rate_limit import PUSH_TEST_PER_ACCOUNT, limiter
from app.services import email_notify
from app.services import push as push_service
from app.services import tasks as task_service
from app.settings import settings
from app.system_defaults import BY_ID, with_master_applied

router = APIRouter(prefix="/system", tags=["system"], dependencies=[AUTHENTICATED])

CanOperate = Annotated[Principal, Depends(require("system:write"))]
CanManageSubjects = Annotated[Principal, Depends(require("content:write"))]


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


@router.patch("/subjects")
async def update_subjects(body: ValueIn, db: Db, p: CanManageSubjects) -> SettingOut:
    """Developers can organize learning content without access to system controls."""
    return await update("learning.subjects", body, db, p)


@router.patch("/settings/{setting_id}")
async def update(setting_id: str, body: ValueIn, db: Db, p: CanOperate) -> SettingOut:
    definition = BY_ID.get(setting_id)
    if not definition:
        # A setting needs code behind it, so an unknown id is a client bug
        # rather than a new setting. Same rule as the menu.
        raise NotFound(f"There is no system setting called '{setting_id}'.")

    value = body.value
    if setting_id == "learning.subjects":
        if not isinstance(value, str) or len(value) > 100_000:
            raise AppError(400, "bad_value", "Invalid subject catalog.")
        try:
            value = SubjectCatalog.model_validate_json(value).model_dump_json()
        except ValidationError as exc:
            raise AppError(400, "bad_value", "Use unique subject names and assign skills to existing subjects.") from exc
    elif definition["type"] == "bool":
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


class TestSendIn(Model):
    """The only thing this route accepts, and notably not a recipient.

    A kind names *which wording to preview*. There is no field here for who to
    send it to, and there must never be one: a test that can name a target is a
    way to put chosen words on a stranger's lock screen.
    """

    kind: str | None = Field(default=None, max_length=60)


@router.post("/push/test")
async def push_test(db: Db, p: CanOperate, body: TestSendIn | None = None) -> dict[str, Any]:
    """Ring the caller's own browsers, and nobody else's.

    Note what this route does not take: a recipient. Not a family, not a user,
    not an email. A test endpoint that accepts a target is an arbitrary-push
    primitive wearing an admin badge.
    """
    await limiter.hit(db, "push:test", p.subject_id, PUSH_TEST_PER_ACCOUNT)
    return await push_service.send_test(db, p.subject_id, body.kind if body else None, from_admin=True)


#: The jobs an operator may run by hand, and what each one is.
#:
#: A closed map rather than a path parameter passed to `getattr`: the value
#: arrives in a URL, and "which function does this string name" is not a
#: question to answer by reflection on a route that sends notifications.
RUNNABLE_JOBS = {
    "weekly-summary": "Sunday's summary, for whoever it is Sunday evening for.",
    "daily-reminders": "A nudge for a child who has not practised, at the hour their parent chose.",
    "skill-announcements": "Tell every family about a skill published in the last two days.",
    "token-sweep": "Delete dead tokens, old notices and spent claims.",
}


class JobRunOut(Model):
    """What one hand-run job did, or would have done."""

    job: str
    preview: bool
    report: dict[str, Any]


@router.get("/push/jobs")
async def push_jobs(p: CanOperate) -> dict[str, Any]:
    """What can be run by hand, so the screen does not hardcode the list."""
    return {"jobs": [{"id": job, "description": text} for job, text in RUNNABLE_JOBS.items()]}


@router.post("/push/jobs/{job}")
async def push_job_run(
    job: str, db: Db, p: CanOperate, preview: bool = False
) -> JobRunOut:
    """Run a scheduled job now, or show what it would do.

    Cloud Scheduler owns the clock; this is the other door onto the same work,
    for the two occasions the clock is no use. One is a deployment being set up,
    where "does this work?" should not mean waiting until Sunday. The other is
    an operator who has just changed the wording and wants to see it against
    real families rather than against `SAMPLES`.

    **`preview` is the one worth reaching for.** A summary run for real on a
    Tuesday correctly does nothing — it is nobody's Sunday evening — which makes
    it a useless way to check anything. The preview drops that filter, reports
    the wording each parent would read, claims nothing and sends nothing, and
    says of each line whether it has already gone.

    A real run is safe to press twice: the ledger is what makes Cloud
    Scheduler's retries harmless and it does not care that this caller has
    hands. Pressing it on a Sunday evening simply does what the hourly tick was
    about to do, once.

    Staff only, and rate limited like the test send, because a real run spends
    FCM quota and reaches real phones.
    """
    if job not in RUNNABLE_JOBS:
        raise NotFound(f"There is no job called '{job}'.")

    if not preview:
        await limiter.hit(db, "push:job", p.subject_id, PUSH_TEST_PER_ACCOUNT)

    if job == "token-sweep":
        # Nothing to preview: it deletes rows nothing can use again, and a
        # count of them is what a real run already reports.
        report = await task_service.token_sweep(db)
        preview = False
    elif job == "skill-announcements":
        report = await task_service.skill_announcements(db, preview=preview)
    elif job == "daily-reminders":
        report = await task_service.daily_reminders(db, preview=preview)
    else:
        report = await task_service.weekly_summary(db, preview=preview)

    # A real run by hand is a run, and the Events screen says when the last one was.
    if not preview:
        await notify_jobs.note_run(db, job, report)
    return JobRunOut(job=job, preview=preview, report=report)


class SendOut(Model):
    """One send, as an operator reads it."""

    id: str
    kind: str
    title: str
    body: str
    #: Accounts told. Ids rather than names: this page is read beside the user
    #: list, and resolving names here would be a second query per row to answer
    #: a question most rows are never asked.
    people: list[str]
    family_id: str | None = Field(default=None, alias="familyId")
    driver: str
    devices: int
    delivered: int
    #: FCM's own vocabulary, counted — `dead`, `soft`, `config`, `quota`.
    outcomes: dict[str, int]
    at: str
    #: `push` or `email`.
    channel: str = "push"


class SendSummaryOut(Model):
    kind: str
    channel: str = "push"
    sends: int
    devices: int
    delivered: int
    last: str


class PushLogOut(Model):
    summary: list[SendSummaryOut]
    sends: list[SendOut]


@router.get("/push/log")
async def push_log_read(
    db: Db,
    p: CanOperate,
    limit: int = 50,
    kind: str | None = None,
    channel: str | None = None,
) -> PushLogOut:
    """What this deployment has sent, and what became of it.

    Preflight answers "will a notification work" before one is sent. This
    answers "did it" afterwards, which nothing did: the delivery outcome lived
    in a return value and a log line, so a question asked on Monday about
    Sunday's summary had no answer at all.

    The summary above the list is the part worth reading first. A kind that has
    sent forty notifications and delivered none is exactly this feature's
    failure mode, and it is invisible in forty rows that each look fine.
    """
    rows = await push_log.recent(db, limit=limit, kind=kind, channel=channel)
    totals = await push_log.summary(db)
    return PushLogOut(
        summary=[
            SendSummaryOut(
                kind=row["_id"]["kind"],
                channel=row["_id"]["channel"],
                sends=row["sends"],
                devices=row["devices"],
                delivered=row["delivered"],
                last=row["last"].isoformat(),
            )
            for row in totals
        ],
        sends=[
            SendOut(
                id=row["_id"],
                kind=row["kind"],
                title=row.get("title", ""),
                body=row.get("body", ""),
                people=row.get("people", []),
                familyId=row.get("familyId"),
                channel=row.get("channel") or "push",
                driver=row.get("driver", "unknown"),
                devices=row.get("devices", 0),
                delivered=row.get("delivered", 0),
                outcomes=row.get("outcomes", {}),
                at=row["at"].isoformat(),
            )
            for row in rows
        ],
    )


class AudienceDeviceOut(Model):
    """One registered browser. Never the token: that is the means to ring it."""

    platform: str | None = None
    ua: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")
    refreshed_at: str | None = Field(default=None, alias="refreshedAt")
    failures: int = 0
    #: Retired after repeated soft failures; the nightly sweep removes it later.
    retired: bool = False


class AudiencePersonOut(Model):
    user_id: str = Field(alias="userId")
    email: str | None = None
    name: str | None = None
    #: The role in their family, or the platform role for staff with no family.
    role: str | None = None
    family_id: str | None = Field(default=None, alias="familyId")
    family_name: str | None = Field(default=None, alias="familyName")
    devices: list[AudienceDeviceOut]
    live_devices: int = Field(alias="liveDevices")
    #: Labels of the courtesy kinds this person would currently accept.
    kinds: list[str]
    reminder_hour: int = Field(alias="reminderHour")
    quiet_from: int = Field(alias="quietFrom")
    quiet_to: int = Field(alias="quietTo")
    tz_offset_minutes: int | None = Field(default=None, alias="tzOffsetMinutes")


class AudienceOut(Model):
    people: int
    families: int
    live_devices: int = Field(alias="liveDevices")
    retired_devices: int = Field(alias="retiredDevices")
    #: True when the registrations outnumber what one report reads.
    truncated: bool
    rows: list[AudiencePersonOut]


async def _owners_of(
    db: Any, tokens: list[dict[str, Any]]
) -> tuple[list[str], dict[str, dict[str, Any]], dict[str, str | None], dict[tuple[str, str], str | None]]:
    """The accounts, family names and family roles behind a set of token rows.

    Three queries for the whole set rather than three per person.
    """
    user_ids = sorted({row["userId"] for row in tokens if row.get("userId")})
    users = {
        row["_id"]: row
        for row in await db.users.find(
            {"_id": {"$in": user_ids}}, {"email": 1, "displayName": 1, "platformRole": 1}
        ).to_list(length=len(user_ids) or 1)
    }
    family_ids = sorted({row["familyId"] for row in tokens if row.get("familyId")})
    families = {
        row["_id"]: row.get("name")
        for row in await db.families.find({"_id": {"$in": family_ids}}, {"name": 1}).to_list(
            length=len(family_ids) or 1
        )
    }
    roles = {
        (row["userId"], row["familyId"]): row.get("role")
        for row in await db.memberships.find(
            {"userId": {"$in": user_ids}}, {"userId": 1, "familyId": 1, "role": 1}
        ).to_list(length=len(user_ids) * 4 or 1)
    }
    return user_ids, users, families, roles


class PushTokenOut(Model):
    """One registration, token included. Admin only."""

    token: str
    user_id: str | None = Field(default=None, alias="userId")
    email: str | None = None
    name: str | None = None
    role: str | None = None
    family_id: str | None = Field(default=None, alias="familyId")
    family_name: str | None = Field(default=None, alias="familyName")
    platform: str | None = None
    ua: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")
    refreshed_at: str | None = Field(default=None, alias="refreshedAt")
    failures: int = 0
    retired: bool = False


class PushTokensOut(Model):
    truncated: bool
    rows: list[PushTokenOut]


@router.get("/push/tokens")
async def push_tokens_report(
    db: Db, p: Annotated[Principal, Depends(require("user:manage"))]
) -> PushTokensOut:
    """Every FCM registration token, by user.

    The only route that returns a token. Holding one is the ability to ring that
    browser, so this is gated on `user:manage` — held by the platform admin
    role alone — and the screen masks each token until it is asked for.
    """
    tokens = await push_tokens.tokens_for_report(db)
    _, users, families, roles = await _owners_of(db, tokens)

    def stamp(value: Any) -> str | None:
        return value.isoformat() if value else None

    rows = []
    for row in tokens:
        user_id = row.get("userId")
        family_id = row.get("familyId")
        user = users.get(user_id, {}) if user_id else {}
        rows.append(
            PushTokenOut(
                token=row["token"],
                userId=user_id,
                email=user.get("email"),
                name=user.get("displayName"),
                role=roles.get((user_id, family_id)) or user.get("platformRole"),
                familyId=family_id,
                familyName=families.get(family_id) if family_id else None,
                platform=row.get("platform"),
                ua=row.get("ua"),
                createdAt=stamp(row.get("createdAt")),
                refreshedAt=stamp(row.get("refreshedAt")),
                failures=row.get("failures", 0),
                retired=row.get("disabledAt") is not None,
            )
        )
    return PushTokensOut(truncated=len(tokens) >= push_tokens.REPORT_LIMIT, rows=rows)


@router.get("/push/audience")
async def push_audience(
    db: Db, p: Annotated[Principal, Depends(require("user:manage"))]
) -> AudienceOut:
    """Who has turned notifications on, on which browsers, and for what.

    Gated on `user:manage` rather than `system:write`, because this names people
    across families — the same rule as the user list it is read beside.
    """
    tokens = await push_tokens.for_report(db)
    user_ids, users, families, roles = await _owners_of(db, tokens)
    prefs = await notify_prefs.for_users(db, user_ids)
    schedules = await notify_schedule.for_users(db, user_ids)
    courtesy = [kind for kind in DEFAULT_KINDS if kind["class"] == "courtesy"]

    by_user: dict[str, list[dict[str, Any]]] = {}
    for row in tokens:
        if row.get("userId"):
            by_user.setdefault(row["userId"], []).append(row)

    def stamp(value: Any) -> str | None:
        return value.isoformat() if value else None

    rows: list[AudiencePersonOut] = []
    # `tokens` is newest-refreshed first, so insertion order already puts the
    # most recently active person at the top.
    for user_id, owned in by_user.items():
        user = users.get(user_id, {})
        family_id = next((row["familyId"] for row in owned if row.get("familyId")), None)
        schedule = schedules[user_id]
        chosen = prefs.get(user_id, {})
        rows.append(
            AudiencePersonOut(
                userId=user_id,
                email=user.get("email"),
                name=user.get("displayName"),
                role=roles.get((user_id, family_id)) or user.get("platformRole"),
                familyId=family_id,
                familyName=families.get(family_id) if family_id else None,
                devices=[
                    AudienceDeviceOut(
                        platform=row.get("platform"),
                        ua=row.get("ua"),
                        createdAt=stamp(row.get("createdAt")),
                        refreshedAt=stamp(row.get("refreshedAt")),
                        failures=row.get("failures", 0),
                        retired=row.get("disabledAt") is not None,
                    )
                    for row in owned
                ],
                liveDevices=sum(1 for row in owned if row.get("disabledAt") is None),
                kinds=[
                    kind["label"]
                    for kind in courtesy
                    if chosen.get(kind["kindId"], kind["familyDefault"])
                ],
                reminderHour=schedule["reminderHour"],
                quietFrom=schedule["quietFrom"],
                quietTo=schedule["quietTo"],
                tzOffsetMinutes=schedule["tzOffsetMinutes"],
            )
        )

    live = sum(1 for row in tokens if row.get("disabledAt") is None)
    return AudienceOut(
        people=len(rows),
        families=len({row.family_id for row in rows if row.family_id}),
        liveDevices=live,
        retiredDevices=len(tokens) - live,
        truncated=len(tokens) >= push_tokens.REPORT_LIMIT,
        rows=rows,
    )


class BroadcastIn(Model):
    """What an operator wants to tell the people who run this deployment."""

    message: str = Field(min_length=1, max_length=BODY_MAX)


@router.post("/push/broadcast")
async def push_broadcast(body: BroadcastIn, db: Db, p: CanOperate) -> dict[str, Any]:
    """Tell every member of staff something. Never a family.

    The last kind in the catalog with no sender, and the one that needed the
    most care about *who*. `system.broadcast` is addressed to the deployment's
    own staff — the people who would be paged about it — and a route that could
    reach families would be an announcement channel aimed at children's parents,
    which §1's list of non-goals rules out in the same breath as marketing.

    So the recipients are read from the platform roles, not from a family, and
    there is no parameter here that names anybody. It is the same rule the test
    send keeps: no route in this service takes a recipient.
    """
    await limiter.hit(db, "push:broadcast", p.subject_id, PUSH_TEST_PER_ACCOUNT)

    staff = await users_repo.staff_ids(db)
    if not staff:
        return {"sent": 0, "staff": 0, "note": "This deployment has no staff accounts."}

    title, text = await push_service.wording(db, "system.broadcast", {"message": body.message})
    sent = 0
    for user_id in staff:
        # One send per person rather than one addressed to a family, because
        # staff belong to no family — `Recipient` is family-scoped, and an
        # operator's own row carries `familyId: null`.
        sent += await push_service.send_to_account(db, user_id=user_id, kind="system.broadcast",
                                                   title=title, body=text)
    return {"sent": sent, "staff": len(staff)}


class AnnouncementIn(Model):
    """An operator's announcement: their words and an audience. Never a person."""

    title: str = Field(default="", max_length=TITLE_MAX)
    message: str = Field(min_length=1, max_length=BODY_MAX)
    audience: Literal["families", "staff", "everyone"] = "families"
    #: Also email it, to the verified addresses in that audience.
    email: bool = False


@router.post("/push/announcement")
async def push_announcement(
    body: AnnouncementIn, db: Db, p: CanOperate, preview: bool = False
) -> dict[str, Any]:
    """Send an announcement now, or show who it would reach.

    Families means every adult in every family — recorded under their bell
    whether or not a browser is registered, and rung where one is. Staff means
    the platform roles, as the broadcast above reads them. A learner device is
    never reached, because it never holds a token.

    Rate limited like the test send when it is real, because it reaches every
    phone on the deployment.
    """
    message = body.message.strip()
    if not message:
        raise AppError(400, "bad_value", "Write the announcement before sending it.")
    if not preview:
        await limiter.hit(db, "push:announcement", p.subject_id, PUSH_TEST_PER_ACCOUNT)
    return await task_service.announcement(
        db,
        title=body.title.strip(),
        message=message,
        audience=body.audience,
        preview=preview,
        sent_by=p.subject_id,
        email=body.email,
    )


class EmailWordingOut(Model):
    """One kind's email subject and body, as an operator edits them."""

    subject: str
    body: str
    placeholders: list[str]
    edited: bool


class FrameOut(Model):
    """The greeting and footer every notification email is wrapped in."""

    body: str
    footer: str
    account_footer: str = Field(alias="accountFooter")
    placeholders: dict[str, list[str]]
    #: The placeholder each part cannot be saved without.
    required: dict[str, str]
    edited: bool


class TemplateOut(Model):
    """One kind's wording, as an operator edits it."""

    id: str
    label: str
    kind_class: str = Field(alias="class")
    title: str
    body: str
    #: What a sender substitutes here. Shown so an operator knows what they may
    #: use, rather than discovering it from a notification that reads
    #: "{learner} met today's goal" on somebody's phone.
    placeholders: list[str]
    #: Whether these are the shipped words or somebody's edit — which is also
    #: the only thing "reset" needs to know.
    edited: bool
    #: The email version, when this build emails the kind at all.
    email: EmailWordingOut | None = None


class TemplatesOut(Model):
    templates: list[TemplateOut]
    frame: FrameOut


class TemplateIn(Model):
    title: str = Field(min_length=1, max_length=TITLE_MAX)
    body: str = Field(min_length=1, max_length=BODY_MAX)


async def _templates(db) -> TemplatesOut:
    edits = await push_templates.overrides(db)
    rows: list[TemplateOut] = []
    for kind in DEFAULT_KINDS:
        kind_id = kind["kindId"]
        email_default = kind.get("email") if kind_id in EMAIL_SENDS else None
        email_edit = edits.get(push_templates.EMAIL_PREFIX + kind_id, {})
        rows.append(
            TemplateOut(
                id=kind_id,
                label=kind["label"],
                **{"class": kind["class"]},
                title=edits.get(kind_id, {}).get("title") or kind["title"],
                body=edits.get(kind_id, {}).get("body") or kind["body"],
                placeholders=kind.get("placeholders", []),
                edited=kind_id in edits,
                email=EmailWordingOut(
                    subject=email_edit.get("subject") or email_default["subject"],
                    body=email_edit.get("body") or email_default["body"],
                    placeholders=placeholders_for(kind_id, "email"),
                    edited=bool(email_edit),
                )
                if email_default
                else None,
            )
        )
    frame_edit = edits.get(push_templates.FRAME_ID, {})
    return TemplatesOut(
        templates=rows,
        frame=FrameOut(
            body=frame_edit.get("body") or EMAIL_FRAME["body"],
            footer=frame_edit.get("footer") or EMAIL_FRAME["footer"],
            accountFooter=frame_edit.get("accountFooter") or EMAIL_FRAME["accountFooter"],
            placeholders=EMAIL_FRAME_PLACEHOLDERS,
            required=EMAIL_FRAME_REQUIRED,
            edited=bool(frame_edit),
        ),
    )


def _refuse_unknown(text: str, allowed: list[str]) -> None:
    """Refuse a save that names a placeholder nothing will fill.

    `fill` leaves one standing rather than guessing, which is right at send
    time. At save time the operator is looking at the screen, and that is the
    moment to say "{learnr} is not something this message can fill".
    """
    unknown = unknown_placeholders(text, allowed)
    if unknown:
        listed = ", ".join("{" + name + "}" for name in unknown)
        verb = "is" if len(unknown) == 1 else "are"
        raise AppError(
            400, "unknown_placeholder", f"{listed} {verb} not something this message can fill."
        )


@router.get("/push/templates")
async def push_templates_list(db: Db, p: CanOperate) -> TemplatesOut:
    """What every kind of notification says on this deployment."""
    return await _templates(db)


@router.patch("/push/templates/{kind_id}")
async def push_template_write(kind_id: str, body: TemplateIn, db: Db, p: CanOperate) -> TemplatesOut:
    """Reword one kind.

    A kind needs code behind it, so an unknown id is a client bug rather than a
    new kind — the same rule the menu and the switchboard follow.
    """
    if kind_id not in {kind["kindId"] for kind in DEFAULT_KINDS}:
        raise NotFound(f"There is no notification called '{kind_id}'.")
    definition = BY_KIND[kind_id]
    _refuse_unknown(
        f"{body.title}\n{body.body}",
        placeholders_for(kind_id, "push") + list(definition.get("accepts", [])),
    )
    await push_templates.set_wording(
        db, kind_id, title=body.title.strip(), body=body.body.strip(), updated_by=p.subject_id
    )
    return await _templates(db)


@router.delete("/push/templates/{kind_id}")
async def push_template_reset(kind_id: str, db: Db, p: CanOperate) -> TemplatesOut:
    """Back to the words the code ships — which is deleting the edit, not
    writing a second copy of the default."""
    await push_templates.reset(db, kind_id)
    return await _templates(db)


class EmailTemplateIn(Model):
    subject: str = Field(min_length=1, max_length=EMAIL_SUBJECT_MAX)
    body: str = Field(min_length=1, max_length=EMAIL_BODY_MAX)


def _emailed(kind_id: str) -> dict[str, Any]:
    definition = BY_KIND.get(kind_id)
    if not definition or not definition.get("email") or kind_id not in EMAIL_SENDS:
        raise NotFound(f"There is no notification email called '{kind_id}'.")
    return definition


@router.patch("/push/templates/{kind_id}/email")
async def email_template_write(
    kind_id: str, body: EmailTemplateIn, db: Db, p: CanOperate
) -> TemplatesOut:
    """Reword one kind's email. Refused if it names a placeholder nothing fills."""
    _emailed(kind_id)
    _refuse_unknown(f"{body.subject}\n{body.body}", placeholders_for(kind_id, "email"))
    await push_templates.set_email(
        db, kind_id, subject=body.subject.strip(), body=body.body.strip(), updated_by=p.subject_id
    )
    return await _templates(db)


@router.delete("/push/templates/{kind_id}/email")
async def email_template_reset(kind_id: str, db: Db, p: CanOperate) -> TemplatesOut:
    _emailed(kind_id)
    await push_templates.reset_email(db, kind_id)
    return await _templates(db)


class FrameIn(Model):
    body: str = Field(min_length=1, max_length=EMAIL_BODY_MAX)
    footer: str = Field(min_length=1, max_length=1000)
    account_footer: str = Field(alias="accountFooter", min_length=1, max_length=1000)


@router.patch("/email/frame")
async def email_frame_write(body: FrameIn, db: Db, p: CanOperate) -> TemplatesOut:
    """Reword the greeting and footers every notification email shares.

    The body must keep `{message}` and the footer `{unsubscribe_link}`: without
    the first every parent reads the same empty letter, and without the second
    nobody can stop the emails.
    """
    parts = {"body": body.body, "footer": body.footer, "accountFooter": body.account_footer}
    for part, text in parts.items():
        _refuse_unknown(text, EMAIL_FRAME_PLACEHOLDERS[part])
        required = EMAIL_FRAME_REQUIRED.get(part)
        if required and "{" + required + "}" not in text:
            raise AppError(
                400, "missing_placeholder", f"The {part} has to keep {{{required}}}."
            )
    await push_templates.set_frame(
        db,
        body=body.body.strip(),
        footer=body.footer.strip(),
        account_footer=body.account_footer.strip(),
        updated_by=p.subject_id,
    )
    return await _templates(db)


@router.delete("/email/frame")
async def email_frame_reset(db: Db, p: CanOperate) -> TemplatesOut:
    await push_templates.reset_frame(db)
    return await _templates(db)


# --- the events screen: every kind, its channels, and when its job runs -------

#: Which job sends each scheduled kind — where an operator moves its time.
KIND_JOBS = {
    "learn.weekly_summary": "weekly-summary",
    "learn.practice_reminder": "daily-reminders",
    "learn.streak_ending": "daily-reminders",
    "learn.skill_published": "skill-announcements",
}


class ChannelOut(Model):
    """One channel of one kind, as the Events table draws it."""

    #: Whether this build sends the kind on this channel at all.
    available: bool
    #: The switch that turns it off for the deployment, if it has one.
    setting_id: str | None = Field(default=None, alias="settingId")
    on: bool = False
    #: Sent whenever the channel's master is on, with no switch of its own —
    #: the account notices.
    locked: bool = False


class EventOut(Model):
    id: str
    label: str
    kind_class: str = Field(alias="class")
    push: ChannelOut
    email: ChannelOut
    job: str | None = None


class NotifyJobOut(Model):
    id: str
    description: str
    enabled: bool
    #: Monday is 0. Only the weekly summary has a day and an hour to move.
    weekday: int | None = None
    hour: int | None = None
    last_run_at: str | None = Field(default=None, alias="lastRunAt")
    last_sent: int | None = Field(default=None, alias="lastSent")
    last_skipped: str | None = Field(default=None, alias="lastSkipped")


class EventsOut(Model):
    push_enabled: bool = Field(alias="pushEnabled")
    email_enabled: bool = Field(alias="emailEnabled")
    push_driver: str = Field(alias="pushDriver")
    mail_driver: str = Field(alias="mailDriver")
    events: list[EventOut]
    jobs: list[NotifyJobOut]


async def _switch(db, setting_id: str | None) -> bool:
    return bool(await system_repo.value_of(db, setting_id, True)) if setting_id else True


async def _events(db) -> EventsOut:
    events: list[EventOut] = []
    for kind in DEFAULT_KINDS:
        kind_id = kind["kindId"]
        if kind_id not in SENDS:
            continue
        push_setting = kind.get("settingId")
        email_default = kind.get("email") if kind_id in EMAIL_SENDS else None
        email_setting = (email_default or {}).get("settingId")
        events.append(
            EventOut(
                id=kind_id,
                label=kind["label"],
                **{"class": kind["class"]},
                push=ChannelOut(
                    available=True,
                    settingId=push_setting,
                    on=await _switch(db, push_setting),
                    locked=push_setting is None,
                ),
                email=ChannelOut(
                    available=email_default is not None,
                    settingId=email_setting,
                    on=email_default is not None and await _switch(db, email_setting),
                    locked=email_default is not None and email_setting is None,
                ),
                job=KIND_JOBS.get(kind_id),
            )
        )
    cfg = settings()
    return EventsOut(
        pushEnabled=bool(await system_repo.value_of(db, MASTER, True)),
        emailEnabled=bool(await system_repo.value_of(db, EMAIL_MASTER, True)),
        pushDriver=cfg.push_driver,
        mailDriver=cfg.mail_driver,
        events=events,
        jobs=[
            NotifyJobOut(description=RUNNABLE_JOBS.get(row["id"], ""), **row)
            for row in await notify_jobs.all_jobs(db)
        ],
    )


@router.get("/notify/events")
async def notify_events(db: Db, p: CanOperate) -> EventsOut:
    """Every kind this build sends, on which channels, whether each is on, and
    when the job behind it runs. Switches are thrown with `PATCH /settings/{id}`."""
    return await _events(db)


class NotifyJobIn(Model):
    enabled: bool | None = None
    weekday: int | None = Field(default=None, ge=0, le=6)
    hour: int | None = Field(default=None, ge=0, le=23)


@router.patch("/notify/jobs/{job}")
async def notify_job_write(job: str, body: NotifyJobIn, db: Db, p: CanOperate) -> EventsOut:
    """Switch a job on or off, or move the weekly summary's day and hour."""
    if job not in notify_jobs.JOB_DEFAULTS:
        raise NotFound(f"There is no job called '{job}'.")
    if (body.weekday is not None or body.hour is not None) and job not in notify_jobs.TIMED:
        raise AppError(
            400, "job_not_timed", "This job has no single time to move — it runs on each person's own."
        )
    await notify_jobs.save(
        db, job, enabled=body.enabled, weekday=body.weekday, hour=body.hour, updated_by=p.subject_id
    )
    return await _events(db)


@router.get("/email/status")
async def email_status(db: Db, p: CanOperate) -> dict[str, Any]:
    """How notification email is set up here, without the password."""
    cfg = settings()
    user = await users_repo.by_id(db, p.subject_id) or {}
    return {
        "driver": cfg.mail_driver,
        "from": cfg.mail_from,
        "host": cfg.smtp_host if cfg.mail_driver == "smtp" else None,
        "enabled": bool(await system_repo.value_of(db, EMAIL_MASTER, True)),
        "you": user.get("email"),
        "youVerified": bool(user.get("emailVerifiedAt")),
    }


class EmailTestIn(Model):
    """Which kind's email to preview. Never a recipient: it goes to the caller."""

    kind: str | None = Field(default=None, max_length=60)


@router.post("/email/test")
async def email_test(db: Db, p: CanOperate, body: EmailTestIn | None = None) -> dict[str, Any]:
    """Email the caller's own address, and nobody else's."""
    await limiter.hit(db, "email:test", p.subject_id, PUSH_TEST_PER_ACCOUNT)
    user = await users_repo.by_id(db, p.subject_id) or {}
    return await email_notify.send_test(db, user, body.kind if body else None)
