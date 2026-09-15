"""Noticing what a synced batch changed about a child — and telling their parents.

The Phase 3 and 4 half of parent notifications, and deliberately beside
`milestones.py` rather than in `tasks.py`: a lesson becoming secure is a thing a
*round* decides, and telling a parent at the top of some later hour would be a
different message.

**Before and after, around the rollup.** `snapshot` reads each touched concept's
status just before `rollups.apply`, inside the sync request, and `after_sync`
reads it again once the response has gone. Only a change is news — a concept
that was already mastered does not congratulate anybody twice.

**Every message is claimed before it is sent**, so a device replaying its outbox
on a bad connection repeats nothing:

* mastered — per concept, once; and one push per child per day however many land;
* stuck — per concept per ISO week, and only once it has gone wrong on more than
  one day;
* time limit — per child per local day.

Nothing here raises. It runs after the child's round has been accepted.
"""

import logging
from datetime import date
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repos import learners as learners_repo
from app.repos import progress_marks, push_runs
from app.services import email_notify, mastery, push

log = logging.getLogger("koda.progress")

MASTERED = "learn.mastered"
STUCK = "learn.stuck"
TIME_LIMIT = "learn.time_limit"
LIMIT_EVENT = "daily_limit_reached"

Pair = tuple[str, str]


def _week_key(local_day: str) -> str:
    try:
        year, week, _ = date.fromisoformat(local_day).isocalendar()
    except ValueError:
        return local_day
    return f"{year}-W{week:02d}"


def _minutes_text(minutes: int) -> str:
    return "1 minute" if minutes == 1 else f"{minutes} minutes"


async def _totals(db: AsyncIOMotorDatabase, family_id: str, pairs: set[Pair]) -> dict[Pair, dict[str, Any]]:
    if not pairs:
        return {}
    rows = await db.concept_totals.find(
        {
            "familyId": family_id,
            "$or": [{"learnerId": learner_id, "conceptKey": concept} for learner_id, concept in pairs],
        },
        {"_id": 0},
    ).to_list(length=len(pairs))
    return {(row["learnerId"], row["conceptKey"]): row for row in rows}


async def snapshot(db: AsyncIOMotorDatabase, family_id: str, pairs: set[Pair]) -> dict[Pair, str]:
    """Each touched concept's status before this batch lands. Never raises."""
    try:
        totals = await _totals(db, family_id, pairs)
        return {pair: mastery.status_of(totals.get(pair)) for pair in pairs}
    except Exception:  # noqa: BLE001
        log.exception("could not read concept status before a sync")
        return {}


async def after_sync(
    db: AsyncIOMotorDatabase,
    family_id: str,
    inserted: list[dict[str, Any]],
    before: dict[Pair, str],
) -> None:
    """Tell parents what this batch changed. Runs after the response. Never raises."""
    try:
        await _time_limits(db, family_id, inserted)
        await _learning_changes(db, family_id, inserted, before)
    except Exception:  # noqa: BLE001 — a notification is never worth a failed sync
        log.exception("could not notify about a synced batch")


async def _name_of(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> str | None:
    learner = await learners_repo.by_id(db, learner_id, family_id)
    return (learner or {}).get("displayName") if learner else None


async def _time_limits(db: AsyncIOMotorDatabase, family_id: str, inserted: list[dict[str, Any]]) -> None:
    for event in inserted:
        if event.get("type") != LIMIT_EVENT:
            continue
        learner_id, day = event.get("learnerId"), event.get("localDay")
        if not learner_id or not day:
            continue
        name = await _name_of(db, family_id, learner_id)
        if name is None:
            # An adult's own device keeps a clock too; only a child is reported on.
            continue
        if not await push_runs.claim(db, kind=TIME_LIMIT, recipient_id=learner_id, date_key=day):
            continue
        try:
            minutes = int(event.get("limitMinutes") or 0)
        except (TypeError, ValueError):
            minutes = 0
        values = {"learner": name, "minutes": _minutes_text(minutes)}
        title, body = await push.wording(db, TIME_LIMIT, values)
        await push.send(
            db,
            to=push.Recipient(family_id=family_id),
            kind=TIME_LIMIT,
            title=title,
            body=body,
            path=f"/children/{learner_id}",
            tag=f"time:{learner_id}",
        )
        await progress_marks.record(
            db, family_id=family_id, learner_id=learner_id, kind="time_limit", local_day=day,
            detail={"minutes": minutes},
        )


async def _learning_changes(
    db: AsyncIOMotorDatabase,
    family_id: str,
    inserted: list[dict[str, Any]],
    before: dict[Pair, str],
) -> None:
    if not before:
        return

    # The child's own latest day in this batch: the day a change belongs to.
    days: dict[str, str] = {}
    for event in inserted:
        learner_id, day = event.get("learnerId"), event.get("localDay")
        if learner_id and isinstance(day, str) and day > days.get(learner_id, ""):
            days[learner_id] = day

    totals = await _totals(db, family_id, set(before))
    newly_mastered: dict[str, list[str]] = {}
    names: dict[str, str | None] = {}

    for (learner_id, concept), was in sorted(before.items()):
        day = days.get(learner_id)
        if not day:
            continue
        row = totals.get((learner_id, concept))
        status = mastery.status_of(row)

        if status == "mastered" and was != "mastered":
            if await push_runs.claim(db, kind=MASTERED, recipient_id=f"{learner_id}:{concept}", date_key="secure"):
                newly_mastered.setdefault(learner_id, []).append(concept)
                await progress_marks.record(
                    db, family_id=family_id, learner_id=learner_id, kind="mastered", local_day=day,
                    concept_key=concept,
                )

        elif status == "struggling" and len((row or {}).get("practisedOn") or []) >= 2:
            if not await push_runs.claim(
                db, kind=STUCK, recipient_id=f"{learner_id}:{concept}", date_key=_week_key(day)
            ):
                continue
            if learner_id not in names:
                names[learner_id] = await _name_of(db, family_id, learner_id)
            if not names[learner_id]:
                continue
            values = {"learner": names[learner_id], "lesson": mastery.lesson_name(concept)}
            title, body = await push.wording(db, STUCK, values)
            path = f"/children/{learner_id}"
            await push.send(
                db,
                to=push.Recipient(family_id=family_id),
                kind=STUCK,
                title=title,
                body=body,
                path=path,
                tag=f"stuck:{learner_id}:{concept}",
            )
            await email_notify.send(db, kind=STUCK, values=values, family_id=family_id, path=path)
            await progress_marks.record(
                db, family_id=family_id, learner_id=learner_id, kind="stuck", local_day=day, concept_key=concept
            )

    for learner_id, concepts in newly_mastered.items():
        if learner_id not in names:
            names[learner_id] = await _name_of(db, family_id, learner_id)
        if not names[learner_id]:
            continue
        # One push per child per day: a good afternoon is one message, and the
        # bell and the digest still have every lesson.
        if not await push_runs.claim(db, kind=f"{MASTERED}:day", recipient_id=learner_id, date_key=days[learner_id]):
            continue
        values = {"learner": names[learner_id], "lessons": mastery.join_names([mastery.lesson_name(c) for c in concepts])}
        title, body = await push.wording(db, MASTERED, values)
        await push.send(
            db,
            to=push.Recipient(family_id=family_id),
            kind=MASTERED,
            title=title,
            body=body,
            path=f"/children/{learner_id}",
            tag=f"mastered:{learner_id}",
        )
