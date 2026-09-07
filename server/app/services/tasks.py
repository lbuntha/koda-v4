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
from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now as utc_now
from app.repos import events as events_repo
from app.repos import learners as learners_repo
from app.repos import notifications, notify_prefs, notify_schedule, push_log, push_runs, push_tokens
from app.services import push, streaks

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


def _next_summary_evening(local: datetime, offset_minutes: int) -> datetime:
    """When this family's summary is actually due, from where they are now.

    For a preview to say something an operator can check: "Sunday" is not a
    date until you know whose Sunday, and the answer is different for a family
    in Phnom Penh and one in Lisbon.

    The offset is reattached rather than inherited. `_local` shifts a UTC
    instant by the family's offset and leaves it labelled UTC, which is right
    for the comparisons above — they only ever read the wall clock — and wrong
    the moment the value is *shown* to somebody: "18:00+00:00" for a family two
    hours east is a time that does not exist anywhere.
    """
    ahead = (SUNDAY - local.weekday()) % 7
    due = (local + timedelta(days=ahead)).replace(
        hour=SUMMARY_HOUR, minute=0, second=0, microsecond=0
    )
    if due < local:
        due += timedelta(days=7)
    return due.replace(tzinfo=timezone(timedelta(minutes=offset_minutes)))


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
    preview: bool = False,
) -> dict[str, Any]:
    """Tell each parent how their children's week went, once, on Sunday evening.

    Called every hour. Almost every call does nothing, which is the design
    rather than waste: the filter that decides *whose* Sunday evening it is now
    costs one indexed lookup per family, and it is the only way one schedule can
    serve every timezone.

    `preview` answers the question an operator actually has on a Tuesday: *what
    would Sunday send?* It reports the same wording a parent would read, claims
    nothing and sends nothing — and it drops the day-and-hour filter, because a
    preview that is empty six days out of seven answers nothing. What it does
    *not* drop is the operator ceiling or a family's own preference: a preview
    that shows a summary somebody has switched off would be a preview of a
    different product.
    """
    at = at or utc_now()
    report: dict[str, Any] = {
        "job": "weekly-summary",
        "preview": preview,
        "families": 0,
        "due": 0,
        # What the run *decided* to send, and what actually left the process.
        # Two numbers rather than one, because they part company legitimately:
        # a parent who has switched summaries off is still a summary the job
        # composed and claimed, and the console driver sends nothing at all.
        "summaries": 0,
        "sent": 0,
        "cursor": None,
        # When the earliest family this run passed over is next due. Present
        # only when something was passed over, so "nothing happened" can say
        # *when* instead of only *no*.
        "nextDue": None,
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
        if not preview and (local.weekday() != SUNDAY or local.hour != SUMMARY_HOUR):
            # Not their evening. Remember when it *will* be, soonest first.
            #
            # Only ever a report. An hourly tick throws this away, and it costs
            # arithmetic on a value already in hand — but it is the difference
            # between an operator pressing "run now" on a Tuesday and being told
            # "nothing", and being told when the thing they pressed will happen.
            due_at = _next_summary_evening(local, offset)
            soonest = report.get("nextDue")
            if soonest is None or due_at.isoformat() < soonest:
                report["nextDue"] = due_at.isoformat()
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

            already = await push_runs.was_claimed(
                db, kind=WEEKLY_SUMMARY, recipient_id=learner_id, date_key=date_key
            )
            # `claim` is the decision and `was_claimed` is only ever a report —
            # a preview must not take the right to send the thing it is
            # describing, or looking would stop Sunday from happening.
            if not preview and not await push_runs.claim(
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
                    # The placeholder the shipped wording used before it learned
                    # to say "1 day". Supplied so that wording an operator saved
                    # against the old body still fills — `fill` leaves an
                    # unknown placeholder standing, so dropping this would put a
                    # literal "{days}" on somebody's lock screen.
                    "days": practised,
                },
            )
            report["summaries"] += 1
            if preview:
                # What a parent would read, and whether they already have. No
                # token, no device id, nothing that is not already on the
                # operator's own admin screens.
                report.setdefault("would_send", []).append(
                    {
                        "familyId": family_id,
                        "learnerId": learner_id,
                        "learner": learner.get("displayName"),
                        "days": practised,
                        "title": title,
                        "body": body,
                        "alreadySent": already,
                        "theirSundayEvening": _next_summary_evening(local, offset).isoformat(),
                    }
                )
                continue
            # One tag per child: the collapse key in §5 is `weekly:{learnerId}`
            # precisely so that a family with three children reads three
            # summaries rather than the last one to arrive.
            report["sent"] += await push.send(
                db,
                to=push.Recipient(family_id=family_id),
                kind=WEEKLY_SUMMARY,
                title=title,
                body=body,
                # The child the summary is about, so the tap lands on their
                # record rather than on the home screen. `landing.ts` maps it;
                # the path names a screen and is never trusted to grant one.
                path=f"/children/{learner_id}",
                tag=f"weekly:{learner_id}",
            )

    return report


async def token_sweep(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """The nightly tidy, for the three collections push leaves behind.

    All four are unbounded without it, and each grows for a different reason: a
    token nobody refreshed, a notification nobody will ever scroll back to, a
    claim no job could still repeat, a send nobody will ask about again. None is
    urgent, which is why they share one job at three in the morning rather than
    each getting a timer.
    """
    report = {
        "job": "token-sweep",
        "tokens": await push_tokens.sweep(db),
        "notifications": await notifications.sweep(db),
        "runs": await push_runs.sweep(db),
        "log": await push_log.sweep(db),
    }
    log.info("token sweep: %s", report)
    return report


PRACTICE_REMINDER = "learn.practice_reminder"
STREAK_ENDING = "learn.streak_ending"

#: How late a streak warning may go out.
#:
#: Sent with the reminder rather than on its own schedule: a family who hears
#: "time to practise" at five and "the streak ends today" at eight has been
#: notified twice about one evening, which is how a courtesy becomes a nag. One
#: tick, and the streak line replaces the reminder when there is a streak at
#: stake — it is the same sentence with more reason behind it.
async def daily_reminders(
    db: AsyncIOMotorDatabase,
    *,
    at: datetime | None = None,
    cursor: str | None = None,
    limit: int = FAMILY_PAGE,
    preview: bool = False,
) -> dict[str, Any]:
    """Remind whoever asked to be reminded, at the hour they chose.

    Hourly, and the filter is per *person* rather than per family: two parents
    on one account may have picked different hours, and one of them having
    already been reminded is not a reason the other has been.

    Three gates before anything is composed, in the order that costs least:
    the deployment's switch, then whether it is that person's hour, then
    whether the child has already practised — because the last is a query and
    the first two are arithmetic.

    Quiet hours are checked even though the chosen hour is the person's own: a
    parent who picks 22:00 and has quiet hours from 21:00 has contradicted
    themselves, and the window is the one that says "not now" out loud.
    """
    at = at or utc_now()
    report: dict[str, Any] = {
        "job": "daily-reminders",
        "preview": preview,
        "families": 0,
        "due": 0,
        "reminders": 0,
        "streaks": 0,
        "sent": 0,
        "cursor": None,
    }

    allows_reminder = await push.deployment_allows(db, PRACTICE_REMINDER)
    allows_streak = await push.deployment_allows(db, STREAK_ENDING)
    if not (allows_reminder or allows_streak):
        report["skipped"] = "the deployment does not send reminders"
        return report

    families = await _families_with_browsers(db, after=cursor, limit=limit)
    report["families"] = len(families)
    if len(families) == limit:
        report["cursor"] = families[-1]

    for family_id in families:
        # Who in this family wants either kind, and at what hour.
        people = await push.adults_of(db, family_id)
        if not people:
            continue
        prefs = await notify_prefs.for_users(db, people)
        schedules = await notify_schedule.for_users(db, people)

        # The browser's own report first, the learning log second.
        #
        # The order matters here and nowhere else. A reminder is *for* a child
        # who has not practised, and one who never has leaves no event to read a
        # timezone from — so reading the log first would have worked for every
        # family except exactly the ones this kind exists for.
        offset = next(
            (s["tzOffsetMinutes"] for s in schedules.values() if s["tzOffsetMinutes"] is not None),
            None,
        )
        if offset is None:
            offset = await events_repo.latest_tz_offset(db, family_id)
        if offset is None:
            # Nobody has told us what hour it is where they are, and guessing
            # would ring somebody in the middle of their night.
            continue

        local = _local(at, offset)
        today = local.date().isoformat()

        due_now = [
            user_id
            for user_id in people
            if schedules[user_id]["reminderHour"] == local.hour
            and not notify_schedule.is_quiet(schedules[user_id], local.hour)
            and (
                (allows_reminder and push.wanted_by(PRACTICE_REMINDER, prefs.get(user_id)))
                or (allows_streak and push.wanted_by(STREAK_ENDING, prefs.get(user_id)))
            )
        ]
        if not preview and not due_now:
            continue
        report["due"] += 1

        for learner in await learners_repo.for_family(db, family_id):
            learner_id = learner["_id"]
            name = learner.get("displayName", "Your child")

            if await events_repo.practised_on(db, family_id, learner_id, today):
                # The whole point of the kind. A child who has already had a go
                # is a child nobody needs telling about.
                continue

            # A streak at stake outranks a plain reminder: same evening, better
            # reason, and never both.
            at_stake = await streaks.ending_today(db, family_id, learner_id, today=today)
            kind = STREAK_ENDING if at_stake and allows_streak else PRACTICE_REMINDER
            if kind == PRACTICE_REMINDER and not allows_reminder:
                continue

            values = {"learner": name, "days": at_stake}
            title, body = await push.wording(db, kind, values)

            if preview:
                report.setdefault("would_send", []).append(
                    {
                        "familyId": family_id,
                        "learnerId": learner_id,
                        "learner": name,
                        "kind": kind,
                        "title": title,
                        "body": body,
                        "streak": at_stake,
                        "people": len(due_now),
                    }
                )
                continue

            if not await push_runs.claim(db, kind=kind, recipient_id=learner_id, date_key=today):
                continue

            report["streaks" if kind == STREAK_ENDING else "reminders"] += 1
            report["sent"] += await push.send(
                db,
                to=push.Recipient(family_id=family_id),
                kind=kind,
                title=title,
                body=body,
                path=f"/children/{learner_id}",
                tag=f"{'streak' if kind == STREAK_ENDING else 'remind'}:{learner_id}",
            )

    return report
