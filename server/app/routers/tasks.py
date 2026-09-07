"""The endpoints Cloud Scheduler calls, and nothing a browser ever reaches.

Thin on purpose. The work is in `services/tasks.py`, and what is here is the
door (`scheduler_only`) and the two decisions a route has to make: how much a
single call is allowed to do, and what it says about what it did.

**POST, not GET.** These change things — they send notifications and delete
rows — and a GET that does either is a link somebody's crawler will eventually
follow.

**The report is the point.** Cloud Scheduler keeps a log of the response, so a
run that says `{"due": 3, "summaries": 3, "sent": 5}` is an operator's answer to
"did Sunday work?" without a database shell. It is also why a run that did
nothing says *why* it did nothing rather than returning an empty body.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.deps import Db
from app.errors import Forbidden
from app.security.tasks import scheduler_only
from app.services import tasks as task_service
from app.settings import settings

# One dependency for the whole router. Nothing here takes a `Principal`: there
# is no family behind these calls and no user to scope to, which is exactly why
# the door has to be at the router rather than inside each handler.
router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    dependencies=[Depends(scheduler_only)],
    include_in_schema=False,
)

#: How many families one call may look at. Bounded by the route rather than the
#: caller, so a scheduler misconfigured with `?limit=100000` cannot turn a
#: five-minute deadline into a failed run that retries forever.
MAX_PAGE = 500


@router.post("/weekly-summary")
async def weekly_summary(
    db: Db,
    cursor: Annotated[str | None, Query(max_length=64)] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE)] = task_service.FAMILY_PAGE,
    at: Annotated[datetime | None, Query()] = None,
) -> dict:
    """Send Sunday's summary to whoever it is Sunday evening for.

    Called hourly. `cursor` continues a run that was cut short: the response
    carries the family it reached, and a caller with budget left calls again
    with it. Cloud Scheduler will not do that on its own — it is here so an
    operator working through a backlog by hand has a way to, and so a future
    fan-out has somewhere to stand.

    `at` pretends it is some other instant, and is **development only**. A job
    that can only be exercised on a Sunday evening is a job nobody checks before
    the first real Sunday, which is the failure §7 exists to prevent — but a
    production deployment that can be asked to run last week again is a
    deployment somebody can make send a summary twice. So it is refused rather
    than ignored outside development: a flag that silently did nothing would be
    worse than one that is not there.
    """
    if at is not None and not settings().is_dev:
        raise Forbidden(
            "The clock can only be moved in development.", "task_time_travel_forbidden"
        )
    return await task_service.weekly_summary(db, at=at, cursor=cursor, limit=limit)


@router.post("/token-sweep")
async def token_sweep(db: Db) -> dict:
    """Delete what nothing can use again: dead tokens, old notices, spent claims."""
    return await task_service.token_sweep(db)
