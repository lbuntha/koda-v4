"""What this deployment actually sent, and what became of it.

The gap this fills is narrow and was costing real time. `notifications` records
what one *person* was told, for the bell in their own app. `push_runs` records
what a job claimed, so a retry does not repeat it. Neither says whether anything
reached a phone — the delivery outcome existed only in a return value and a log
line, so "did Sunday's summary actually go out?" had no answer once the job's
report scrolled off a screen.

That matters more here than it would elsewhere, because §7 opens by saying push
"is the one feature here an operator cannot verify by looking at it, and its
failure mode is *silence*". Preflight answers that question *before* a send. This
answers it after.

**One row per `send()` call, not per device.** A family send fans out across
however many browsers the adults hold, and an operator's question is about the
notification, not the sockets: it went to two people across three browsers, one
of which had thrown its subscription away. The per-device detail is kept as
counts rather than rows, which is the level somebody actually reads.

**What is stored is what was already stored.** The title and body are the same
sentences `notifications` keeps for the parent, and §13's rule holds unchanged:
a child's first name is the most that ever appears, and no token, no device id
and nothing about a learning record goes in here.
"""

from datetime import timedelta
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

#: How long a send is kept. Long enough to answer "did last Sunday work?" twice
#: over, short enough that this never becomes a second event log. The TTL index
#: in `indexes.py` does the deleting; the nightly job only tidies after it.
KEEP_DAYS = 45

#: How many unopened deliveries of one kind turn it off for one person (§9).
#:
#: Eight, and the number matters less than the direction: a reminder nobody
#: opens is not a reminder, it is noise with our name on it. Counted per person
#: and per kind, because one parent ignoring the weekly summary says nothing
#: about another, and ignoring summaries says nothing about whether they want to
#: know a new device signed in.
RUN_LIMIT = 8


async def record(
    db: AsyncIOMotorDatabase,
    *,
    kind: str,
    family_id: str | None,
    people: list[str],
    title: str,
    body: str,
    path: str,
    driver: str,
    devices: int,
    delivered: int,
    outcomes: dict[str, int],
) -> None:
    """Write one send down. Never raises.

    Called from `push.send`, which is itself written never to raise — so a
    failure to *record* a notification must not be the thing that stops one
    being sent. The log is the second most important thing here, and it knows
    it.
    """
    try:
        await db.push_log.insert_one(
            {
                "_id": f"pl_{uuid4().hex[:20]}",
                "kind": kind,
                "familyId": family_id,
                # Who was told, as accounts. A count would not let an operator
                # answer "did *this* parent get it", which is the question that
                # actually arrives as a support message.
                "people": people,
                "title": title,
                "body": body,
                "path": path,
                # `console` is not a failure, and a row saying "0 delivered"
                # without saying why would read as one on every dev machine.
                "driver": driver,
                "devices": devices,
                "delivered": delivered,
                # FCM's own words, counted: `dead`, `soft`, `config`, `quota`.
                # The vocabulary is `fcm.Outcome`'s, kept rather than translated
                # so an operator searching for what they saw in a Google console
                # finds the same word here.
                "outcomes": outcomes,
                "at": now(),
                # Set when somebody taps this notification. Absent means it has
                # not been opened, which is what §9's counter reads.
                "openedAt": None,
            }
        )
    except Exception:  # noqa: BLE001 — a log that breaks a send is worse than no log
        pass


async def recent(
    db: AsyncIOMotorDatabase, *, limit: int = 50, kind: str | None = None
) -> list[dict[str, Any]]:
    """The newest sends, most recent first."""
    mongo_filter: dict[str, Any] = {}
    if kind:
        mongo_filter["kind"] = kind
    return await (
        db.push_log.find(mongo_filter).sort("at", -1).limit(max(1, min(limit, 200))).to_list(length=200)
    )


async def summary(db: AsyncIOMotorDatabase, *, days: int = 7) -> list[dict[str, Any]]:
    """Per kind, over the last few days: how many sends and how many arrived.

    The line an operator reads first. A kind that has sent forty notifications
    and delivered none is the exact shape of this feature's failure mode, and it
    is invisible in a list of forty rows that each look individually fine.
    """
    pipeline = [
        {"$match": {"at": {"$gte": now() - timedelta(days=days)}}},
        {
            "$group": {
                "_id": "$kind",
                "sends": {"$sum": 1},
                "devices": {"$sum": "$devices"},
                "delivered": {"$sum": "$delivered"},
                "last": {"$max": "$at"},
            }
        },
        {"$sort": {"last": -1}},
    ]
    return [row async for row in db.push_log.aggregate(pipeline)]


async def sweep(db: AsyncIOMotorDatabase) -> int:
    """Drop what is older than anybody would ask about."""
    result = await db.push_log.delete_many({"at": {"$lt": now() - timedelta(days=KEEP_DAYS)}})
    return result.deleted_count


async def unopened_run(db: AsyncIOMotorDatabase, user_id: str, kind: str) -> int:
    """How many of this kind this person has been sent since they last opened one.

    §9's counter, read rather than stored: the log already knows what was sent
    and `openedAt` records what was tapped, so a separate tally would be a
    second copy of a fact — the kind that drifts, because a send is written by a
    job and a tap by a browser and neither is looking at the other.

    Only *delivered* sends count. A notification that never left the process,
    because nobody had a browser registered or the driver was `console`, is not
    something somebody declined to open.
    """
    rows = await (
        db.push_log.find(
            {"kind": kind, "people": user_id, "delivered": {"$gt": 0}},
            {"openedAt": 1},
        )
        .sort("at", -1)
        .limit(RUN_LIMIT + 1)
        .to_list(length=RUN_LIMIT + 1)
    )
    run = 0
    for row in rows:
        if row.get("openedAt"):
            break
        run += 1
    return run


async def note_opened(db: AsyncIOMotorDatabase, user_id: str, kind: str) -> None:
    """Record that this person opened one, which resets the run above.

    The most recent unopened send of that kind to that person, not all of them:
    a tap is one act, and marking a fortnight of them opened would erase the
    very history the counter reads.
    """
    row = await db.push_log.find_one(
        {"kind": kind, "people": user_id, "openedAt": None}, sort=[("at", -1)]
    )
    if row:
        await db.push_log.update_one({"_id": row["_id"]}, {"$set": {"openedAt": now()}})
