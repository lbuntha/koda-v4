"""What a scheduled job has already sent, so a retry does not send it again.

Cloud Scheduler retries on any non-2xx, and a job that reached nine hundred
parents and then hit a cold-start timeout will be handed back the whole run.
Without a record of what went, the retry is a second notification for everybody
it already reached — which is the one failure a courtesy notification cannot
recover from, because the apology is another notification.

So a row per thing sent, keyed `(kind, recipientId, dateKey)` and **written
before the send**, not after. The trade is deliberate and worth stating: a
process that dies between the claim and the send loses that one notification.
A weekly summary that does not arrive is a disappointment; a weekly summary that
arrives three times is the reason somebody turns notifications off. The cheaper
mistake is the one that stays quiet.

`dateKey` is the recipient's **local** day, not the server's, for the same
reason `localDay` exists on a learning event: the run that sends a Sunday
evening summary is a UTC Monday for half the world, and a ledger keyed in UTC
would let that family be told twice on what is, to them, one evening.
"""

from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.models.common import now

#: How long a claim is kept. Long enough that a job retried after a long outage
#: still finds it, short enough that this never becomes a second event log.
#: Nothing reads a claim except the job that might repeat it, and no job repeats
#: on a scale of months.
KEEP_DAYS = 60


def _row_id(kind: str, recipient_id: str, date_key: str) -> str:
    return f"{kind}:{recipient_id}:{date_key}"


async def claim(
    db: AsyncIOMotorDatabase, *, kind: str, recipient_id: str, date_key: str
) -> bool:
    """Take the right to send this one thing. True the first time, False after.

    The whole of the idempotency story is the unique `_id` and the duplicate
    error it raises — not a read followed by a write, which two instances of a
    job running at once would both pass. Cloud Run can quite normally be running
    two of them: a retry arrives while the first attempt is still working.
    """
    try:
        await db.push_runs.insert_one(
            {
                "_id": _row_id(kind, recipient_id, date_key),
                "kind": kind,
                "recipientId": recipient_id,
                "dateKey": date_key,
                "claimedAt": now(),
            }
        )
        return True
    except DuplicateKeyError:
        return False


async def was_claimed(
    db: AsyncIOMotorDatabase, *, kind: str, recipient_id: str, date_key: str
) -> bool:
    """Whether this has already gone. For reporting, never for deciding.

    A job must decide with `claim`, which is atomic. This exists so a dry run
    can say what it *would* send without taking the right to send it.
    """
    return await db.push_runs.find_one({"_id": _row_id(kind, recipient_id, date_key)}) is not None


async def sweep(db: AsyncIOMotorDatabase) -> int:
    """Drop claims nothing could still repeat.

    A TTL index does this too, and it is the one that runs on a deployment
    nobody is scheduling jobs on. This is here so the nightly job tidies its own
    collection rather than relying on a background thread it cannot see.
    """
    result = await db.push_runs.delete_many(
        {"claimedAt": {"$lt": now() - timedelta(days=KEEP_DAYS)}}
    )
    return result.deleted_count
