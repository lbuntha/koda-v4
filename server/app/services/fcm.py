"""The transport: one message, one HTTPS request, one verdict.

Kept apart from `push.py` so the decision *whether* to notify somebody and the
business of talking to Google are not the same file. This one knows FCM's
vocabulary; nothing above it does.

Two choices worth stating, because both are the reason there is no credential in
this repository:

* **HTTP v1, not the legacy server key.** The legacy API is gone, so there is no
  simpler thing to be tempted by — and v1 authenticates with an OAuth token
  rather than a shared secret.
* **Application Default Credentials.** On Cloud Run that is the runtime service
  account, minted from the metadata server. There is no service-account JSON
  anywhere: not in the repo, not in GitHub secrets, not in an env var. Granting
  `roles/firebasemessaging.admin` to `koda-backend` is the whole of the setup.

`google-auth` is already a dependency — Google sign-in uses it — and its
`AuthorizedSession` mints and refreshes the access token by itself, which is
also why nothing here caches one. It is a blocking library, so the request runs
in a thread, exactly as `mail.py` runs `smtplib`.
"""

import asyncio
import logging
import random
from enum import Enum
from typing import Any

from app.settings import settings

log = logging.getLogger("koda.push")

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
ENDPOINT = "https://fcm.googleapis.com/v1/projects/{project}/messages:send"

#: Soft failures are retried here rather than left to the next scheduled run,
#: because a weekly summary has no next run worth waiting for.
RETRIES = 2
TIMEOUT_SECONDS = 15


class Outcome(Enum):
    """What one send means for the token it was sent to.

    Deliberately about *consequences*, not about status codes: the caller's job
    is to keep the token table honest, and these are the only four things that
    can be true of a row afterwards.
    """

    OK = "ok"
    #: The browser threw the subscription away, or it was never ours. Delete it.
    DEAD = "dead"
    #: FCM is having a moment. Count it; three in a row retires the row.
    SOFT = "soft"
    #: The deployment is misconfigured — a missing role, a wrong Web Push
    #: certificate. Nothing will work until a person fixes it, so retrying is
    #: only a way to make the logs longer.
    CONFIG = "config"
    #: Too many, too fast. Stop rather than storm.
    QUOTA = "quota"


#: Error codes FCM returns about the *token*. Everything else is about us.
_DEAD_CODES = {"UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH", "NOT_FOUND"}
_CONFIG_CODES = {"THIRD_PARTY_AUTH_ERROR", "PERMISSION_DENIED", "UNAUTHENTICATED", "SENDER_ID_MISMATCH"}


def _session() -> Any:
    """An authorised session, built per call and cheap to build.

    The credential it wraps is discovered once by `google.auth.default()` and
    the session refreshes the access token on its own an hour at a time, so this
    is not a request to Google.
    """
    import google.auth
    from google.auth.transport.requests import AuthorizedSession

    credentials, _ = google.auth.default(scopes=[SCOPE])
    return AuthorizedSession(credentials)


def envelope(token: str, message: dict[str, str], *, validate_only: bool = False) -> dict[str, Any]:
    """The message as FCM wants it. One place, so the shape cannot drift.

    **`data` only, and no `notification` block.** With a `notification` payload
    the browser draws its own — meaning the copy, the icon and the tap target
    stop being ours, and a page in the foreground gets two of them. Sending data
    keeps one code path for foreground and background alike, and the service
    worker decides what a parent actually reads.
    """
    cfg = settings()
    path = message.get("path", "/")
    body: dict[str, Any] = {
        "message": {
            "token": token,
            "data": {key: str(value) for key, value in message.items()},
            "webpush": {
                # A day for a courtesy notification: a practice reminder
                # delivered on Thursday is a wrong notification, not a late one.
                "headers": {"TTL": "86400", "Urgency": "normal"},
                "fcm_options": {"link": f"{cfg.app_base_url.rstrip('/')}{path}"},
            },
        }
    }
    if validate_only:
        # Checked against the real credential and a real token, then thrown
        # away. This is what lets an operator prove the whole server half of the
        # chain without buzzing a parent at nine in the evening.
        body["validateOnly"] = True
    return body


def _classify(status: int, payload: dict[str, Any]) -> Outcome:
    error = payload.get("error", {}) if isinstance(payload, dict) else {}
    codes = {error.get("status", "")}
    for detail in error.get("details", []) or []:
        if isinstance(detail, dict) and detail.get("errorCode"):
            codes.add(detail["errorCode"])

    if codes & _CONFIG_CODES and status in (401, 403):
        return Outcome.CONFIG
    if codes & _DEAD_CODES or status == 404:
        return Outcome.DEAD
    if status == 429:
        return Outcome.QUOTA
    if status in (401, 403):
        return Outcome.CONFIG
    if status >= 500:
        return Outcome.SOFT
    if status == 400:
        # A 400 that is not about the token is about the message, which is our
        # bug and will be a bug on every retry.
        return Outcome.DEAD if codes & _DEAD_CODES else Outcome.CONFIG
    return Outcome.SOFT


def _post(url: str, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """The blocking half, isolated so a test can replace it with a fake FCM."""
    response = _session().post(url, json=body, timeout=TIMEOUT_SECONDS)
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    return response.status_code, payload


async def send_one(token: str, message: dict[str, str], *, validate_only: bool = False) -> Outcome:
    """Deliver one message, retrying only what is worth retrying."""
    cfg = settings()
    if not cfg.firebase_project_id:
        # Configured to send with nowhere to send to. Louder than a soft
        # failure, because no amount of waiting fixes it.
        log.error("push driver is 'fcm' but FIREBASE_PROJECT_ID is unset")
        return Outcome.CONFIG

    url = ENDPOINT.format(project=cfg.firebase_project_id)
    body = envelope(token, message, validate_only=validate_only)

    for attempt in range(RETRIES + 1):
        try:
            status, payload = await asyncio.to_thread(_post, url, body)
        except Exception:  # noqa: BLE001 — a transport failure is a soft one
            log.exception("FCM request failed")
            status, payload = 503, {}

        if status == 200:
            return Outcome.OK

        outcome = _classify(status, payload)
        if outcome is not Outcome.SOFT or attempt == RETRIES:
            if outcome is Outcome.CONFIG:
                log.error("FCM refused the deployment's credentials: %s %s", status, payload)
            return outcome

        # Jittered, so a hundred devices retrying do not arrive together.
        await asyncio.sleep((2**attempt) * 0.5 + random.random() * 0.25)

    return Outcome.SOFT


def check_credentials() -> tuple[bool, str]:
    """Mint an access token and throw it away.

    The cheapest proof that `roles/firebasemessaging.admin` is actually granted
    to whatever this service runs as: if the scope cannot be minted, nothing
    else in this file can work, and the failure says so in words rather than
    turning up later as notifications nobody receives.
    """
    try:
        import google.auth
        from google.auth.transport.requests import Request

        credentials, project = google.auth.default(scopes=[SCOPE])
        credentials.refresh(Request())
        return True, f"minted for {project or 'an unnamed project'}"
    except Exception as error:  # noqa: BLE001 — every failure here is "no credential"
        return False, str(error)
