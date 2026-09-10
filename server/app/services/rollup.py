"""Events → per-concept totals.

The one rule worth stating: this reads the fields a skill *reported* and adds
them up. It never recomputes what the client already derived — accuracy, medians,
attempt numbers — because two implementations of "accuracy" is how counting and
addition end up disagreeing about the same child.
"""

from typing import Any

from app.models.events import LearningEvent


def increments_for(event: LearningEvent, *, family_id: str) -> dict[str, Any] | None:
    """What one event adds to its concept's totals, or None if it adds nothing."""
    # No concept, nothing to roll up into: a conversation held on the home page
    # is a real record, but it is not evidence about any one concept and must
    # not invent a bucket to land in.
    if not event.concept_key:
        return None

    inc: dict[str, int] = {}
    add: dict[str, list[str]] = {"skillIds": [event.skill_id] if event.skill_id else []}

    if event.type == "answer_submitted":
        # First attempts only — the client's rule, mirrored deliberately: a
        # retry of a question whose answer the child has just seen measures
        # memory rather than understanding, and counting it would inflate
        # mastery exactly where a child is struggling most. See the note above
        # `applyToProfile` in src/lib/learning/learningLog.ts. The two rollups
        # have to fold events the same way, or the app and the parent view will
        # quietly disagree about the same child.
        if (event.attempt or 1) == 1:
            inc["questionsAnswered"] = 1
            if event.response_ms:
                inc["totalResponseMs"] = int(event.response_ms)
            if event.correct and not (event.supports_used or 0):
                inc["correctFirstTry"] = 1

        # Errors count on every attempt: a second wrong answer is a second
        # wrong answer, and the pattern is what a recommendation reads.
        if not event.correct:
            inc[f"errors.{event.error_kind or 'unknown'}"] = 1

    elif event.type == "support_used":
        inc["supportsUsed"] = 1

    elif event.type == "lesson_completed":
        inc["lessonsCompleted"] = 1

    elif event.type == "lesson_abandoned":
        inc["lessonsAbandoned"] = 1

    elif event.type in ("lesson_started", "question_presented"):
        # They carry no totals, but they still prove the concept was practised
        # today — spacing matters more than volume for retention.
        pass

    if event.local_day:
        add["practisedOn"] = [event.local_day]

    return {
        "familyId": family_id,
        "learnerId": event.learner_id,
        "conceptKey": event.concept_key,
        "inc": inc,
        "add": add,
        # $max, so a batch arriving out of order cannot move "last seen" backwards.
        "set": {"lastSeenTs": event.ts},
    }


#: Counters a baseline carries, under the names `concept_totals` already uses.
BASELINE_COUNTERS = (
    "questionsAnswered",
    "correctFirstTry",
    "supportsUsed",
    "lessonsCompleted",
    "lessonsAbandoned",
    "totalResponseMs",
)


def baseline_increments(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
    *,
    family_id: str,
    learner_id: str,
) -> list[dict[str, Any]]:
    """What a `conceptBaseline` document adds to a learner's totals.

    A baseline is one device's account of work it could not send as events —
    an outbox that overflowed on a long journey, or a history older than the
    device's own event ring. The body is *cumulative*, so what it adds is the
    difference from the copy this server already had; re-sending an unchanged
    document therefore adds nothing, which is what makes a retry after a lost
    acknowledgement safe.

    A device only ever writes its own key (`learner:device`), so two tablets
    cannot read each other's running total as their own previous value. Falling
    counters are ignored rather than applied: a total can only go up, and a
    negative increment here would subtract another device's honest work.
    """
    previous_concepts = (previous or {}).get("concepts") or {}
    increments: list[dict[str, Any]] = []

    for concept_key, totals in (current.get("concepts") or {}).items():
        before = previous_concepts.get(concept_key) or {}

        inc: dict[str, int] = {}
        for field in BASELINE_COUNTERS:
            delta = int(totals.get(field, 0) or 0) - int(before.get(field, 0) or 0)
            if delta > 0:
                inc[field] = delta

        errors_before = before.get("errors") or {}
        for kind, count in (totals.get("errors") or {}).items():
            delta = int(count or 0) - int(errors_before.get(kind, 0) or 0)
            if delta > 0:
                inc[f"errors.{kind}"] = delta

        add = {
            "skillIds": list(totals.get("skillIds") or []),
            # Days are a set on both sides, so a day this device has already
            # reported through an event costs nothing to report again.
            "practisedOn": list(totals.get("practisedOn") or []),
        }
        add = {k: v for k, v in add.items() if v}

        if not inc and not add:
            continue

        item: dict[str, Any] = {
            "familyId": family_id,
            "learnerId": learner_id,
            "conceptKey": concept_key,
            "inc": inc,
            "add": add,
        }
        if totals.get("lastSeenTs"):
            item["set"] = {"lastSeenTs": totals["lastSeenTs"]}
        increments.append(item)

    return increments
