"""Sending a notification, behind one function and two drivers.

Deliberately the same shape as `mail.py`, for the same reasons: the test suite
and a fresh checkout need no Firebase project, and swapping the transport later
is a driver rather than a refactor. The differences from mail are the ones the
medium forces:

* **A send is per device, not per person.** One parent may hold three browsers,
  and each holds its own token.
* **The transport answers per token**, and half of what it says is about the
  token rather than the message — `UNREGISTERED` means the browser threw the
  subscription away, and the only correct response is to forget the row. That
  bookkeeping lives here, in `_handle`, because a caller should not have to know
  FCM's vocabulary to tell a parent their child met a goal.

Like `mail.send`, this never raises. Every caller is a route whose real work has
already succeeded or a scheduled job whose next run will do the same thing
again; a notification that could turn a completed lesson into a 500 is worse
than no notification at all.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.push_defaults import BODY_MAX, BY_KIND, MASTER, SAMPLES, TITLE_MAX
from app.repos import memberships, notifications, notify_prefs, push_templates, push_tokens
from app.repos import system as system_repo
from app.settings import settings

log = logging.getLogger("koda.push")

#: How many sends run at once. FCM's batch endpoint is retired, so this is one
#: request per token — bounded, because a family with a school's worth of
#: devices should not open a hundred sockets to say "well done".
CONCURRENCY = 10

#: Who counts as a person a notification is addressed to. Learner roles are
#: absent on purpose: a child's session cannot hold a token, so addressing one
#: would only ever write a record nobody can be shown.
ADULT_ROLES = {"owner", "parent", "caregiver"}


@dataclass(frozen=True)
class Recipient:
    """Who to ring, in the only terms this service can address.

    A family is always named, because every query in the service is scoped to
    one. `user_id` narrows it to one adult; `exclude_device_id` spares the
    device that caused the notification, which is what stops "a new device
    signed in" arriving on the device signing in.
    """

    family_id: str
    user_id: str | None = None
    exclude_device_id: str | None = None


async def deployment_allows(db: AsyncIOMotorDatabase, kind: str) -> bool:
    """The operator's half of the question, which is the same for everybody.

    Split from `allowed` because a family send asks it once and then asks each
    adult separately: two parents on one account may want different things, and
    a notification that consults only the first of them is not a preference.
    """
    definition = BY_KIND.get(kind)
    if definition is None:
        # A kind nobody declared is a bug in the caller, and sending it anyway
        # would put words in front of a parent that no review ever saw.
        log.error("refusing to send unknown notification kind %r", kind)
        return False

    if not await system_repo.value_of(db, MASTER, True):
        return False

    setting_id = definition["settingId"]
    return not (setting_id and not await system_repo.value_of(db, setting_id, True))


def wanted_by(kind: str, prefs: dict[str, Any] | None) -> bool:
    """Whether one person wants this kind, given what they have chosen.

    Account kinds do not ask. They carry no preference by design: this is the
    push equivalent of a password-reset email, and being able to mute "a new
    device signed in" is not a feature.
    """
    definition = BY_KIND.get(kind)
    if definition is None:
        return False
    if definition["class"] == "account":
        return True
    return bool((prefs or {}).get(kind, definition["familyDefault"]))


async def allowed(db: AsyncIOMotorDatabase, kind: str, prefs: dict[str, Any] | None = None) -> bool:
    """Whether this deployment, and then this family, will carry this kind.

    Two gates, in that order, and the order is the point: the operator's row is
    a *ceiling*. A family may switch a thing off for itself; nothing a family
    does switches on what the operator switched off.

    Read at send time rather than cached, matching `repos/system.value_of` — an
    operator throwing a switch expects the next send to feel it, not the one
    after a cache expires.
    """
    return await deployment_allows(db, kind) and wanted_by(kind, prefs)


async def send(
    db: AsyncIOMotorDatabase,
    *,
    to: Recipient,
    kind: str,
    title: str,
    body: str,
    path: str = "/",
) -> int:
    """Ring every live browser this recipient has. Returns how many went.

    Never raises.
    """
    try:
        if not await deployment_allows(db, kind):
            return 0

        # People first, browsers second — and in that order for a reason. The
        # record is what a person can go back and read; the push is a best-effort
        # tap on the shoulder. Somebody with no browser registered still gets the
        # history, which is the whole point of keeping one.
        people = await _people(db, to)
        prefs = await notify_prefs.for_users(db, people)
        people = [user_id for user_id in people if wanted_by(kind, prefs.get(user_id))]
        if not people:
            return 0

        for user_id in people:
            await notifications.record(
                db, user_id=user_id, family_id=to.family_id, kind=kind, title=title, body=body, path=path
            )

        rows = await push_tokens.live_for_family(
            db, to.family_id, user_id=to.user_id, exclude_device_id=to.exclude_device_id
        )
        wanted = set(people)
        rows = [row for row in rows if row.get("userId") in wanted]
        if not rows:
            # Nobody to ring is not nobody told: the records above stand, and
            # the app will show them next time somebody opens it.
            return 0

        message = {"title": title, "body": body, "path": path, "kind": kind, "tag": kind}
        cfg = settings()

        if cfg.push_driver == "console":
            # The whole message, so a developer can read it out of `make
            # logs-api` — the deal `mail_driver` already offers. Reported as
            # zero sent, because zero is what left the process.
            for row in rows:
                log.info(
                    "push (console driver)\nTo: %s (%s)\n%s\n%s\n→ %s",
                    row.get("userId"),
                    row.get("platform") or "unknown device",
                    title,
                    body,
                    path,
                )
            return 0

        semaphore = asyncio.Semaphore(CONCURRENCY)

        async def one(row: dict[str, Any]) -> bool:
            async with semaphore:
                return await _deliver(db, row, message)

        results = await asyncio.gather(*(one(row) for row in rows))
        return sum(1 for ok in results if ok)
    except Exception:  # noqa: BLE001 — every failure here is the same failure
        log.exception("could not send %s notification", kind)
        return 0


async def _people(db: AsyncIOMotorDatabase, to: Recipient) -> list[str]:
    """Who this notification is addressed to, as accounts rather than devices.

    A family send reaches the adults in it. Children are not addressed at all —
    a learner session cannot hold a token, so a record for one would be a note
    nobody can be shown.
    """
    if to.user_id:
        return [to.user_id]

    people = {
        member["userId"]
        for member in await memberships.for_family(db, to.family_id)
        if member.get("role") in ADULT_ROLES
    }

    # Plus anyone in this family who actually holds a browser.
    #
    # Membership is the right list, and a missing row is the wrong reason to
    # stop notifying somebody: a person whose registered browser says they
    # belong to this family should hear about it whatever the membership
    # collection has lost. It cannot over-reach — a token row carries the same
    # `familyId` the query is already scoped to.
    for row in await push_tokens.live_for_family(db, to.family_id):
        if row.get("userId"):
            people.add(row["userId"])

    return sorted(people)


async def _deliver(db: AsyncIOMotorDatabase, row: dict[str, Any], message: dict[str, str]) -> bool:
    """One token, one request, and the bookkeeping its answer demands."""
    from app.services import fcm

    return await _deliver_one(db, row, message) is fcm.Outcome.OK


async def _deliver_one(db: AsyncIOMotorDatabase, row: dict[str, Any], message: dict[str, str]) -> Any:
    """The same send, reporting *why* rather than only whether.

    Split out for the operator test, which has to print FCM's own word for the
    failure — "it did not work" is the answer preflight exists to improve on.
    """
    from app.services import fcm

    token = row["token"]
    outcome = await fcm.send_one(token, message)

    if outcome is fcm.Outcome.DEAD:
        # Not disabled — deleted. It will never work again, and a push table
        # that only grows is what eventually makes every run slow and every
        # number in it a lie.
        await push_tokens.delete(db, token)
    elif outcome is fcm.Outcome.SOFT:
        await push_tokens.note_failure(db, token)
    # CONFIG and QUOTA are about the deployment, not the token. Touching the row
    # would blame a parent's phone for an operator's missing IAM role.
    return outcome


#: What the test send says about itself. A notification a person cannot explain
#: is a support ticket, so it explains itself in its own body.
TEST_TITLE = "Test notification"
TEST_BODY = "You asked for this from Admin → Settings. Notifications are working."

#: The same check, asked by the person whose phone it is.
#:
#: Separate wording because the operator's names a screen a parent has never
#: seen: being told you asked for something from Admin → Settings, when you
#: pressed a button in your own Settings, is a notification explaining itself
#: incorrectly — which is the one thing a test notification must not do.
SELF_TITLE = "Notifications are on"
SELF_BODY = "This is how Koda will reach you on this device."


async def preflight(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """Prove the pipe without sending anything to anybody.

    Push is the one feature here an operator cannot verify by looking at it, and
    its failure mode is silence: nothing errors, parents simply never hear
    anything, and the deployment finds out weeks later. Every check below
    answers with a verdict and, when it fails, the sentence that fixes it —
    "preflight failed" is not a result anyone can act on.
    """
    cfg = settings()
    checks: list[dict[str, Any]] = []

    def note(name: str, ok: bool, detail: str, fix: str | None = None) -> bool:
        # A passing check carries no fix. Printing "here is how to fix it"
        # beside a PASS is how a diagnostic screen teaches people to stop
        # reading it.
        checks.append({"check": name, "ok": ok, "detail": detail, "fix": None if ok else fix})
        return ok

    driver_ok = note(
        "driver",
        cfg.push_driver == "fcm",
        f"PUSH_DRIVER is '{cfg.push_driver}'",
        None if cfg.push_driver == "fcm" else "Set PUSH_DRIVER=fcm. Notifications are only being logged.",
    )
    project_ok = note(
        "project",
        bool(cfg.firebase_project_id),
        cfg.firebase_project_id or "unset",
        None if cfg.firebase_project_id else "Set FIREBASE_PROJECT_ID to the Firebase project that owns the tokens.",
    )

    if driver_ok and project_ok:
        ok, detail = await asyncio.to_thread(_credentials_check)
        note(
            "credential",
            ok,
            detail,
            None if ok else "Grant roles/firebasemessaging.admin to the service account this runs as.",
        )
    else:
        note("credential", False, "not checked", "Fix the driver and project first.")

    note(
        "master",
        bool(await system_repo.value_of(db, MASTER, True)),
        "push.enabled",
        "Everything is configured and switched off — turn on Push notifications in Admin → Settings.",
    )

    counts = await push_tokens.coverage(db)
    # Written out rather than "1 browser(s) across 0 family(ies)". This is a
    # line an operator reads at a glance to decide whether anything is wrong,
    # and a sentence that cannot be bothered to pluralise reads as a value
    # nobody checked.
    browsers = "no browsers" if not counts["tokens"] else f"{counts['tokens']} browser" + ("" if counts["tokens"] == 1 else "s")
    if not counts["families"]:
        families = "no families yet"
    else:
        families = f"{counts['families']} famil" + ("y" if counts["families"] == 1 else "ies")
    note("coverage", True, f"{browsers} registered, across {families}")

    # The last check needs a real token, and on a new deployment there is not
    # one yet. Absent is not a failure: it is the honest answer that this half
    # cannot be proved until somebody turns notifications on. Which of the two
    # reasons it was skipped for is stated rather than guessed at — "no live
    # token" printed while a token plainly exists is worse than saying nothing.
    if driver_ok and project_ok and counts["tokens"]:
        from app.services import fcm

        row = (await db.push_tokens.find_one({"disabledAt": None})) or {}
        outcome = await fcm.send_one(
            row["token"],
            {"title": TEST_TITLE, "body": TEST_BODY, "path": "/", "kind": "system.preflight"},
            validate_only=True,
        )
        note(
            "reachability",
            outcome is fcm.Outcome.OK,
            f"validateOnly send returned {outcome.value}",
            None if outcome is fcm.Outcome.OK else "FCM refused a message it was only asked to validate.",
        )
    elif not (driver_ok and project_ok):
        note("reachability", False, "not checked — the driver or project is not configured yet")
    else:
        note("reachability", False, "not checked — no live token to validate against")

    return {"ok": all(check["ok"] for check in checks), "checks": checks}


def _credentials_check() -> tuple[bool, str]:
    from app.services import fcm

    return fcm.check_credentials()


async def send_test(
    db: AsyncIOMotorDatabase,
    user_id: str,
    kind: str | None = None,
    *,
    from_admin: bool = False,
) -> dict[str, Any]:
    """A real notification, to the caller's own browsers and nowhere else.

    **There is no recipient parameter, and there must never be one.** A test
    endpoint that accepts a target is an arbitrary-push primitive wearing an
    admin badge — the one thing in this design that could put words chosen by
    whoever holds a staff token onto a stranger's lock screen. The operator is
    holding a phone; that is the device the test is for.

    It ignores preferences, quiet hours *and* `push.enabled`: the moment you
    most need to test is before the master is switched on. The response says so
    rather than leaving an operator to wonder why a switched-off deployment
    rang.
    """
    cfg = settings()
    rows = await push_tokens.live_for_user(db, user_id)

    # Naming a kind previews *that kind's wording* — the operator's own words if
    # they have edited them — filled with sample values. Which is the only way
    # to answer "does my new copy read well on a lock screen?" without waiting
    # for the event itself to happen to somebody.
    #
    # A kind is not a recipient. This still rings the caller's own browsers and
    # nobody else's.
    if kind and kind in BY_KIND:
        title, body = await wording(db, kind, SAMPLES)
    elif from_admin:
        title, body = TEST_TITLE, TEST_BODY
    else:
        title, body = SELF_TITLE, SELF_BODY

    message = {"title": title, "body": body, "path": "/", "kind": "system.test", "tag": "system.test"}

    if not rows:
        # Two very different situations wearing the same symptom, and saying the
        # wrong one sends an operator to re-do something that already worked.
        #
        # Nothing registered anywhere is a setup step. Browsers registered but
        # none of them *yours* is the test doing what it promises — it rings the
        # caller's own devices and nobody else's — and the usual cause is
        # turning notifications on while signed in as one account and testing
        # from another, which is normal here, because Admin needs a platform
        # account and a phone is usually signed in as a family one.
        counts = await push_tokens.coverage(db)
        if counts["tokens"]:
            note = (
                f"No browser is registered to this account, though {counts['tokens']} "
                f"{'is' if counts['tokens'] == 1 else 'are'} registered on this deployment. "
                "The test only ever rings your own devices. If you turned notifications on "
                "while signed in as a different account, sign in as that one and test there."
            )
        else:
            note = "No browser is registered anywhere yet. Turn notifications on in Settings first."
        return {"driver": cfg.push_driver, "sent": 0, "results": [], "note": note}

    if cfg.push_driver == "console":
        log.info("push test (console driver)\n%s\n%s", title, body)
        return {
            "driver": "console",
            "sent": 0,
            "results": [],
            "note": "The console driver logs and sends nothing, so nothing was delivered.",
            "message": message,
        }

    from app.services import fcm

    results = []
    for row in rows:
        outcome = await _deliver_one(db, row, message)
        results.append(
            {
                "device": row.get("platform") or row.get("ua") or "unknown browser",
                "ok": outcome is fcm.Outcome.OK,
                "error": None if outcome is fcm.Outcome.OK else outcome.value,
            }
        )

    return {
        "driver": "fcm",
        "sent": sum(1 for result in results if result["ok"]),
        "results": results,
        "note": "Sent whatever push.enabled says, because a test before the master is on is the point.",
    }


def fill(template: str, values: dict[str, Any]) -> str:
    """Substitute the placeholders a kind declares, and nothing else.

    Deliberately not `str.format`: an operator editing wording is not writing
    Python, and `{0}` or an unclosed brace should not be able to raise inside a
    send. A placeholder nobody supplied is left standing, so a typo shows up in
    the preview rather than disappearing silently on somebody's lock screen.
    """
    filled = template
    for key, value in values.items():
        filled = filled.replace("{" + key + "}", str(value))
    return filled


async def wording(db: AsyncIOMotorDatabase, kind: str, values: dict[str, Any] | None = None) -> tuple[str, str]:
    """What this kind says — the operator's wording if they changed it, else ours."""
    definition = BY_KIND.get(kind, {})
    override = await push_templates.get(db, kind) or {}
    title = override.get("title") or definition.get("title", "Koda")
    body = override.get("body") or definition.get("body", "Open Koda to see what's new.")
    return fill(title, values or {})[:TITLE_MAX], fill(body, values or {})[:BODY_MAX]
