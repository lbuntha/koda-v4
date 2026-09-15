"""Judging a concept on the server, the way the app judges it.

`src/lib/learning/mastery.ts` says it plainly: "A second implementation of these
thresholds, anywhere, is how the app and a parent come to disagree about the same
child." This is that second implementation, and it exists because a notification
has to be decided where the events land — a parent's phone cannot wait for a
child's tablet to open the report.

So it is kept honest by a fixture rather than by care: every case in
`tests/fixtures/mastery_cases.json` is asserted against this function *and*
against `masteryFrom` in `masteryParity.test.ts`. Change a threshold in one and
the other side's test fails.

The totals it reads are `concept_totals` rows, which `services/rollup.py` folds
exactly the way the client's log does.
"""

from functools import lru_cache
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repos import rollups
from app.skill_defaults import load_defaults as load_skill_defaults

#: Below this many first attempts, any accuracy figure is noise.
MIN_EVIDENCE = 8
#: Unaided first-try accuracy needed to call a concept mastered.
MASTERY_ACCURACY = 0.85
#: Practise on at least this many separate days before claiming mastery.
MASTERY_DAYS = 2
#: Below this, the child is not making progress and needs a different approach.
STRUGGLING_ACCURACY = 0.5


def _count(totals: dict[str, Any], key: str) -> int:
    try:
        return int(totals.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def status_of(totals: dict[str, Any] | None) -> str:
    """`masteryFrom(...).status`, from a `concept_totals` row. None is not started."""
    if not totals:
        return "not-started"
    answered = _count(totals, "questionsAnswered")
    if answered == 0:
        return "not-started"
    if answered < MIN_EVIDENCE:
        return "struggling" if _count(totals, "lessonsAbandoned") >= 2 else "learning"
    accuracy = _count(totals, "correctFirstTry") / answered
    if accuracy < STRUGGLING_ACCURACY:
        return "struggling"
    if (
        accuracy >= MASTERY_ACCURACY
        and _count(totals, "lessonsCompleted") >= 1
        and len(totals.get("practisedOn") or []) >= MASTERY_DAYS
    ):
        return "mastered"
    return "practising"


@lru_cache(maxsize=1)
def _lesson_names() -> dict[str, str]:
    names: dict[str, str] = {}
    for skill in load_skill_defaults():
        for lesson in skill.get("lessons") or []:
            key = lesson.get("conceptKey")
            if key and key not in names:
                names[key] = lesson.get("title") or key
    return names


def lesson_name(concept_key: str) -> str:
    """The lesson that teaches a concept, as a parent reads it — the report's own
    rule (`conceptNames` in `ChildReportPage.tsx`), from the bundled skills."""
    return _lesson_names().get(concept_key) or concept_key.replace("-", " ").replace(".", " ").title()


def join_names(names: list[str]) -> str:
    """"A", "A and B", "A, B and C" — each name once, in the order given."""
    unique = list(dict.fromkeys(name for name in names if name))
    if len(unique) <= 1:
        return "".join(unique)
    return f"{', '.join(unique[:-1])} and {unique[-1]}"


async def next_step(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> str | None:
    """The lesson closest to secure: practising, with the best first-try accuracy.

    The report's "best use of the next session", said as one lesson name.
    """
    practising = [
        row for row in await rollups.for_learner(db, family_id, learner_id) if status_of(row) == "practising"
    ]
    if not practising:
        return None
    best = max(
        practising,
        key=lambda row: (
            _count(row, "correctFirstTry") / max(1, _count(row, "questionsAnswered")),
            str(row.get("lastSeenTs") or ""),
        ),
    )
    return lesson_name(best["conceptKey"])
