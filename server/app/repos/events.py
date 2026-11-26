"""Learning events: append-only, and idempotent by construction.

Every event carries an id the client generated, and `(familyId, eventId)` is a
unique index — so a batch that is sent twice inserts nothing the second time and
the rollup is never double-counted. That single index is the whole replay story.
"""

from datetime import timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne

from app.models.common import now
from app.models.events import LearningEvent, ReadingBookOut, ReadingComprehensionOut, ReadingQuizOut, ReadingReportOut
from app.repos.library import revision_titles


def to_document(
    event: LearningEvent, *, family_id: str, device_id: str | None, server_seq: int
) -> dict[str, Any]:
    doc = event.model_dump(by_alias=True, exclude_none=True)
    doc.update(event.extra)
    doc.update(
        {
            "eventId": event.id,
            "familyId": family_id,
            "deviceId": device_id,
            "serverSeq": server_seq,
            "receivedAt": now(),
        }
    )
    doc.pop("id", None)
    return doc


async def insert_many(
    db: AsyncIOMotorDatabase, documents: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    """Insert what is new. Returns (inserted, duplicates).

    An upsert keyed on the unique pair, rather than `insert_many(ordered=False)`
    and reading the error list: the count of what was actually new is what the
    rollup must be driven by, and it should not come out of an exception.
    """
    if not documents:
        return [], 0

    operations = [
        UpdateOne(
            {"familyId": doc["familyId"], "eventId": doc["eventId"]},
            {"$setOnInsert": doc},
            upsert=True,
        )
        for doc in documents
    ]
    result = await db.events.bulk_write(operations, ordered=False)

    inserted_ids = set(result.upserted_ids.values()) if result.upserted_ids else set()
    inserted = [
        doc
        for index, doc in enumerate(documents)
        if result.upserted_ids and index in result.upserted_ids
    ]
    return inserted, len(documents) - len(inserted_ids)


async def count_for_learner(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> int:
    return await db.events.count_documents({"familyId": family_id, "learnerId": learner_id})


async def conversations_for_learner(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, limit: int = 100
) -> list[dict[str, Any]]:
    """A learner's conversations with Koda, newest first.

    Read from the server's copy rather than the device's, because the device
    keeps a capped ring and the point of these is the long view: "she has asked
    about teen numbers on four different days" is not a question a single
    tablet's recent history can answer.

    Scoped to the family as every read here is — tenancy is a filter, not a
    permission, so a query that forgot it returns another family's children.
    """
    rows = await (
        db.events.find(
            {"familyId": family_id, "learnerId": learner_id, "type": "koda_conversation"},
            {"_id": 0, "familyId": 0},
        )
        .sort("ts", -1)
        .limit(max(1, min(limit, 500)))
        .to_list(length=500)
    )
    return rows


#: The event that means a round was finished, rather than merely started.
#:
#: Everything the notification layer asks about practice is asked in these
#: terms: a lesson opened and abandoned is not a day's practice, and counting
#: `answer_submitted` would make one long round look like a fortnight of them.
COMPLETED = "lesson_completed"


async def latest_tz_offset(db: AsyncIOMotorDatabase, family_id: str) -> int | None:
    """Minutes east of UTC, as the family's own device last reported it.

    There is no timezone field on a family, and this is deliberately not a
    reason to add one: every learning event already carries the offset the
    browser was in when it was recorded, because mastery counts days in the
    child's day rather than the server's. A scheduled job asking "is it six in
    the evening where they are?" is asking the same question the log already
    answers.

    An *offset* rather than an IANA zone, so it is worth being plain about the
    limit: it is the offset that was true when they last practised, which a
    daylight-saving change can leave an hour stale until the next round is
    played. An hour of drift on a Sunday summary is not worth a new field on
    every device registration to prevent — and a family who has not practised
    since the clocks changed has no summary to be sent anyway.

    `None` means nobody in this family has ever practised, which every caller
    reads as "nothing to say" rather than as an error.
    """
    row = await db.events.find_one(
        {"familyId": family_id, "tzOffsetMinutes": {"$ne": None}},
        {"tzOffsetMinutes": 1},
        sort=[("receivedAt", -1)],
    )
    if row is None:
        return None
    offset = row.get("tzOffsetMinutes")
    # A device is entitled to be wrong about itself; a job is not entitled to
    # crash because of it. Real offsets run from -12:00 to +14:00.
    return offset if isinstance(offset, int) and -840 <= offset <= 840 else None


async def days_practised(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, days: list[str]
) -> int:
    """How many of these local days this learner finished something on.

    The days are passed in rather than derived from a range here, because the
    caller is the only thing that knows where the learner's week starts — and a
    string comparison over `localDay` would quietly include a day the caller did
    not mean the moment one client writes the field in another format.
    """
    if not days:
        return 0
    found = await db.events.distinct(
        "localDay",
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "type": COMPLETED,
            "localDay": {"$in": days},
        },
    )
    return len(found)


async def rounds_and_time(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, days: list[str]
) -> tuple[int, int]:
    """Rounds finished on these local days, and the milliseconds they took.

    Read off the client's own `durationMs` on each finished round — the same
    figure the learning log totals — so a parent's "38 minutes" and the app's
    agree. A round with no duration counts as a round and adds no time.
    """
    if not days:
        return 0, 0
    pipeline = [
        {
            "$match": {
                "familyId": family_id,
                "learnerId": learner_id,
                "type": COMPLETED,
                "localDay": {"$in": days},
            }
        },
        {
            "$group": {
                "_id": None,
                "rounds": {"$sum": 1},
                "ms": {"$sum": {"$ifNull": ["$durationMs", 0]}},
            }
        },
    ]
    rows = [row async for row in db.events.aggregate(pipeline)]
    if not rows:
        return 0, 0
    return int(rows[0]["rounds"]), int(rows[0]["ms"] or 0)


async def completed_on(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, local_day: str
) -> int:
    """Rounds this learner finished on one of their own days."""
    return await db.events.count_documents(
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "type": COMPLETED,
            "localDay": local_day,
        }
    )


async def practised_on(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, local_day: str
) -> bool:
    """Whether this learner finished anything on one of their own days.

    A boolean rather than `completed_on(...) > 0` at the call site, because the
    reminder asks a yes/no question and counting rows to answer it reads the
    whole day when the first document would do.
    """
    return (
        await db.events.find_one(
            {
                "familyId": family_id,
                "learnerId": learner_id,
                "type": COMPLETED,
                "localDay": local_day,
            },
            {"_id": 1},
        )
        is not None
    )


#: Which of Learn's three a finished round belongs to, by the skill that sent it.
READ_SKILL = "koda-library"
WRITE_SKILL = "koda-trace"


_READING_QUIZ_PARTS = {
    "comprehension_choice": "comprehension",
    "match_pairs": "matching",
    "vocab_match": "vocabulary",
    "opposite_match": "vocabulary",
    "reading_match": "wordReading",
    "spell_word_in_sentence": "spelling",
}


async def reading_report(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> ReadingReportOut:
    report = ReadingReportOut()
    end = now()
    start = end - timedelta(days=report.days)
    start_ts, end_ts = (value.isoformat(timespec="milliseconds").replace("+00:00", "Z") for value in (start, end))
    # Use the existing learner/type/day index to narrow the scan. Local days can
    # differ from UTC, so use timestamps for the exact window.
    cursor = db.events.find(
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "skillId": READ_SKILL,
            "type": {"$in": ["page_read", "reading_finished", "lesson_started", "question_presented", "answer_submitted"]},
            "localDay": {"$gte": (start - timedelta(days=1)).date().isoformat()},
            "ts": {"$gte": start_ts, "$lte": end_ts},
        },
        {key: 1 for key in ("type", "ts", "localDay", "sessionId", "lessonId", "entry", "questionId", "taskKind",
                            "attempt", "correct", "supportsUsed")},
    ).sort([("sessionId", 1), ("seq", 1), ("serverSeq", 1)]).allow_disk_use(True)

    days: set[str] = set()
    books: dict[str, ReadingBookOut] = {}
    latest: dict[str, tuple[str, str]] = {}
    comprehension: dict[str, ReadingComprehensionOut] = {}
    quizzes: set[tuple[str, str]] = set()
    questions: dict[tuple[str, str, str], str] = {}
    async for row in cursor:
        kind = row["type"]
        session = row["sessionId"]
        lesson = row.get("lessonId", "")
        book_id = lesson.rsplit("@", 1)[0]
        if kind == "lesson_started":
            # Library quizzes mark preview mode on the start event.
            if row.get("entry") == "preview":
                quizzes.discard((session, lesson))
            else:
                quizzes.add((session, lesson))
            continue
        if row.get("entry") == "preview":
            continue
        if kind in ("page_read", "reading_finished"):
            day = row["localDay"]
            days.add(day)
            if kind == "page_read":
                report.page_visits += 1
            if book_id:
                if book_id not in books:
                    books[book_id] = ReadingBookOut(bookId=book_id, lastReadDay=day)
                book = books[book_id]
                book.finished = book.finished or kind == "reading_finished"
                if (activity := (row["ts"], lesson)) > latest.get(book_id, ("", "")):
                    latest[book_id] = activity
                    book.last_read_day = day
            continue
        if (session, lesson) not in quizzes or not isinstance(row.get("questionId"), str):
            continue
        question = (session, lesson, row["questionId"])
        if kind == "question_presented":
            task = row.get("taskKind")
            part = _READING_QUIZ_PARTS.get(task) if isinstance(task, str) else None
            if part:
                questions[question] = part
        elif row.get("attempt") == 1 and (part := questions.pop(question, None)):
            correct = int(row.get("correct") is True and row.get("supportsUsed") == 0)
            score = report.quiz.setdefault(part, ReadingQuizOut())
            score.answered += 1
            score.correct_first_try += correct
            if part == "comprehension" and book_id:
                story_score = comprehension.setdefault(book_id, ReadingComprehensionOut())
                story_score.answered += 1
                story_score.correct_first_try += correct
                story_score.correct_with_help += int(row.get("correct") is True and (row.get("supportsUsed") or 0) > 0)
                story_score.incorrect_first_try += int(row.get("correct") is False)

    titles = await revision_titles(db, [lesson for _, lesson in latest.values()])
    for book_id in sorted(books, key=latest.__getitem__, reverse=True):
        book = books[book_id]
        book.title = titles.get(latest[book_id][1])
        book.comprehension = comprehension.get(book_id)
        report.books.append(book)
    report.books_finished = sum(book.finished for book in report.books)
    report.reading_days = len(days)
    report.reading_dates = sorted(days)
    return report


#: What the learning journal reads, and the fields it needs from each.
JOURNAL_TYPES = ("page_read", "reading_finished", "lesson_completed")
JOURNAL_FIELDS = ("eventId", "type", "ts", "localDay", "skillId", "lessonId", "entry", "page", "pageCount", "dwellMs",
                  "durationMs", "questionsAnswered", "correctFirstTry")
#: The longest window a journal can ask for, and a ceiling on rows, so one call stays small.
JOURNAL_MAX_DAYS = 60
JOURNAL_MAX_ROWS = 20_000


async def journal(db: AsyncIOMotorDatabase, family_id: str, learner_id: str, days: int) -> dict[str, Any]:
    """A learner's reading and finished rounds for the last `days` of their own days.

    The rows, not a summary: the app folds them with the same function it uses
    on a child's own device (src/lib/learning/journal.ts), so a parent's phone
    and the child's tablet draw the same days. Preview runs are an author's, not
    the child's, and are left out here. Book titles come with the rows, by the
    revision the child actually opened.
    """
    days = max(1, min(days, JOURNAL_MAX_DAYS))
    since = (now() - timedelta(days=days + 1)).date().isoformat()
    cursor = db.events.find(
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "type": {"$in": list(JOURNAL_TYPES)},
            "localDay": {"$gte": since},
            "entry": {"$ne": "preview"},
        },
        {"_id": 0, **{key: 1 for key in JOURNAL_FIELDS}},
    ).sort("ts", -1).limit(JOURNAL_MAX_ROWS)
    rows: list[dict[str, Any]] = []
    async for row in cursor:
        row["id"] = row.pop("eventId", None)
        rows.append(row)
    rows.reverse()
    books = sorted({row["lessonId"] for row in rows if row.get("skillId") == READ_SKILL and "@" in row.get("lessonId", "")})
    return {"learnerId": learner_id, "days": days, "events": rows, "titles": await revision_titles(db, books)}


async def rounds_by_category(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, days: list[str]
) -> dict[str, int]:
    """Finished rounds on these days, split into Think (lessons), Read (books) and Write (tracing)."""
    out = {"think": 0, "read": 0, "write": 0}
    if not days:
        return out
    pipeline = [
        {"$match": {"familyId": family_id, "learnerId": learner_id, "type": COMPLETED, "localDay": {"$in": days}}},
        {"$group": {"_id": "$skillId", "n": {"$sum": 1}}},
    ]
    async for row in db.events.aggregate(pipeline):
        key = "read" if row["_id"] == READ_SKILL else "write" if row["_id"] == WRITE_SKILL else "think"
        out[key] += int(row["n"])
    return out


async def practice_days(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, limit: int = 400
) -> list[str]:
    """Every local day this learner finished something on, newest first.

    Distinct days rather than events: a streak counts days, and a child who did
    nine rounds on Tuesday had one Tuesday. Bounded because the events
    collection ages out at 400 days anyway, so a longer answer would be a
    promise the data cannot keep.
    """
    days = await db.events.distinct(
        "localDay",
        {"familyId": family_id, "learnerId": learner_id, "type": COMPLETED},
    )
    return sorted((day for day in days if isinstance(day, str)), reverse=True)[:limit]
