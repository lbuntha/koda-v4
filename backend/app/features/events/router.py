"""Learning-event ingest (student writes its own) + read-back (guardian reads their kid's)."""

from fastapi import APIRouter, Depends

from ...models.student import Student
from ...models.user import User
from ...models.event import LearningEvent
from ...models.content import CurriculumRelease
from ...core.deps import get_current_student, get_current_user
from ...core.permissions import authorize_guardian_read
from .contract import (
    EventContractError,
    FIELD_MAP,
    QUESTION_EVENTS,
    normalize_event,
    validate_release_binding,
)
from .schemas import EventsIn

# camelCase source keys consumed into canonical columns — removed from the
# diagnostic bag so they aren't stored twice (and can't collide as kwargs).
_CONSUMED_SOURCE_KEYS = frozenset(FIELD_MAP) | {"difficulty"}

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
    unverified = 0
    release_cache: dict[str, CurriculumRelease | None] = {}
    for raw in body.events:
        data = dict(raw)
        data.pop("_id", None)
        client_id = data.pop("id", None)
        if client_id and client_id in existing:
            continue
        canonical = normalize_event(raw)
        has_curriculum_context = any(
            canonical.get(field)
            for field in ("curriculum_skill_id", "curriculum_id", "release_id", "assignment_id")
        )
        if (
            canonical["verified"]
            and canonical.get("event_type") in QUESTION_EVENTS
            and has_curriculum_context
        ):
            try:
                if not canonical.get("release_id"):
                    raise EventContractError("curriculum question events require releaseId")
                release_id = canonical["release_id"]
                if release_id not in release_cache:
                    release_cache[release_id] = await CurriculumRelease.find_one(
                        CurriculumRelease.release_id == release_id
                    )
                release = release_cache[release_id]
                if release is None:
                    raise EventContractError("releaseId does not exist")
                validate_release_binding(
                    canonical,
                    release_id=release.release_id,
                    curriculum_id=release.curriculum_id,
                    revision=release.revision,
                    question_manifest=release.question_manifest,
                )
            except EventContractError as exc:
                canonical["verified"] = False
                canonical["verification_error"] = str(exc)
        if not canonical["verified"]:
            unverified += 1
        # Everything not folded into a canonical column stays as a diagnostic extra.
        diagnostics = {k: v for k, v in data.items() if k not in _CONSUMED_SOURCE_KEYS}
        docs.append(
            LearningEvent(
                student_id=student_id,
                client_id=client_id,
                **canonical,
                **diagnostics,
            )
        )
    if docs:
        await LearningEvent.insert_many(docs)
    return {
        "inserted": len(docs),
        "duplicates": len(body.events) - len(docs),
        "unverified": unverified,
    }


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
