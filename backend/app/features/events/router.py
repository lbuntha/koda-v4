"""Learning-event ingest (student writes its own) + read-back (guardian reads their kid's)."""

from fastapi import APIRouter, Depends

from ...models.student import Student
from ...models.user import User
from ...models.event import LearningEvent
from ...core.deps import get_current_student, get_current_user
from ...core.permissions import authorize_guardian_read
from .schemas import EventsIn

router = APIRouter(tags=["events"])


@router.post("/events")
async def ingest_events(body: EventsIn, student: Student = Depends(get_current_student)):
    """A student pushes a batch of its own events. student_id is forced from the
    token — the client's value is never trusted."""
    student_id = str(student.id)
    client_ids = [str(raw.get("id")) for raw in body.events if raw.get("id")]
    existing = set()
    if client_ids:
        rows = await LearningEvent.find(
            LearningEvent.student_id == student_id,
            {"client_id": {"$in": client_ids}},
        ).to_list()
        existing = {row.client_id for row in rows if row.client_id}
    docs: list[LearningEvent] = []
    for raw in body.events:
        data = dict(raw)
        data.pop("_id", None)
        client_id = data.pop("id", None)
        if client_id and client_id in existing:
            continue
        docs.append(
            LearningEvent(
                **data,
                student_id=student_id,
                client_id=client_id,
                event_type=data.get("eventType"),
                slide_index=data.get("slideIndex"),
                client_timestamp_ms=data.get("clientTimestampMs"),
            )
        )
    if docs:
        await LearningEvent.insert_many(docs)
    return {"inserted": len(docs), "duplicates": len(body.events) - len(docs)}


@router.get("/events")
async def read_events(
    student_id: str,
    limit: int = 500,
    user: User = Depends(get_current_user),
):
    await authorize_guardian_read(student_id, user)
    events = (
        await LearningEvent.find(LearningEvent.student_id == student_id)
        .sort(-LearningEvent.client_timestamp_ms)
        .limit(min(limit, 2000))
        .to_list()
    )
    return {"events": [e.model_dump(mode="json") for e in events]}
