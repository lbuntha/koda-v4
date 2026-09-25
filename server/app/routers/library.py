"""Koda Library: books children read, and the drafts admins write them in.

Reading follows the art library's rule — `settings:read`, which every signed-in
device has, because every device needs the books to draw the shelf. Writing is
`content:write`, the same single gate the art library uses, so the menu entry
and the API can never disagree about who may author.

A draft may be anything, including half-finished and wrong: an author has to be
able to save their work. Publishing is where the rules apply, and they are
applied here, by `library_verify`, whatever the editor said.
"""

from __future__ import annotations

import base64
import binascii
import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from pydantic import Field

from app import audio_store
from app.deps import AUTHENTICATED, CurrentPrincipal, Db, require
from app.errors import AppError, Forbidden, NotFound
from app.khmer_spelling import spelling_units
from app.library_verify import verify_passage
from app.models.auth import Principal
from app.models.common import Model
from app.repos import library as library_repo
from app.security import principal_can

router = APIRouter(prefix="/library", tags=["library"], dependencies=[AUTHENTICATED])

CanRead = Annotated[Principal, Depends(require("settings:read"))]


def _may_author(p: CurrentPrincipal) -> Principal:
    if not principal_can(p, "content:write"):
        raise Forbidden("Only an operator can write library books.", "not_an_operator")
    return p


CanWrite = Annotated[Principal, Depends(_may_author)]

ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_ID = 64
MAX_SENTENCES = 40
MAX_QUESTIONS = 30
MAX_TEXT = 400  # characters in any one sentence, prompt or option
MAX_AUDIO_BYTES = 2 * 1024 * 1024  # a sentence read aloud is well under 1 MB
AUDIO_TYPES = {"audio/wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"}
CLIP_ID = re.compile(r"^[0-9a-f]{64}$")
MAX_IMAGE_BYTES = 3 * 1024 * 1024  # the studio shrinks photos to ~1600px before sending
# Photos only, checked by their first bytes as well as their label: an SVG or an
# HTML page renamed .png is refused, so nothing stored here can run as a page.
IMAGE_MAGIC = {
    "image/jpeg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}
PHOTO_PREFIX = "photo-"
PLACES = {"top", "bottom", "left", "right"}
CATEGORIES = {"Animals", "Food", "Family", "Places", "Weather & play", "Everyday"}


class BookOut(Model):
    id: str
    rev: int
    title: str
    language: str
    band: str
    category: str | None = None
    status: str
    draft: dict[str, Any] | None = None
    published: dict[str, Any] | None = None
    confirmed_split: bool = Field(default=False, alias="confirmedSplit")
    provider: str | None = None


class PublishedList(Model):
    books: list[dict[str, Any]]


class DraftWrite(Model):
    passage: dict[str, Any]
    confirmed_split: bool = Field(default=False, alias="confirmedSplit")
    provider: str | None = None


class AudioWrite(Model):
    mime: str
    data: str  # base64


class AudioSaved(Model):
    id: str
    bytes: int


class AudioSizeRequest(Model):
    ids: list[str]


class AudioSizes(Model):
    sizes: dict[str, int]


def clip_ids_of(passage: dict[str, Any]) -> set[str]:
    """Every recording a book points at: one per sentence, one per word, all optional."""
    ids = {s.get("audio") for s in passage.get("sentences") or [] if s.get("audio")}
    ids |= set((passage.get("wordAudio") or {}).values())
    return {str(i) for i in ids}


def photo_ids_of(passage: dict[str, Any]) -> set[str]:
    """Every uploaded photo a book shows: its cover, and any page's picture."""
    keys = [passage.get("picture")] + [s.get("picture") for s in passage.get("sentences") or []]
    return {k[len(PHOTO_PREFIX):] for k in keys if isinstance(k, str) and k.startswith(PHOTO_PREFIX)}


class Refused(Model):
    rule: int
    question: str
    message: str


def _id(value: str) -> str:
    value = value.strip()
    if len(value) > MAX_ID or not ID_PATTERN.fullmatch(value):
        raise AppError(400, "invalid_id", "A book id must be lowercase words joined by single hyphens.")
    return value


# An art-library key, or `photo-` and an uploaded photo's id.
PICTURE_KEY = re.compile(r"[a-z0-9][a-z0-9-]{0,63}|photo-[0-9a-f]{64}")


def _clean(passage: dict[str, Any]) -> dict[str, Any]:
    """Shape and size only. Whether the book is *good* is the publish gate's job."""
    sentences = passage.get("sentences")
    questions = passage.get("questions")
    if not isinstance(sentences, list) or not isinstance(questions, list):
        raise AppError(400, "invalid_passage", "A book needs sentences and questions.")
    if len(sentences) > MAX_SENTENCES or len(questions) > MAX_QUESTIONS:
        raise AppError(413, "passage_too_large", f"At most {MAX_SENTENCES} sentences and {MAX_QUESTIONS} questions.")

    def too_long(x: Any) -> bool:
        return isinstance(x, str) and len(x) > MAX_TEXT

    for s in sentences:
        if not isinstance(s, dict) or too_long(s.get("text")) or any(too_long(w) for w in s.get("words") or []):
            raise AppError(400, "invalid_passage", "A sentence is malformed or too long.")
        cues = s.get("audioCues")
        if cues is not None:
            words = s.get("words") or []
            valid_cues = bool(s.get("audio")) and isinstance(cues, list) and len(cues) == len(words)
            previous_end = 0
            for cue in cues if isinstance(cues, list) else []:
                start = cue.get("startMs") if isinstance(cue, dict) else None
                end = cue.get("endMs") if isinstance(cue, dict) else None
                if not isinstance(start, int) or not isinstance(end, int):
                    valid_cues = False
                    continue
                valid_cues = valid_cues and start >= previous_end and end > start and end <= 10 * 60 * 1000
                previous_end = end
            if not valid_cues:
                raise AppError(400, "invalid_passage", "Word highlighting times must match the approved word split.")
        # A page's chosen picture: a picture key, or None for "no picture".
        if "picture" in s and not (s["picture"] is None or (isinstance(s["picture"], str) and PICTURE_KEY.fullmatch(s["picture"]))):
            raise AppError(400, "invalid_passage", "A page picture must be a picture key.")
        if "pictureAt" in s and s["pictureAt"] not in PLACES:
            raise AppError(400, "invalid_passage", "A page picture goes top, bottom, left or right.")
    if not (isinstance(passage.get("picture"), str) and PICTURE_KEY.fullmatch(passage["picture"])):
        raise AppError(400, "invalid_passage", "The cover picture must be a picture key.")
    for q in questions:
        if not isinstance(q, dict) or too_long(q.get("prompt")) or any(too_long(o) for o in q.get("options") or []):
            raise AppError(400, "invalid_passage", "A question is malformed or too long.")
    if passage.get("category") is not None and passage.get("category") not in CATEGORIES:
        raise AppError(400, "invalid_category", "Unknown category.")
    return passage


def _out(row: dict[str, Any]) -> BookOut:
    draft = row.get("draft") or {}
    published = row.get("published")
    shown = published or draft
    return BookOut(
        id=row["id"],
        rev=int(row.get("rev") or 0),
        title=str(draft.get("title") or shown.get("title") or row["id"]),
        language=str(draft.get("language") or shown.get("language") or "en"),
        band=str(draft.get("band") or shown.get("band") or "A"),
        category=draft.get("category") or shown.get("category"),
        status="published" if published else "draft",
        draft=draft or None,
        published=published,
        confirmedSplit=bool(row.get("confirmedSplit")),
        provider=row.get("provider"),
    )


# ------------------------------------------------------------------ readers


@router.get("/books")
async def published_books(db: Db, _: CanRead) -> PublishedList:
    """What a child's device puts on the shelf: the live revision of every published book."""
    return PublishedList(books=[row["published"] for row in await library_repo.list_published(db)])


# ------------------------------------------------------------------ authors


@router.get("/can-author", status_code=204)
async def can_author(_: CanWrite) -> None:
    """A yes/no for the Node server's AI drafter, so permissions are judged in one place."""


class BookSummary(Model):
    """A row of the studio list: what an author scans for, never the story itself."""

    id: str
    rev: int = 0
    title: str
    language: str
    band: str
    category: str | None = None
    picture: str = "book"
    status: str
    changed: bool = False
    reports: int = 0
    sentences: int = 0
    questions: int = 0
    created_at: Any = Field(default=None, alias="createdAt")
    updated_at: Any = Field(default=None, alias="updatedAt")
    published_at: Any = Field(default=None, alias="publishedAt")


class StudioStats(Model):
    all: int
    draft: int
    published: int
    changed: int
    reported: int


class FacetOption(Model):
    value: str
    count: int


class StudioFacets(Model):
    languages: list[FacetOption]
    bands: list[FacetOption]
    categories: list[FacetOption]


class StudioPage(Model):
    books: list[BookSummary]
    page: int
    page_size: int = Field(alias="pageSize")
    total: int
    pages: int
    stats: StudioStats
    facets: StudioFacets


class StudioMeta(Model):
    """The choices an author picks from, so no screen keeps its own copy."""

    categories: list[str]
    sorts: list[str]
    statuses: list[str]
    page_size_min: int = Field(alias="pageSizeMin")
    page_size_max: int = Field(alias="pageSizeMax")


PAGE_SIZE_MIN, PAGE_SIZE_MAX = 5, 100


@router.get("/studio/meta")
async def studio_meta(_: CanWrite) -> StudioMeta:
    return StudioMeta(
        categories=sorted(CATEGORIES),
        sorts=list(library_repo.STUDIO_SORTS),
        statuses=list(library_repo.STUDIO_STATUSES),
        pageSizeMin=PAGE_SIZE_MIN,
        pageSizeMax=PAGE_SIZE_MAX,
    )


@router.get("/drafts")
async def list_drafts(
    db: Db,
    _: CanWrite,
    q: Annotated[str, Query(max_length=100)] = "",
    status: Annotated[str | None, Query(pattern="^(" + "|".join(library_repo.STUDIO_STATUSES) + ")$")] = None,
    language: Annotated[str | None, Query(max_length=10)] = None,
    band: Annotated[str | None, Query(max_length=5)] = None,
    category: Annotated[str | None, Query(max_length=40)] = None,
    sort: Annotated[str, Query(pattern="^(" + "|".join(library_repo.STUDIO_SORTS) + ")$")] = "updated",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=PAGE_SIZE_MIN, le=PAGE_SIZE_MAX)] = 25,
) -> StudioPage:
    """The studio's list: a page of summaries, searched and filtered in the database."""
    got = await library_repo.studio_page(
        db, query=q, status=status, language=language, band=band, category=category, sort=sort, page=page, page_size=page_size
    )
    total = got["total"]
    return StudioPage(
        books=[BookSummary(**row) for row in got["items"]],
        page=page,
        pageSize=page_size,
        total=total,
        pages=max(1, (total + page_size - 1) // page_size),
        stats=StudioStats(**got["stats"]),
        facets=StudioFacets(**await library_repo.studio_facets(db)),
    )


@router.get("/drafts/{book_id}")
async def get_draft(book_id: str, db: Db, _: CanWrite) -> BookOut:
    """One book in full — its draft and live revision — for the editor."""
    row = await library_repo.get(db, _id(book_id))
    if row is None:
        raise NotFound(f'No book "{book_id}".', "book_not_found")
    return _out(row)


@router.get("/studio/spelling-units")
async def spelling_units_in_use(db: Db, _: CanWrite, language: Annotated[str, Query(max_length=10)] = "km") -> dict[str, list[str]]:
    """Every spelling unit the books ask children to spell — what to record names for first."""
    units: set[str] = set()
    for word in await library_repo.spelling_words(db, language):
        units.update(spelling_units(word))
    return {"units": sorted(units)}


@router.put("/drafts/{book_id}")
async def save_draft(book_id: str, body: DraftWrite, db: Db, p: CanWrite) -> BookOut:
    book_id = _id(book_id)
    passage = _clean({**body.passage, "id": book_id})
    row = await library_repo.save_draft(
        db, book_id, passage, {"confirmedSplit": body.confirmed_split, "provider": body.provider}, p.subject_id
    )
    return _out(row)


@router.post("/drafts/{book_id}/publish")
async def publish(book_id: str, db: Db, p: CanWrite) -> BookOut:
    book_id = _id(book_id)
    row = await library_repo.get(db, book_id)
    if row is None or not row.get("draft"):
        raise NotFound(f'No draft "{book_id}".', "book_not_found")
    verdict = verify_passage(row["draft"], confirmed_split=bool(row.get("confirmedSplit")))
    if not verdict.publishable:
        reasons = verdict.summary()
        if not verdict.counts_match_band:
            reasons.append({"rule": 0, "question": "story", "message": f"question counts {verdict.counts} do not match the band"})
        raise AppError(422, "not_publishable", "; ".join(f"{r['question']}: {r['message']}" for r in reasons[:4]))
    ids = clip_ids_of(row["draft"])
    if any(not CLIP_ID.fullmatch(i) for i in ids) or await audio_store.missing(ids):
        raise AppError(422, "missing_audio", "A recording this book points at was not uploaded. Record it again or remove it.")
    if await library_repo.missing_images(db, photo_ids_of(row["draft"])):
        raise AppError(422, "missing_photo", "A photo this book shows was not uploaded. Upload it again or choose another picture.")
    return _out(await library_repo.publish(db, book_id, row["draft"], p.subject_id))


@router.post("/drafts/{book_id}/unpublish")
async def unpublish(book_id: str, db: Db, p: CanWrite) -> BookOut:
    row = await library_repo.unpublish(db, _id(book_id), p.subject_id)
    if row is None:
        raise NotFound(f'No book "{book_id}".', "book_not_found")
    return _out(row)


@router.delete("/drafts/{book_id}", status_code=204)
async def delete(book_id: str, db: Db, p: CanWrite) -> None:
    if not await library_repo.delete(db, _id(book_id), p.subject_id):
        raise NotFound(f'No book "{book_id}".', "book_not_found")


# ------------------------------------------------------------------ recordings


@router.post("/audio")
async def upload_audio(body: AudioWrite, db: Db, p: CanWrite) -> AudioSaved:
    if body.mime.split(";")[0].strip() not in AUDIO_TYPES:
        raise AppError(415, "unsupported_audio", "Recordings must be WAV, WebM, Ogg, MP4 or MP3 audio.")
    try:
        data = base64.b64decode(body.data, validate=True)
    except (binascii.Error, ValueError):
        raise AppError(400, "invalid_audio", "The recording is not valid base64.") from None
    if not data:
        raise AppError(400, "invalid_audio", "The recording is empty.")
    if len(data) > MAX_AUDIO_BYTES:
        raise AppError(413, "audio_too_large", "A recording may be at most 2 MB.")
    try:
        clip_id, stored_bytes = await audio_store.put(data, body.mime.split(";")[0].strip())
    except ValueError as exc:
        raise AppError(415, "invalid_audio", str(exc)) from exc
    return AudioSaved(id=clip_id, bytes=stored_bytes)


@router.post("/audio/sizes")
async def audio_sizes(body: AudioSizeRequest, db: Db, _: CanRead) -> AudioSizes:
    """Stored byte size for clips shown in the authoring voice step."""
    if len(body.ids) > MAX_SENTENCES:
        raise AppError(400, "too_many_recordings", f"Ask for at most {MAX_SENTENCES} recording sizes at once.")
    ids = set(body.ids)
    if any(not CLIP_ID.fullmatch(clip_id) for clip_id in ids):
        raise AppError(400, "invalid_audio_id", "A recording id is not valid.")
    return AudioSizes(sizes=await audio_store.sizes(ids))


@router.get("/audio/{clip_id}")
async def get_audio(clip_id: str, db: Db, _: CanRead) -> Response:
    """A clip's bytes. Immutable: its id is its hash, so a device may cache it for ever."""
    if not CLIP_ID.fullmatch(clip_id):
        raise NotFound("No such recording.", "audio_not_found")
    data = await audio_store.get(clip_id)
    if data is None:
        raise NotFound("No such recording.", "audio_not_found")
    return Response(content=data, media_type=audio_store.CONTENT_TYPE, headers={"Cache-Control": "private, max-age=31536000, immutable"})


# ------------------------------------------------------------------ photos


class ImageWrite(Model):
    mime: str
    data: str  # base64


@router.post("/images")
async def upload_image(body: ImageWrite, db: Db, p: CanWrite) -> AudioSaved:
    mime = body.mime.split(";")[0].strip().lower()
    if mime not in IMAGE_MAGIC:
        raise AppError(415, "unsupported_image", "Photos must be JPEG, PNG or WebP.")
    try:
        data = base64.b64decode(body.data, validate=True)
    except (binascii.Error, ValueError):
        raise AppError(400, "invalid_image", "The photo is not valid base64.") from None
    if not data:
        raise AppError(400, "invalid_image", "The photo is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise AppError(413, "image_too_large", "A photo may be at most 3 MB.")
    if not IMAGE_MAGIC[mime](data):
        raise AppError(415, "unsupported_image", "That file is not the kind of photo it says it is.")
    image_id = await library_repo.put_image(db, data, mime, p.subject_id)
    return AudioSaved(id=image_id, bytes=len(data))


@router.get("/images/{image_id}")
async def get_image(image_id: str, db: Db, _: CanRead) -> Response:
    """A photo's bytes. Immutable, like a clip: its id is its hash."""
    if not CLIP_ID.fullmatch(image_id):
        raise NotFound("No such photo.", "image_not_found")
    row = await library_repo.get_image(db, image_id)
    if row is None or row.get("mime") not in IMAGE_MAGIC:
        raise NotFound("No such photo.", "image_not_found")
    return Response(
        content=bytes(row["data"]),
        media_type=row["mime"],
        headers={"Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )


# ------------------------------------------------------------ Khmer unit names


class UnitVoices(Model):
    voices: dict[str, str]


class UnitVoiceWrite(Model):
    unit: str
    clip: str | None = None


def _is_spelling_unit(unit: str) -> bool:
    """One spelling unit: 1–3 Khmer characters that split into exactly itself."""
    if not unit or len(unit) > 3 or not all(0x1780 <= ord(c) <= 0x17FF for c in unit):
        return False
    return spelling_units(unit) == [unit]


@router.get("/unit-voices")
async def list_unit_voices(db: Db, _: CanRead) -> UnitVoices:
    """Every recorded Khmer unit name: unit → clip id. Small; a device keeps a copy."""
    return UnitVoices(voices=await library_repo.unit_voices(db))


@router.put("/unit-voices")
async def put_unit_voice(body: UnitVoiceWrite, db: Db, p: CanWrite) -> UnitVoices:
    if not _is_spelling_unit(body.unit):
        raise AppError(400, "invalid_unit", "That is not one Khmer spelling unit.")
    if body.clip is not None and (not CLIP_ID.fullmatch(body.clip) or await audio_store.missing({body.clip})):
        raise AppError(422, "missing_audio", "Upload the recording first.")
    await library_repo.set_unit_voice(db, body.unit, body.clip, p.subject_id)
    return UnitVoices(voices=await library_repo.unit_voices(db))


# ------------------------------------------------------------------ reports


class ReportWrite(Model):
    rev: int = 0
    reason: str
    note: str = ""


class ReportOut(Model):
    id: str
    book_id: str = Field(alias="bookId")
    rev: int
    reason: str
    note: str


class ReportList(Model):
    reports: list[ReportOut]


@router.post("/books/{book_id}/reports", status_code=201)
async def report_book(book_id: str, body: ReportWrite, db: Db, p: CanRead) -> ReportOut:
    """Anyone who can read the shelf can say a book is wrong. Authors see it in the studio."""
    book_id = _id(book_id)
    if body.reason not in library_repo.REPORT_REASONS:
        raise AppError(400, "invalid_reason", "Unknown reason.")
    row = await library_repo.add_report(db, book_id, max(0, body.rev), body.reason, body.note.strip()[:500], p.subject_id)
    return ReportOut(id=row["id"], bookId=book_id, rev=row["rev"], reason=row["reason"], note=row["note"])


@router.get("/reports")
async def list_reports(db: Db, _: CanWrite, book_id: Annotated[str | None, Query(alias="bookId", max_length=64)] = None) -> ReportList:
    rows = await library_repo.open_reports(db, book_id)
    return ReportList(
        reports=[
            ReportOut(id=r["id"], bookId=r["bookId"], rev=r["rev"], reason=r["reason"], note=r.get("note", ""))
            for r in rows
        ]
    )


@router.post("/reports/{report_id}/resolve", status_code=204)
async def resolve_report(report_id: str, db: Db, p: CanWrite) -> None:
    if not await library_repo.resolve_report(db, report_id, p.subject_id):
        raise NotFound("No open report with that id.", "report_not_found")
