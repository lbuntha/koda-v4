"""Where the browser reports a crash it could not recover from.

The frontend's error boundary catches a render failure and shows the learner something kind,
but that only helps the learner — without this the failure would never reach anyone who could
fix it. One endpoint, so a client crash lands in the same log as a server one.

Deliberately unauthenticated: the boundary fires precisely when the app is broken, which
includes the cases where auth state is what broke. The trade-off is that it is writable by
anyone, so it stores nothing, trusts nothing, and is capped hard.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ...core.logging import get_logger, redact

router = APIRouter(tags=["telemetry"])
logger = get_logger("client")


class ClientErrorIn(BaseModel):
    """A crash report. Every field is capped — this endpoint takes untrusted input."""

    message: str = Field(max_length=500)
    #: React's component stack. Truncated: enough to locate the component, not a whole app.
    component_stack: str = Field(default="", max_length=4000)
    stack: str = Field(default="", max_length=4000)
    #: Which band/screen was rendering, so a report can be reproduced.
    surface: str = Field(default="", max_length=80)
    path: str = Field(default="", max_length=300)


@router.post("/client-errors", status_code=202)
async def report_client_error(body: ClientErrorIn, request: Request) -> dict[str, str]:
    reference = uuid.uuid4().hex[:8]
    logger.error(
        "client crash ref=%s surface=%s path=%s message=%s\ncomponent stack:\n%s",
        reference,
        body.surface or "unknown",
        body.path or "unknown",
        redact({"message": body.message})["message"],
        body.component_stack or "(none)",
    )
    # Returned so a learner's "something went wrong" screen can show a reference an adult
    # can quote, and it ties to exactly one log line.
    return {"reference": reference}
