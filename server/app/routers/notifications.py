"""What Koda has told you, and whether you have read it.

The other half of push. A notification on a lock screen is gone the moment
somebody swipes it, so this is where it can still be found — and the reason a
family with notifications switched off, or a browser that never registered,
still has something to look at.

Everything here is scoped to the caller by `userId`. There is no route that
reads somebody else's, not for a parent and not for an operator: a notification
is addressed to one person, and a list of what a family has been told is not a
thing this service offers anyone.
"""

from fastapi import APIRouter
from pydantic import Field

from app.deps import AUTHENTICATED, CurrentPrincipal, Db
from app.models.common import Model
from app.repos import notifications, push_log

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[AUTHENTICATED])


class NotificationOut(Model):
    id: str
    kind: str
    title: str
    body: str
    path: str
    created_at: str = Field(alias="createdAt")
    read: bool


class NotificationsOut(Model):
    notifications: list[NotificationOut]
    unread: int


def _out(row: dict) -> NotificationOut:
    created = row.get("createdAt")
    return NotificationOut(
        id=row["_id"],
        kind=row.get("kind", ""),
        title=row.get("title", ""),
        body=row.get("body", ""),
        path=row.get("path", "/"),
        createdAt=created.isoformat() if created else "",
        read=row.get("readAt") is not None,
    )


@router.get("")
async def listing(db: Db, p: CurrentPrincipal) -> NotificationsOut:
    """The last few things Koda told this account, newest first.

    A learner session gets an empty list rather than a refusal: nothing is ever
    addressed to a child, so there is nothing to hide and nothing to explain.
    """
    if p.learner_id or not p.subject_id:
        return NotificationsOut(notifications=[], unread=0)

    rows = await notifications.for_user(db, p.subject_id)
    return NotificationsOut(
        notifications=[_out(row) for row in rows],
        unread=await notifications.unread_count(db, p.subject_id),
    )


class OpenedIn(Model):
    """Which kind was tapped. Never *which notification* — see below."""

    kind: str = Field(max_length=60)


@router.post("/opened", status_code=204)
async def opened(body: OpenedIn, db: Db, p: CurrentPrincipal) -> None:
    """Somebody tapped a notification. Resets §9's counter for that kind.

    A kind rather than an id, and the difference is the point: what the counter
    measures is whether this *sort* of notification is still being read, and a
    parent who opens one weekly summary has answered that for weekly summaries.
    Taking an id would also make this a route that can mark somebody else's
    record read, which is a thing no endpoint here needs to be able to do.

    204, and it fails silently on a kind nobody declared: this is called from a
    service worker with nothing to show a person, and an error it cannot render
    would only ever be logged by the browser.
    """
    if p.learner_id or not p.subject_id:
        return
    await push_log.note_opened(db, p.subject_id, body.kind)


@router.post("/read", status_code=200)
async def mark_read(db: Db, p: CurrentPrincipal) -> NotificationsOut:
    """Opening the list is reading it.

    Everything at once rather than one at a time: a badge that survives being
    looked at is a badge people stop looking at.
    """
    if p.learner_id or not p.subject_id:
        return NotificationsOut(notifications=[], unread=0)

    await notifications.mark_read(db, p.subject_id)
    rows = await notifications.for_user(db, p.subject_id)
    return NotificationsOut(notifications=[_out(row) for row in rows], unread=0)
