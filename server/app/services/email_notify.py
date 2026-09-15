"""Notification email: the second channel, behind the same catalog as push.

A kind goes by email only when the same three things agree that push asks, in
the same order: the deployment (`email.enabled`, then the kind's own email
switch), the build (the kind is in `EMAIL_SENDS`), and the person — whose
choices are `notify_prefs` rows on the `email` channel, with a "stop all" row
beside them. Account kinds skip the person's half, as their push half does.

**Addressed to accounts, never to an address in a request.** The people come
from a family's adults or from a caller already holding user ids, and each
address is read off the user row. Only a verified address is written to: an
unverified one may belong to somebody who never asked for Koda.

**Plain text, framed once.** Every kind's words sit inside one operator-editable
frame — a greeting and a footer — so the way out of these emails is written in
one place and cannot be forgotten by a kind.

Like `mail.send` and `push.send`, nothing here raises.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.push_defaults import BY_KIND, EMAIL_FRAME, EMAIL_MASTER, EMAIL_SENDS, EMAIL_SUBJECT_MAX, SAMPLES
from app.repos import notify_prefs, push_log, push_templates
from app.repos import system as system_repo
from app.repos import users as users_repo
from app.services import mail, push
from app.settings import settings

log = logging.getLogger("koda.email_notify")

CHANNEL = "email"

#: The `notify_prefs` kind that means "no progress emails at all". Account
#: notices ignore it, for the reason they ignore every other choice.
STOP_ALL = "*"

UNSUBSCRIBE_AUDIENCE = "koda-unsubscribe"

#: How long an unsubscribe link keeps working. Long: people find a year-old
#: email and expect the link at the bottom of it to still do what it says.
UNSUBSCRIBE_TTL = timedelta(days=365)


def unsubscribe_token(user_id: str, kind: str) -> str:
    """A signed "stop this kind for this person", good without signing in."""
    cfg = settings()
    issued = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "kind": kind,
        "aud": UNSUBSCRIBE_AUDIENCE,
        "iat": issued,
        "exp": issued + UNSUBSCRIBE_TTL,
    }
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def read_unsubscribe_token(token: str) -> tuple[str, str] | None:
    """(user id, kind), or None for anything expired, forged or meaningless."""
    cfg = settings()
    try:
        claims = jwt.decode(
            token, cfg.jwt_secret, algorithms=[cfg.jwt_algorithm], audience=UNSUBSCRIBE_AUDIENCE
        )
    except jwt.InvalidTokenError:
        return None
    user_id, kind = claims.get("sub"), claims.get("kind")
    if not isinstance(user_id, str) or not isinstance(kind, str):
        return None
    if kind != STOP_ALL and kind not in BY_KIND:
        return None
    return user_id, kind


def unsubscribe_link(user_id: str, kind: str) -> str:
    # Through the app's own address: the web server forwards `/v1` to the API,
    # and a link naming the API's Cloud Run URL would be a second domain in a
    # parent's inbox for no reason.
    return (
        f"{settings().app_base_url}/v1/notifications/unsubscribe"
        f"?token={unsubscribe_token(user_id, kind)}"
    )


async def deployment_allows(db: AsyncIOMotorDatabase, kind: str) -> bool:
    """The operator's half, the same for everybody."""
    definition = BY_KIND.get(kind) or {}
    email = definition.get("email")
    if not email or kind not in EMAIL_SENDS:
        return False
    if not await system_repo.value_of(db, EMAIL_MASTER, True):
        return False
    setting_id = email.get("settingId")
    return not (setting_id and not await system_repo.value_of(db, setting_id, True))


def wanted_by(kind: str, prefs: dict[str, bool] | None) -> bool:
    """Whether one person wants this kind by email, given what they chose."""
    definition = BY_KIND.get(kind) or {}
    email = definition.get("email")
    if not email:
        return False
    if definition["class"] == "account":
        return True
    prefs = prefs or {}
    if prefs.get(STOP_ALL) is False:
        return False
    return bool(prefs.get(kind, email.get("default", False)))


async def wording(db: AsyncIOMotorDatabase, kind: str, values: dict[str, Any] | None = None) -> tuple[str, str]:
    """This kind's subject and message — the operator's words if edited, else ours."""
    definition = (BY_KIND.get(kind) or {}).get("email") or {}
    override = await push_templates.get_email(db, kind) or {}
    subject = override.get("subject") or definition.get("subject", "A message from Koda")
    body = override.get("body") or definition.get("body", "{message}")
    filled = values or {}
    return push.fill(subject, filled)[:EMAIL_SUBJECT_MAX], push.fill(body, filled)


async def frame(db: AsyncIOMotorDatabase) -> dict[str, str]:
    override = await push_templates.get_frame(db) or {}
    return {part: override.get(part) or default for part, default in EMAIL_FRAME.items()}


def first_name(user: dict[str, Any]) -> str:
    name = (user.get("displayName") or "").strip()
    return name.split()[0] if name else "there"


async def compose(
    db: AsyncIOMotorDatabase,
    kind: str,
    values: dict[str, Any] | None,
    *,
    user_id: str,
    parent: str,
    family: str | None = None,
) -> tuple[str, str, str]:
    """(subject, message, the finished text) for one person."""
    cfg = settings()
    filled = {
        "parent": parent,
        "family": family or "your family",
        "app_link": cfg.app_base_url,
        **(values or {}),
    }
    subject, message = await wording(db, kind, filled)
    parts = await frame(db)
    text = push.fill(parts["body"], {"parent": parent, "message": message})
    if BY_KIND[kind]["class"] == "account":
        footer = push.fill(parts["accountFooter"], {"app_link": cfg.app_base_url})
    else:
        footer = push.fill(
            parts["footer"],
            {
                "kind_label": BY_KIND[kind]["label"],
                "app_link": cfg.app_base_url,
                "unsubscribe_link": unsubscribe_link(user_id, kind),
            },
        )
    return subject, message, f"{text}\n\n---\n{footer}"


async def send(
    db: AsyncIOMotorDatabase,
    *,
    kind: str,
    values: dict[str, Any] | None = None,
    family_id: str | None = None,
    user_ids: list[str | None] | None = None,
    path: str = "/",
) -> int:
    """Email everyone this is addressed to who wants it. Returns how many went.

    `user_ids` names the accounts when the caller has them (an inviter, staff);
    otherwise the adults of `family_id`. Zero on the console driver, like push:
    zero is what left the process. Never raises.
    """
    try:
        if not await deployment_allows(db, kind):
            return 0

        if user_ids is not None:
            people = [user_id for user_id in user_ids if user_id]
        elif family_id:
            people = await push.adults_of(db, family_id)
        else:
            return 0
        if not people:
            return 0

        prefs = await notify_prefs.for_users(db, people, channel=CHANNEL)
        family = None
        if family_id:
            row = await db.families.find_one({"_id": family_id}, {"name": 1})
            family = (row or {}).get("name")

        cfg = settings()
        told: list[str] = []
        sent = failed = unreachable = 0
        logged_subject = logged_message = ""

        for user_id in people:
            if not wanted_by(kind, prefs.get(user_id)):
                continue
            user = await users_repo.by_id(db, user_id)
            if (
                not user
                or not user.get("email")
                or user.get("status", "active") != "active"
                or not user.get("emailVerifiedAt")
            ):
                unreachable += 1
                continue

            subject, message, text = await compose(
                db, kind, values, user_id=user_id, parent=first_name(user), family=family
            )
            headers = None
            if BY_KIND[kind]["class"] != "account":
                link = unsubscribe_link(user_id, kind)
                headers = {
                    "List-Unsubscribe": f"<{link}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                }
            if await mail.send(user["email"], subject, text, headers=headers):
                sent += 1
            else:
                failed += 1
            told.append(user_id)
            # The log keeps the kind's words, not the framed letter: the frame
            # carries a name and a personal unsubscribe token, and neither
            # belongs in an operator's list.
            logged_subject, logged_message = logged_subject or subject, logged_message or message

        if not told and not unreachable:
            return 0

        live = cfg.mail_driver != "console"
        outcomes: dict[str, int] = {}
        if live and sent:
            outcomes["sent"] = sent
        if failed:
            outcomes["failed"] = failed
        if unreachable:
            outcomes["unverified"] = unreachable
        await push_log.record(
            db,
            kind=kind,
            family_id=family_id,
            people=told,
            title=logged_subject,
            body=logged_message,
            path=path,
            driver=cfg.mail_driver,
            devices=len(told),
            delivered=sent if live else 0,
            outcomes=outcomes,
            channel=CHANNEL,
        )
        return sent if live else 0
    except Exception:  # noqa: BLE001 — every failure here is the same failure
        log.exception("could not email %s", kind)
        return 0


async def send_test(db: AsyncIOMotorDatabase, user: dict[str, Any], kind: str | None) -> dict[str, Any]:
    """A real email to the caller's own address, and nobody else's.

    Naming a kind previews that kind's wording, filled with sample values and
    framed exactly as a parent would read it. Like the push test, there is no
    recipient to choose.
    """
    cfg = settings()
    address = user.get("email")
    if not address:
        return {"driver": cfg.mail_driver, "sent": False, "to": None, "note": "This account has no email address."}

    if kind and (BY_KIND.get(kind) or {}).get("email"):
        subject, _, text = await compose(
            db, kind, SAMPLES, user_id=user["_id"], parent=first_name(user), family=SAMPLES["family"]
        )
        subject = f"[Test] {subject}"
    else:
        subject = "[Test] Koda notification email"
        text = (
            f"Hi {first_name(user)},\n\n"
            "This is a test from Notification Settings → Email. Notification emails are working.\n\n— Koda"
        )

    ok = await mail.send(address, subject, text)
    if cfg.mail_driver == "console":
        note = "The console driver writes the email to the service log and sends nothing."
    elif ok:
        note = None
    else:
        note = "The mail server refused it. The service log has the reason."
    return {"driver": cfg.mail_driver, "sent": ok and cfg.mail_driver != "console", "to": address, "note": note}
