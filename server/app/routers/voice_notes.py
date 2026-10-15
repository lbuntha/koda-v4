"""A child reads a book aloud and sends it to their parents.

The child's side is one request: the recording, which book, which pages. It is
kept for the family only — never on the shared shelf, never readable by its
hash the way a book's own recordings are — and every adult in the family is
told, in the bell and on any browser that rings. The parent's side is the list
in the child's report: play it, mark it heard, delete it.

Only a learner session can send, so a message is always from the child it says
it is from; only an adult who can manage children can list, play or delete.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from pydantic import Field

from app import audio_store
from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model, now
from app.repos import learners
from app.repos import voice_notes as notes_repo
from app.routers.library import AudioWrite, store_audio
from app.services import push

router = APIRouter(prefix="/library/voice-notes", tags=["library"], dependencies=[AUTHENTICATED])

#: Four minutes of a phone's own recording format, with room to spare. Stored at
#: 32 kbps speech quality, so what is kept is a fraction of this.
MAX_VOICE_BYTES = 8 * 1024 * 1024
MAX_DURATION_MS = 5 * 60 * 1000
#: Enough for a keen reader's whole afternoon; not enough to fill a parent's phone.
MAX_PER_DAY = 30
KIND = "learn.voice_note"


def _child(p: CurrentPrincipal) -> Principal:
    if not p.learner_id or not p.family_id:
        raise Forbidden("Only a child's session sends a voice message.", "not_a_learner")
    return p


def _parent(p: Annotated[Principal, Depends(require("learner:update"))]) -> Principal:
    if p.learner_id or not p.family_id:
        raise Forbidden("Voice messages are for a child's grown-ups.", "not_a_parent")
    return p


Child = Annotated[Principal, Depends(_child)]
Parent = Annotated[Principal, Depends(_parent)]


class VoiceNoteWrite(AudioWrite):
    book_id: str = Field(alias="bookId", min_length=1, max_length=64)
    book_title: str = Field(alias="bookTitle", min_length=1, max_length=200)
    pages: list[int] = Field(default_factory=list, max_length=200)
    duration_ms: int = Field(alias="durationMs", ge=0)


class VoiceNoteOut(Model):
    id: str
    learner_id: str = Field(alias="learnerId")
    book_id: str = Field(alias="bookId")
    book_title: str = Field(alias="bookTitle")
    pages: list[int]
    duration_ms: int = Field(alias="durationMs")
    created_at: str = Field(alias="createdAt")
    heard: bool


class VoiceNoteList(Model):
    notes: list[VoiceNoteOut]
    unheard: int


def _out(row: dict) -> VoiceNoteOut:
    return VoiceNoteOut(
        id=row["_id"],
        learnerId=row["learnerId"],
        bookId=row["bookId"],
        bookTitle=row["bookTitle"],
        pages=row.get("pages", []),
        durationMs=row.get("durationMs", 0),
        createdAt=row["createdAt"].isoformat(),
        heard=row.get("heardAt") is not None,
    )


@router.post("", status_code=201)
async def send(body: VoiceNoteWrite, db: Db, p: Child) -> VoiceNoteOut:
    family_id, learner_id = p.family_id, p.learner_id
    assert family_id and learner_id
    if body.duration_ms > MAX_DURATION_MS:
        raise AppError(413, "voice_too_long", "A voice message may be at most five minutes.")
    if await notes_repo.sent_since(db, family_id, learner_id, now() - timedelta(days=1)) >= MAX_PER_DAY:
        raise AppError(429, "too_many_voice_notes", "That is a lot of reading today — try again tomorrow.")
    saved = await store_audio(body, MAX_VOICE_BYTES)
    pages = sorted({n for n in body.pages if 0 < n < 1000})
    row = await notes_repo.add(
        db,
        family_id=family_id,
        learner_id=learner_id,
        book_id=body.book_id,
        book_title=body.book_title.strip(),
        pages=pages,
        clip_id=saved.id,
        duration_ms=body.duration_ms,
    )
    # Tell the grown-ups. Never raises: the recording is already safe.
    learner = await learners.by_id(db, learner_id, family_id)
    name = (learner or {}).get("displayName") or "Your child"
    title, text = await push.wording(db, KIND, {"learner": name, "book": row["bookTitle"]}, family_id=family_id)
    await push.send(
        db,
        to=push.Recipient(family_id=family_id),
        kind=KIND,
        title=title,
        body=text,
        path=f"/children/{learner_id}",
        tag=f"voice:{learner_id}",
    )
    return _out(row)


@router.get("")
async def listing(db: Db, p: Parent, learner_id: Annotated[str, Query(alias="learnerId", max_length=64)]) -> VoiceNoteList:
    assert p.family_id
    rows = await notes_repo.for_learner(db, p.family_id, learner_id)
    return VoiceNoteList(notes=[_out(r) for r in rows], unheard=sum(1 for r in rows if r.get("heardAt") is None))


@router.get("/{note_id}/audio")
async def audio(note_id: str, db: Db, p: Parent) -> Response:
    assert p.family_id
    row = await notes_repo.by_id(db, p.family_id, note_id)
    data = await audio_store.get(row["clipId"]) if row else None
    if data is None:
        raise NotFound("No such voice message.", "voice_note_not_found")
    return Response(content=data, media_type=audio_store.CONTENT_TYPE, headers={"Cache-Control": "private, max-age=86400"})


@router.post("/{note_id}/heard", status_code=204)
async def heard(note_id: str, db: Db, p: Parent) -> None:
    assert p.family_id
    if not await notes_repo.mark_heard(db, p.family_id, note_id, p.subject_id):
        raise NotFound("No such voice message.", "voice_note_not_found")


@router.delete("/{note_id}", status_code=204)
async def delete(note_id: str, db: Db, p: Parent) -> None:
    assert p.family_id
    if not await notes_repo.remove(db, p.family_id, note_id):
        raise NotFound("No such voice message.", "voice_note_not_found")
