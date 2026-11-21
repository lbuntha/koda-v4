"""Students sharing what they finished, with others of the same age.

Consent is the leaderboard's: a learner appears only once a parent (or a
student managing their own account) has turned sharing on with a nickname.
"Public" shares reach the same age group; "buddies" reach accepted buddies
only. Popular counts are anonymous totals for the age group, shown only once
at least `MIN_POPULAR` students finished the same thing, so a count can never
point at one child.
"""

from collections import defaultdict
from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.deps import AUTHENTICATED, Db, require
from app.errors import NotFound
from app.models.auth import Principal
from app.models.common import now
from app.models.study_feed import CheerOut, PopularItem, StudyFeedOut, StudyItem
from app.repos import buddies, leaderboard_privacy, learners

router = APIRouter(prefix="/study-feed", tags=["study-feed"], dependencies=[AUTHENTICATED])

CanReadLearner = Annotated[Principal, Depends(require("learner:read"))]

# The age groups a child is shown. A seven-year-old and a seventeen-year-old
# do not share a feed.
BANDS: tuple[tuple[int, int], ...] = ((4, 7), (8, 10), (11, 14), (15, 18))
FEED_DAYS = 7
FEED_SIZE = 12
POPULAR_SIZE = 3
MIN_POPULAR = 2
LIBRARY_SKILL = "koda-library"
FINISHED = ("lesson_completed", "reading_finished")


def band_for(birth_year: Any, year: int) -> tuple[int, int] | None:
    if isinstance(birth_year, bool) or not isinstance(birth_year, int):
        return None
    age = year - birth_year
    if age < BANDS[0][0]:
        return BANDS[0]
    for low, high in BANDS:
        if low <= age <= high:
            return (low, high)
    return BANDS[-1]


def _shared(row: dict | None) -> bool:
    nickname = row.get("nickname") if row else None
    return bool(row and row.get("sharingEnabled") is True and isinstance(nickname, str) and nickname.strip())


def _lesson_key(event: dict) -> tuple[str, str]:
    """Books are tracked per revision; a book is the same book across revisions."""
    skill = str(event.get("skillId") or "")
    lesson = str(event.get("lessonId") or "")
    if skill == LIBRARY_SKILL:
        lesson = lesson.split("@", 1)[0]
    return skill, lesson


async def _viewer(db: Db, p: Principal, learner_id: str) -> dict:
    if p.family_id is None or (p.learner_id and p.learner_id != learner_id):
        raise NotFound("No such learner.")
    row = await learners.by_id(db, learner_id, p.family_id)
    if not row:
        raise NotFound("No such learner.")
    return row


async def _authors(db: Db, viewer: dict, band: tuple[int, int] | None, year: int) -> dict[str, dict]:
    """Learners whose shares this viewer may see, keyed by learner id."""
    out: dict[str, dict] = {}
    if band:
        public = await leaderboard_privacy.public_rows(db)
        # `public_rows` already selects sharingEnabled + public; only the nickname is left to check.
        wanted = {
            row["learnerId"]: row
            for row in public
            if isinstance(row.get("nickname"), str) and row["nickname"].strip() and row["learnerId"] != viewer["_id"]
        }
        ids = list(wanted)
        for offset in range(0, len(ids), 200):
            async for peer in db.learners.find(
                {"_id": {"$in": ids[offset : offset + 200]}}, {"familyId": 1, "birthYear": 1, "avatarSeed": 1}
            ):
                privacy = wanted[peer["_id"]]
                if peer.get("familyId") != privacy.get("familyId"):
                    continue
                if band_for(peer.get("birthYear"), year) != band:
                    continue
                out[peer["_id"]] = {
                    "familyId": peer["familyId"],
                    "nickname": privacy["nickname"],
                    "avatarSeed": peer.get("avatarSeed"),
                    "isBuddy": False,
                }
    for relationship in await buddies.accepted_for(db, viewer["_id"]):
        other = next(x for x in relationship["participants"] if x["learnerId"] != viewer["_id"])
        privacy = await leaderboard_privacy.get(db, other["familyId"], other["learnerId"])
        if not _shared(privacy):
            continue
        peer = await learners.by_id(db, other["learnerId"], other["familyId"])
        if not peer:
            continue
        out[other["learnerId"]] = {
            "familyId": other["familyId"],
            "nickname": privacy["nickname"],
            "avatarSeed": peer.get("avatarSeed"),
            "isBuddy": True,
        }
    return out


async def _book_titles(db: Db, book_ids: set[str]) -> dict[str, str]:
    if not book_ids:
        return {}
    titles: dict[str, str] = {}
    async for book in db.library_books.find(
        {"id": {"$in": list(book_ids)}, "deletedAt": None, "published": {"$ne": None}},
        {"id": 1, "published.title": 1},
    ):
        title = (book.get("published") or {}).get("title")
        if isinstance(title, str) and title.strip():
            titles[book["id"]] = title
    return titles


def _since(tz_offset_minutes: int) -> str:
    local_today = (now() + timedelta(minutes=tz_offset_minutes)).date()
    return (local_today - timedelta(days=FEED_DAYS - 1)).isoformat()


async def _popular(db: Db, band: tuple[int, int], year: int, since: str) -> list[dict]:
    """Anonymous: how many students of this age finished each thing this week."""
    ids = [
        row["_id"]
        async for row in db.learners.find(
            {"birthYear": {"$gte": year - band[1], "$lte": year - band[0]}}, {"_id": 1}
        )
    ]
    if band == BANDS[0]:
        # Younger than the first band still counts as the first band.
        ids += [
            row["_id"] async for row in db.learners.find({"birthYear": {"$gt": year - band[0]}}, {"_id": 1})
        ]
    if not ids:
        return []
    who: dict[tuple[str, str], set[str]] = defaultdict(set)
    async for event in db.events.find(
        {"type": {"$in": list(FINISHED)}, "localDay": {"$gte": since}, "learnerId": {"$in": ids}, "practice": {"$ne": True}},
        {"skillId": 1, "lessonId": 1, "learnerId": 1},
    ):
        key = _lesson_key(event)
        if key[0] and key[1]:
            who[key].add(event["learnerId"])
    ranked = sorted(
        ((key, len(names)) for key, names in who.items() if len(names) >= MIN_POPULAR),
        key=lambda pair: (-pair[1], pair[0]),
    )
    return [{"skillId": key[0], "lessonId": key[1], "learners": count} for key, count in ranked[:POPULAR_SIZE]]


@router.get("/{learner_id}")
async def study_feed(
    learner_id: str,
    db: Db,
    p: CanReadLearner,
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840, alias="tzOffsetMinutes"),
) -> StudyFeedOut:
    viewer = await _viewer(db, p, learner_id)
    year = now().year
    band = band_for(viewer.get("birthYear"), year)
    since = _since(tz_offset_minutes)
    own = await leaderboard_privacy.get(db, p.family_id, learner_id)
    authors = await _authors(db, viewer, band, year)

    latest: dict[tuple[str, str, str], dict] = {}
    ids = list(authors)
    for offset in range(0, len(ids), 200):
        query = {
            "type": {"$in": list(FINISHED)},
            "localDay": {"$gte": since},
            "practice": {"$ne": True},
            "$or": [{"familyId": authors[i]["familyId"], "learnerId": i} for i in ids[offset : offset + 200]],
        }
        async for event in db.events.find(
            query, {"eventId": 1, "familyId": 1, "learnerId": 1, "skillId": 1, "lessonId": 1, "ts": 1, "type": 1}
        ):
            skill, lesson = _lesson_key(event)
            if not skill or not lesson:
                continue
            key = (event["learnerId"], skill, lesson)
            if key not in latest or str(event.get("ts", "")) > str(latest[key].get("ts", "")):
                latest[key] = event
    events = sorted(latest.values(), key=lambda e: str(e.get("ts", "")), reverse=True)[:FEED_SIZE]

    popular = await _popular(db, band, year, since) if band else []
    titles = await _book_titles(
        db,
        {_lesson_key(e)[1] for e in events if _lesson_key(e)[0] == LIBRARY_SKILL}
        | {row["lessonId"] for row in popular if row["skillId"] == LIBRARY_SKILL},
    )

    counts: dict[str, int] = defaultdict(int)
    mine: set[str] = set()
    event_ids = [e["eventId"] for e in events]
    if event_ids:
        async for cheer in db.study_cheers.find({"eventId": {"$in": event_ids}}, {"eventId": 1, "fromLearnerId": 1}):
            counts[cheer["eventId"]] += 1
            if cheer.get("fromLearnerId") == learner_id:
                mine.add(cheer["eventId"])

    items = []
    for event in events:
        skill, lesson = _lesson_key(event)
        author = authors[event["learnerId"]]
        items.append(
            StudyItem(
                id=event["eventId"],
                nickname=author["nickname"],
                avatarSeed=author["avatarSeed"],
                kind="book" if skill == LIBRARY_SKILL else "lesson",
                skillId=skill,
                lessonId=lesson,
                title=titles.get(lesson) if skill == LIBRARY_SKILL else None,
                at=str(event.get("ts", "")),
                isBuddy=author["isBuddy"],
                cheers=counts[event["eventId"]],
                cheeredByMe=event["eventId"] in mine,
            )
        )
    return StudyFeedOut(
        band=list(band) if band else None,
        sharingEnabled=_shared(own),
        popular=[
            PopularItem(
                kind="book" if row["skillId"] == LIBRARY_SKILL else "lesson",
                skillId=row["skillId"],
                lessonId=row["lessonId"],
                title=titles.get(row["lessonId"]) if row["skillId"] == LIBRARY_SKILL else None,
                learners=row["learners"],
            )
            for row in popular
        ],
        items=items,
    )


@router.post("/{learner_id}/cheer/{event_id}")
async def cheer(learner_id: str, event_id: str, db: Db, p: CanReadLearner) -> CheerOut:
    """One cheer per viewer per finished lesson, and only on a share they can see."""
    viewer = await _viewer(db, p, learner_id)
    event = await db.events.find_one(
        {"eventId": event_id, "type": {"$in": list(FINISHED)}}, {"familyId": 1, "learnerId": 1}
    )
    if not event:
        raise NotFound("No such share.")
    year = now().year
    authors = await _authors(db, viewer, band_for(viewer.get("birthYear"), year), year)
    author = authors.get(event["learnerId"])
    if not author or author["familyId"] != event.get("familyId"):
        raise NotFound("No such share.")
    await db.study_cheers.update_one(
        {"_id": f"{event_id}:{learner_id}"},
        {"$setOnInsert": {"eventId": event_id, "fromLearnerId": learner_id, "familyId": p.family_id, "at": now()}},
        upsert=True,
    )
    return CheerOut(
        cheers=await db.study_cheers.count_documents({"eventId": event_id}),
        cheeredByMe=True,
    )
