"""Registering a browser to be rung, and forgetting one.

Two routes, and most of the design is in what they refuse.

A token arrives from a browser that has just been granted permission, and the
only account it may ever be attached to is the one presenting the request. There
is no route here that names a recipient — not for an operator, not for a parent
— because a token plus a chosen recipient is a way to put words on a stranger's
lock screen, and no screen in this product needs that.
"""

from fastapi import APIRouter
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db
from app.errors import Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.push_defaults import DEFAULT_KINDS, MASTER, SENDS
from app.repos import notify_prefs, notify_schedule, push_tokens
from app.repos import system as system_repo
from app.security.rate_limit import PUSH_TEST_PER_ACCOUNT, limiter
from app.services import push as push_service

router = APIRouter(prefix="/push", tags=["push"], dependencies=[AUTHENTICATED])


class TokenIn(Model):
    """What a browser hands over after a parent says yes.

    `ua` and `platform` are stored so a device list can say "Chrome on a Pixel"
    rather than print 163 characters of token at somebody.
    """

    # FCM tokens are long and opaque; the bounds are a sanity check, not a
    # format — pinning the exact shape here would break the day Google changes
    # it, and the only thing that can really validate one is FCM.
    token: str = Field(min_length=32, max_length=4096)
    ua: str | None = Field(default=None, max_length=400)
    platform: str | None = Field(default=None, max_length=60)
    #: Minutes east of UTC, as this browser reports itself.
    #:
    #: Sent here rather than asked for on a screen, and it has to arrive here
    #: rather than being derived from practice: a reminder is *for* a child who
    #: has not practised, and one who never has leaves no event to read a
    #: timezone from. Deriving it from the learning log would have worked for
    #: every family except the ones this kind exists for.
    tz_offset_minutes: int | None = Field(
        default=None, alias="tzOffsetMinutes", ge=-840, le=840
    )


def _adult(p: Principal) -> str | None:
    """The family this caller may register a token for — and never a child's.

    A learner-scoped session is refused outright rather than quietly ignored.
    A kid's tablet is where the app is played, not where it is advertised, and
    the promise is only worth making if it is the endpoint that keeps it rather
    than the screen that happens not to draw the switch.

    Returns `None` for staff, who belong to no family. Deliberately not
    `scoped()`, which refuses them: an operator holding no `familyId` is the
    normal case here rather than a tenancy mistake, and it is what lets them run
    the test send in §7 against the phone in their own hand. A row with no
    family is reachable by nothing that addresses a family.
    """
    if p.learner_id:
        raise Forbidden(
            "Koda does not send notifications to a child's device.",
            "push_learner_forbidden",
        )
    if p.kind != "user" or not p.subject_id:
        raise Forbidden("Only a signed-in account can be notified.", "push_no_account")
    return p.family_id


@router.post("/tokens", status_code=204)
async def register(body: TokenIn, db: Db, p: CurrentPrincipal) -> None:
    """Remember this browser.

    Called on every launch, not only the first: FCM rotates a token on its own
    schedule, and a device that registered once and never again goes quiet
    without telling anybody. The client only sends when the value has changed,
    and this is an upsert, so the repeat is one row either way.
    """
    family_id = _adult(p)
    await push_tokens.save(
        db,
        token=body.token,
        family_id=family_id,
        user_id=p.subject_id,
        device_id=p.device_id,
        ua=body.ua,
        platform=body.platform,
    )
    if body.tz_offset_minutes is not None:
        # Kept on the schedule rather than the token, because it answers a
        # question about the *person* — what hour is it where they are — and one
        # person's three browsers must not disagree about that.
        await notify_schedule.save(
            db, p.subject_id, tz_offset_minutes=body.tz_offset_minutes
        )


@router.delete("/tokens/{token}", status_code=204)
async def forget(token: str, db: Db, p: CurrentPrincipal) -> None:
    """Stop ringing this browser — a parent switching notifications off.

    Scoped by family rather than checked by permission: a token belonging to
    somebody else is simply not there, which is the same shape every other
    lookup in this service has.
    """
    _adult(p)
    # Idempotent, and by `userId` rather than by family: a token belongs to the
    # browser one person granted permission in.
    #
    # A token that is not there is not an error — it is the state the caller
    # asked for. FCM rotates tokens on its own schedule and revoking a device
    # deletes its row, so a browser can quite normally hold a value the server
    # has already forgotten; answering 404 turned "stop notifying me" into a
    # failure for somebody whose wish had already come true. Not finding it
    # because it belongs to someone else answers the same way, which also means
    # this route never confirms whether a stranger's token exists.
    await db.push_tokens.delete_one({"token": token, "userId": p.subject_id})


class KindOut(Model):
    """One switch as a parent sees it."""

    id: str
    label: str
    on: bool


class PreferencesOut(Model):
    #: The deployment's master. False means the screen should say Koda is not
    #: sending notifications here at all, rather than draw switches that lie.
    enabled: bool
    kinds: list[KindOut]


class PreferenceIn(Model):
    kind: str = Field(max_length=60)
    on: bool


async def _preferences(db, p: Principal) -> PreferencesOut:
    """What this account may choose, and what it has chosen.

    Kinds the operator has switched off are **absent**, not shown as off: a
    switch a family cannot move is not a setting, it is a decision somebody else
    made, and drawing it would invite a parent to fix something they cannot.
    Account kinds are absent for the same reason — they carry no preference.

    So is a kind this build has no sender for. The catalog is the design and
    `SENDS` is what the code does; while a phase is in flight they differ, and
    the difference must not reach a parent as a switch. Turning on a reminder
    that nothing sends, waiting a week and concluding notifications are broken
    is a worse first impression than the switch not being there yet.
    """
    chosen = await notify_prefs.for_user(db, p.subject_id)
    master = await system_repo.value_of(db, MASTER, True)

    kinds: list[KindOut] = []
    for kind in DEFAULT_KINDS:
        if kind["class"] != "courtesy" or kind["kindId"] not in SENDS:
            continue
        if not await system_repo.value_of(db, kind["settingId"], True):
            continue
        kinds.append(
            KindOut(
                id=kind["kindId"],
                label=kind["label"],
                on=bool(chosen.get(kind["kindId"], kind["familyDefault"])),
            )
        )

    return PreferencesOut(enabled=bool(master), kinds=kinds)


@router.get("/preferences")
async def preferences(db: Db, p: CurrentPrincipal) -> PreferencesOut:
    _adult(p)
    return await _preferences(db, p)


@router.put("/preferences")
async def choose(body: PreferenceIn, db: Db, p: CurrentPrincipal) -> PreferencesOut:
    """Turn one kind on or off for this account.

    One kind per call rather than a whole object: two browsers changing two
    switches at the same moment must not overwrite each other.
    """
    _adult(p)
    definition = next((k for k in DEFAULT_KINDS if k["kindId"] == body.kind), None)
    if definition is None or definition["class"] != "courtesy" or body.kind not in SENDS:
        # An account kind has no preference to set, an unknown one is a client
        # bug, and one nothing sends yet is not a switch this build offers.
        # All three are the same answer: there is no such setting.
        raise NotFound(f"There is no notification setting called '{body.kind}'.")

    await notify_prefs.set_pref(db, p.subject_id, body.kind, body.on)
    return await _preferences(db, p)


class ScheduleOut(Model):
    """When this account may be rung, as a parent sets it."""

    #: The hour a reminder goes out, in their own local time.
    reminder_hour: int = Field(alias="reminderHour")
    #: The window nothing courtesy-class may arrive in. Equal values mean none.
    quiet_from: int = Field(alias="quietFrom")
    quiet_to: int = Field(alias="quietTo")


class ScheduleIn(Model):
    """Every field optional: a screen changes one control at a time."""

    reminder_hour: int | None = Field(default=None, alias="reminderHour", ge=0, le=23)
    quiet_from: int | None = Field(default=None, alias="quietFrom", ge=0, le=23)
    quiet_to: int | None = Field(default=None, alias="quietTo", ge=0, le=23)
    #: What the browser reports about itself, so a job can tell whose evening it
    #: is. Sent by the client rather than asked for: the alternative is a
    #: timezone picker, which is a question nobody should be asked twice.
    tz_offset_minutes: int | None = Field(
        default=None, alias="tzOffsetMinutes", ge=-840, le=840
    )


def _schedule_out(row: dict) -> ScheduleOut:
    return ScheduleOut(
        reminderHour=row["reminderHour"], quietFrom=row["quietFrom"], quietTo=row["quietTo"]
    )


@router.get("/schedule")
async def schedule(db: Db, p: CurrentPrincipal) -> ScheduleOut:
    """When this account has said it may be rung."""
    _adult(p)
    return _schedule_out(await notify_schedule.for_user(db, p.subject_id))


@router.put("/schedule")
async def set_schedule(body: ScheduleIn, db: Db, p: CurrentPrincipal) -> ScheduleOut:
    """Choose the reminder hour, or the window to be left alone in.

    Both live here rather than beside the on/off switches because they are the
    same kind of thing — *when*, not *whether* — and because quiet hours govern
    every courtesy kind at once rather than any one of them.
    """
    _adult(p)
    return _schedule_out(
        await notify_schedule.save(
            db,
            p.subject_id,
            reminder_hour=body.reminder_hour,
            quiet_from=body.quiet_from,
            quiet_to=body.quiet_to,
            tz_offset_minutes=body.tz_offset_minutes,
        )
    )


@router.post("/test", status_code=200)
async def test_my_own(db: Db, p: CurrentPrincipal) -> dict:
    """Ring this account's own browsers, so a parent can check it works.

    The same rule as the operator's version in `system.py`, and here for a
    plainer reason: somebody who has just turned notifications on wants to know
    they will actually arrive, and until now the only way to find out was to
    hold a staff account or to wait for something to happen. "Did that work?" is
    a fair question to be able to answer about your own phone.

    No recipient, and none possible: it rings the browsers belonging to the
    caller and nobody else's. Rate limited like the operator's, because it
    spends real quota and real battery.
    """
    _adult(p)
    await limiter.hit(db, "push:selftest", p.subject_id, PUSH_TEST_PER_ACCOUNT)
    return await push_service.send_test(db, p.subject_id)
