"""Learning-event ingest (student writes its own) + read-back (guardian reads their kid's)."""

from typing import Any

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..models.user import User, Role
from ..models.student import Student
from ..models.event import LearningEvent
from ..auth.deps import get_current_student, get_current_user

router = APIRouter(tags=["events"])


class EventsIn(BaseModel):
    events: list[dict[str, Any]]


@router.post("/events")
async def ingest_events(body: EventsIn, student: Student = Depends(get_current_student)):
    """A student pushes a batch of its own events. student_id is forced from the
    token — the client's value is never trusted."""
    docs: list[LearningEvent] = []
    for raw in body.events:
        data = dict(raw)
        data.pop("_id", None)
        client_id = data.pop("id", None)
        docs.append(
            LearningEvent(
                **data,
                student_id=str(student.id),
                client_id=client_id,
                event_type=data.get("eventType"),
                slide_index=data.get("slideIndex"),
                client_timestamp_ms=data.get("clientTimestampMs"),
            )
        )
    if docs:
        await LearningEvent.insert_many(docs)
    return {"inserted": len(docs)}


async def _authorize_read(student_id: str, user: User) -> None:
    if user.role in (Role.admin, Role.teacher):
        return
    # Parents may only read their own children.
    try:
        student = await Student.get(PydanticObjectId(student_id))
    except Exception:
        student = None
    if not student or str(user.id) not in student.guardian_parent_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your child")


@router.get("/events")
async def read_events(
    student_id: str,
    limit: int = 500,
    user: User = Depends(get_current_user),
):
    await _authorize_read(student_id, user)
    events = (
        await LearningEvent.find(LearningEvent.student_id == student_id)
        .sort(-LearningEvent.client_timestamp_ms)
        .limit(min(limit, 2000))
        .to_list()
    )
    return {"events": [e.model_dump(mode="json") for e in events]}
