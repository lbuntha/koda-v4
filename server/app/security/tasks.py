"""Who may ring the doorbell nobody is standing at.

`/v1/tasks/*` is the only prefix in this service that no browser calls. Every
other route is reached by a family token or a staff token, and the whole of
`docs/SECURITY.md` is written about those. These are reached by Cloud Scheduler,
which holds neither — so they need their own door, and it has to be a door
rather than an absence of one: a route that sends notifications to every family
on the deployment is not something to leave open because it looked internal.

Three things are checked, and each closes a different hole:

1. **The token is Google's.** Verified against Google's published keys, so a
   token somebody wrote themselves is not a token.
2. **It was minted for us.** The audience is this deployment's, so an OIDC
   token issued for some other service — which a great many service accounts
   can obtain — cannot be replayed here.
3. **The caller is the account we said.** The `email` claim must be the
   scheduler's service account. Audience alone would let anything that can
   reach Cloud Run and mint a token for it in.

**Fail closed.** With no service account configured, this refuses every request
outside development rather than falling back to "allow" — the shape
`main.py` already uses when it declines to start on the development JWT secret.
A deployment that has not set the scheduler up does not have jobs to run, so
refusing costs it nothing and protects it from the version of this file that
guessed.
"""

import logging

from fastapi import Request

from app.errors import Forbidden, Unauthorized
from app.settings import settings

log = logging.getLogger("koda.tasks")


def _bearer(request: Request) -> str:
    header = request.headers.get("Authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise Unauthorized("This endpoint is called by the scheduler.", "task_auth_missing")
    return token.strip()


async def scheduler_only(request: Request) -> str:
    """Let Cloud Scheduler through and nobody else. Returns the caller's name.

    Named for what it permits rather than what it checks, because that is the
    sentence a reader of `routers/tasks.py` needs: *only the scheduler*.
    """
    cfg = settings()
    expected_caller = cfg.push_task_service_account
    audience = cfg.push_task_audience

    if not expected_caller or not audience:
        if cfg.is_dev:
            # A laptop has no Cloud Scheduler and no metadata server, and a job
            # that cannot be run locally is a job nobody debugs. Loud, so this
            # is never mistaken for the production path.
            log.warning(
                "PUSH_TASK_SERVICE_ACCOUNT/PUSH_TASK_AUDIENCE are unset — "
                "allowing an unauthenticated task call because this is development"
            )
            return "development"
        raise Forbidden(
            "Scheduled tasks are not configured on this deployment.",
            "task_auth_unconfigured",
        )

    token = _bearer(request)
    try:
        from app.services.google_identity import verify_oidc

        claims = verify_oidc(token, audience)
    except Exception as error:  # noqa: BLE001 — every failure here is "not you"
        # Logged rather than returned. The caller is a scheduler with no eyes,
        # and the difference between a wrong audience and an expired token is
        # for the operator reading the logs, not for whoever is knocking.
        log.warning("refused a task call: %s", error)
        raise Unauthorized("That token is not accepted here.", "task_auth_invalid") from error

    caller = claims.get("email")
    if caller != expected_caller or not claims.get("email_verified", False):
        log.warning("refused a task call from %r", caller)
        raise Forbidden("That account may not run scheduled tasks.", "task_auth_forbidden")

    return caller
