"""Something a child did, noticed as it lands.

The other half of phase 3, and deliberately not in `tasks.py`: a weekly summary
is a thing the clock decides, and a goal being met is a thing a *round* decides.
Waiting for the hour to come round to say "Mia met her goal" would deliver it
some time after she had gone to bed, which is a different notification.

So this runs off the sync push, on the events that were actually new. Three
rules follow from where it sits:

* **It never raises.** It is downstream of a child's finished round, and a
  notification that could turn that into a 500 is worse than no notification —
  the same sentence `push.send` is written under, kept true one level up
  because the counting happens here.
* **It is driven by what was inserted**, not by what was sent. A device
  replaying its outbox on a bad connection pushes the same rounds again, and
  `events.insert_many` already tells us which ones were new; a check driven by
  the request body would congratulate a child once per retry.
* **It counts the server's copy.** The events that just landed are not the
  day's total — a tablet that was offline all afternoon sends six rounds in one
  batch, and five of them may already be here. The trigger is the count in the
  collection crossing the goal, which is true exactly once however the rounds
  arrived.

The goal itself is the family's own, read from the synced `goals` document a
parent sets on their own device. Not `profile_stats`: those figures are reported
by whichever device last played, and a notification should stand on the number a
parent chose rather than on a number a client sent.
"""

import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repos import docs, push_runs
from app.repos import events as events_repo
from app.repos import learners as learners_repo
from app.services import push

log = logging.getLogger("koda.push")

GOAL_MET = "learn.goal_met"

#: What a learner is aiming for until a parent says otherwise. The client's
#: `DAILY_GOAL_DEFAULT`, and it has to be the same number: a parent who never
#: opened the goal picker still sees a ring fill up at five on the child's
#: screen, and a notification that disagreed with it would be about nothing the
#: family can see.
DEFAULT_GOAL = 5


def days_touched(inserted: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """The (learner, local day) pairs a batch of new events actually finished.

    Pairs rather than learners, because one push can carry two days: a device
    that was offline overnight sends yesterday evening and this morning in the
    same batch, and both are days a goal could have been met on.
    """
    pairs = {
        (event["learnerId"], event["localDay"])
        for event in inserted
        if event.get("type") == events_repo.COMPLETED
        and event.get("learnerId")
        and event.get("localDay")
    }
    return sorted(pairs)


async def _goal_for(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> int:
    doc = await docs.get(db, family_id, "goals", learner_id)
    value = (doc or {}).get("body", {}).get("dailyGoal")
    try:
        goal = int(value)
    except (TypeError, ValueError):
        return DEFAULT_GOAL
    # The client clamps to 1..20 before it writes; this clamps again because a
    # goal of zero would make every sync a congratulation.
    return min(20, max(1, goal))


async def goals_reached(
    db: AsyncIOMotorDatabase, family_id: str, inserted: list[dict[str, Any]]
) -> int:
    """Tell a parent about every goal these events completed. Returns how many.

    Runs after the response, so the child's device is never waiting on it.
    """
    try:
        pairs = days_touched(inserted)
        if not pairs:
            return 0

        if not await push.deployment_allows(db, GOAL_MET):
            return 0

        told = 0
        for learner_id, local_day in pairs:
            goal = await _goal_for(db, family_id, learner_id)
            if await events_repo.completed_on(db, family_id, learner_id, local_day) < goal:
                continue

            # Claimed per learner per *their* day, which is what makes tomorrow
            # a fresh goal and today a single congratulation however many extra
            # rounds are played after it.
            if not await push_runs.claim(
                db, kind=GOAL_MET, recipient_id=learner_id, date_key=local_day
            ):
                continue

            learner = await learners_repo.by_id(db, learner_id, family_id)
            if learner is None:
                # A round belonging to a child who has since been removed. The
                # claim stays taken: there is nothing to send and nothing that
                # a later attempt would find either.
                continue

            title, body = await push.wording(
                db,
                GOAL_MET,
                {
                    "learner": learner.get("displayName", "Your child"),
                    "rounds": goal,
                    "skill": _skill_of(inserted, learner_id, local_day),
                },
            )
            await push.send(
                db,
                to=push.Recipient(family_id=family_id),
                kind=GOAL_MET,
                title=title,
                body=body,
                tag=f"goal:{learner_id}:{local_day}",
            )
            told += 1
        return told
    except Exception:  # noqa: BLE001 — a missed congratulation is not an error
        log.exception("could not check the daily goal for family %s", family_id)
        return 0


def _skill_of(inserted: list[dict[str, Any]], learner_id: str, local_day: str) -> str:
    """What to call the practice, for the one placeholder the wording has.

    The last skill in the batch rather than the most-practised of the day: it is
    the one the child has this second finished, which is what a parent glancing
    at a phone will recognise. An empty batch of names is possible — a round can
    belong to no skill — and "Koda" is a truer filler than a guess.
    """
    named = [
        event.get("skillId")
        for event in inserted
        if event.get("learnerId") == learner_id
        and event.get("localDay") == local_day
        and event.get("skillId")
    ]
    return str(named[-1]).replace("-", " ").title() if named else "Koda"
