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

from app.push_defaults import BY_KIND, MASTER
from app.repos import push_tokens
from app.repos import system as system_repo
from app.settings import settings

log = logging.getLogger("koda.push")

#: How many sends run at once. FCM's batch endpoint is retired, so this is one
#: request per token — bounded, because a family with a school's worth of
#: devices should not open a hundred sockets to say "well done".
CONCURRENCY = 10


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


async def allowed(db: AsyncIOMotorDatabase, kind: str, prefs: dict[str, Any] | None = None) -> bool:
    """Whether this deployment, and then this family, will carry this kind.

    Two gates, in that order, and the order is the point: the operator's row is
    a *ceiling*. A family may switch a thing off for itself; nothing a family
    does switches on what the operator switched off.

    Read at send time rather than cached, matching `repos/system.value_of` — an
    operator throwing a switch expects the next send to feel it, not the one
    after a cache expires.
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
    if setting_id and not await system_repo.value_of(db, setting_id, True):
        return False

    # Account kinds stop here. They carry no preference by design: this is the
    # push equivalent of a password-reset email, and being able to mute "a new
    # device signed in" is not a feature.
    if definition["class"] == "account":
        return True

    return bool((prefs or {}).get(kind, definition["familyDefault"]))


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
        if not await allowed(db, kind):
            return 0

        rows = await push_tokens.live_for_family(
            db, to.family_id, user_id=to.user_id, exclude_device_id=to.exclude_device_id
        )
        if not rows:
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


async def _deliver(db: AsyncIOMotorDatabase, row: dict[str, Any], message: dict[str, str]) -> bool:
    """One token, one request, and the bookkeeping its answer demands."""
    from app.services import fcm

    token = row["token"]
    outcome = await fcm.send_one(token, message)

    if outcome is fcm.Outcome.OK:
        return True
    if outcome is fcm.Outcome.DEAD:
        # Not disabled — deleted. It will never work again, and a push table
        # that only grows is what eventually makes every run slow and every
        # number in it a lie.
        await push_tokens.delete(db, token)
        return False
    if outcome is fcm.Outcome.SOFT:
        await push_tokens.note_failure(db, token)
        return False
    # CONFIG and QUOTA are about the deployment, not the token. Touching the row
    # would blame a parent's phone for an operator's missing IAM role.
    return False
