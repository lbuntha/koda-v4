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
