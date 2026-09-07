"""Work that nothing asks for.

Cloud Run has no clock. Every other piece of this service runs because somebody
opened a page, and a weekly summary has nobody to open it — so the work lives
here and Cloud Scheduler calls `routers/tasks.py` on the hour.

Two things shape everything below.

**A run is bounded, and says where it stopped.** A scale-to-zero instance can
take seconds to answer and the job's deadline is five minutes, so no run may be
"every family on the deployment". Each returns a `cursor`, and the caller asks
again with it. That is what makes a slow start a slow job rather than a failed
one — and, because the ledger is claimed per notification rather than per run,
what makes a half-finished run safe to repeat.

**Hourly, filtered locally, rather than a job per timezone.** The schedule is
one line of cron and the *deciding* is done here against each family's own
offset, so a family who moves country is right the next day with nobody touching
an operator console. It also fixes something a Sunday-only schedule cannot: six
in the evening on a local Sunday is a UTC Monday for everybody east of London,
and a job that only ran on Sundays UTC would simply never reach them.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now as utc_now
from app.repos import events as events_repo
from app.repos import learners as learners_repo
from app.repos import notifications, push_runs, push_tokens
from app.services import push

log = logging.getLogger("koda.tasks")

WEEKLY_SUMMARY = "learn.weekly_summary"

#: Sunday, in Python's Monday-is-zero numbering.
SUNDAY = 6

#: The hour, in the family's own evening, that a summary is sent.
#:
#: A constant rather than a preference because there is no screen that sets one
#: yet. When phase 4 adds the hour picker for reminders, a summary should read
#: the same row — the shape of this function does not change, only where the
#: number comes from.
SUMMARY_HOUR = 18

#: How many days a summary looks back over. Seven, ending on the evening it is
#: sent, so "this week" means the week the parent has just watched happen.
SUMMARY_DAYS = 7

#: Families examined per call. Small enough to finish inside a cold start's
#: budget, large enough that a deployment does not spend a hundred requests
#: getting through a hundred families.
FAMILY_PAGE = 200


def _local(at: datetime, offset_minutes: int) -> datetime:
    """The same instant, read off the family's own clock."""
    return at + timedelta(minutes=offset_minutes)


def _day_keys(end: datetime, days: int) -> list[str]:
    """The `localDay` strings for the window ending on `end`'s day, inclusive.

    Built as strings because that is what a learning event stores: the client
    writes the child's own day, and comparing dates here would mean trusting a
    UTC timestamp to say which day a nine-o'clock round belonged to.
    """
    last = end.date()
    return [(last - timedelta(days=offset)).isoformat() for offset in range(days)]


async def _families_with_browsers(
    db: AsyncIOMotorDatabase, *, after: str | None, limit: int
) -> list[str]:
    """The only families a notification job has any business waking up for.

    Read off the token table rather than the family table, and that is the whole
    of the filter: a family with no live browser cannot be rung, so paging
    through the rest of the deployment to discover that is work with a known
    answer. It also keeps the job's cost proportional to the number of people
    who asked for notifications rather than to the number of accounts.

    Grouped and limited by Mongo rather than by this process. One household
    holds several tokens, so the rows are always more numerous than the answer,
    and reading them all back to keep the first two hundred distinct ids would
    make the page size decorative — the run would still have carried the whole
    table across the wire before it paged anything.
    """
    match: dict[str, Any] = {"disabledAt": None, "familyId": {"$ne": None}}
    if after is not None:
        match["familyId"] = {"$gt": after}
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$familyId"}},
        {"$sort": {"_id": 1}},
        {"$limit": limit},
    ]
    return [row["_id"] async for row in db.push_tokens.aggregate(pipeline)]


async def weekly_summary(
    db: AsyncIOMotorDatabase,
    *,
    at: datetime | None = None,
    cursor: str | None = None,
    limit: int = FAMILY_PAGE,
) -> dict[str, Any]:
    """Tell each parent how their children's week went, once, on Sunday evening.

    Called every hour. Almost every call does nothing, which is the design
    rather than waste: the filter that decides *whose* Sunday evening it is now
    costs one indexed lookup per family, and it is the only way one schedule can
    serve every timezone.
    """
    at = at or utc_now()
    report: dict[str, Any] = {
        "job": "weekly-summary",
        "families": 0,
        "due": 0,
        # What the run *decided* to send, and what actually left the process.
        # Two numbers rather than one, because they part company legitimately:
        # a parent who has switched summaries off is still a summary the job
        # composed and claimed, and the console driver sends nothing at all.
        "summaries": 0,
        "sent": 0,
        "cursor": None,
    }

    # The operator's ceiling, asked once for the whole run rather than once per
    # family. A deployment with the switch off should cost one query, not one
    # per household.
    if not await push.deployment_allows(db, WEEKLY_SUMMARY):
        report["skipped"] = "the deployment does not send weekly summaries"
        return report

    families = await _families_with_browsers(db, after=cursor, limit=limit)
    report["families"] = len(families)
    if len(families) == limit:
        # More to do. Reported rather than continued: the caller decides whether
        # there is budget left in this run's five minutes.
        report["cursor"] = families[-1]

    for family_id in families:
        offset = await events_repo.latest_tz_offset(db, family_id)
        if offset is None:
            # Nobody here has ever finished a round, so there is no week to
            # summarise and no clock to read.
            continue

        local = _local(at, offset)
        if local.weekday() != SUNDAY or local.hour != SUMMARY_HOUR:
            continue
        report["due"] += 1

        days = _day_keys(local, SUMMARY_DAYS)
        date_key = days[0]

        for learner in await learners_repo.for_family(db, family_id):
            learner_id = learner["_id"]
            practised = await events_repo.days_practised(db, family_id, learner_id, days)
            if practised == 0:
                # A summary of a week with nothing in it is not a summary, it is
                # a nag — and §1 is explicit that this must not become one. The
                # child who did not practise is exactly the child whose parent
                # should not be told so by a phone on a Sunday evening.
                continue

            if not await push_runs.claim(
                db, kind=WEEKLY_SUMMARY, recipient_id=learner_id, date_key=date_key
            ):
                continue

            title, body = await push.wording(
                db,
                WEEKLY_SUMMARY,
                {
                    "learner": learner.get("displayName", "Your child"),
                    # The noun travels with the number: see `push_defaults`.
                    "practice": f"{practised} day" if practised == 1 else f"{practised} days",
                },
            )
            report["summaries"] += 1
            # One tag per child: the collapse key in §5 is `weekly:{learnerId}`
            # precisely so that a family with three children reads three
            # summaries rather than the last one to arrive.
            report["sent"] += await push.send(
                db,
                to=push.Recipient(family_id=family_id),
                kind=WEEKLY_SUMMARY,
                title=title,
                body=body,
                tag=f"weekly:{learner_id}",
            )

    return report


async def token_sweep(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """The nightly tidy, for the three collections push leaves behind.

    All three are unbounded without it, and each grows for a different reason: a
    token nobody refreshed, a notification nobody will ever scroll back to, a
    claim no job could still repeat. None is urgent, which is why they share one
    job at three in the morning rather than each getting a timer.
    """
    report = {
        "job": "token-sweep",
        "tokens": await push_tokens.sweep(db),
        "notifications": await notifications.sweep(db),
        "runs": await push_runs.sweep(db),
    }
    log.info("token sweep: %s", report)
    return report
