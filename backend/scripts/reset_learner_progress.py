"""Clear the play history XP and streak are derived from, keeping the learner playable.

Demo and development play leaves events behind that make XP and streaks meaningless — a
learner with 782 XP and every badge earned, accumulated across seed fixtures and releases that
no longer represent anything. That is not a bug to fix in code; it is data to clear before
testing.

Deliberately narrower than `purge_learning_data`, which also removes assignments, placements
and progressions. Those are what make a learner *playable*, and deleting them means re-seeding
before anyone can test. Only the derived history goes:

    LearningEvent      the source of both XP and streaks
    MasteryState       a projection of those events
    StudentSession     what the streak counts days from
    RecommendationRun  stale queues referencing deleted events

Assignments, placements and progressions are kept, so a learner is ready to play the moment
this finishes.

    docker compose exec api python scripts/reset_learner_progress.py                  # preview all
    docker compose exec api python scripts/reset_learner_progress.py --apply          # clear all
    docker compose exec api python scripts/reset_learner_progress.py Jutta --apply    # one learner
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import init_db  # noqa: E402
from app.features.progression.service import build_progress  # noqa: E402
from app.models.event import LearningEvent  # noqa: E402
from app.models.mastery import MasteryState  # noqa: E402
from app.models.recommendation import RecommendationRun, StudentSession  # noqa: E402
from app.models.student import Student  # noqa: E402

DERIVED = [
    ("events", LearningEvent),
    ("mastery", MasteryState),
    ("sessions", StudentSession),
    ("recommendations", RecommendationRun),
]


async def snapshot(student_id: str) -> str:
    progress = await build_progress(student_id)
    profile = progress["rewardProfile"]
    level = (profile.get("level") or {}).get("number")
    earned = sum(1 for row in profile["achievements"] if row["earned"])
    return f"xp={profile['totalXp']:<5} level={level!s:<5} badges={earned}/{len(profile['achievements'])}"


async def main(names: list[str], apply: bool) -> None:
    await init_db()
    students = await Student.find_all().to_list()
    if names:
        students = [s for s in students if s.name in names]
        missing = set(names) - {s.name for s in students}
        for name in sorted(missing):
            print(f"not found: {name}")

    for student in students:
        student_id = str(student.id)
        counts = {
            label: await model.find(model.student_id == student_id).count()
            for label, model in DERIVED
        }
        if not any(counts.values()):
            print(f"{student.name:<16} already clean")
            continue

        before = await snapshot(student_id)
        detail = "  ".join(f"{label}={count}" for label, count in counts.items() if count)
        if not apply:
            print(f"{student.name:<16} {before}   would clear: {detail}")
            continue

        for _, model in DERIVED:
            await model.find(model.student_id == student_id).delete()
        after = await snapshot(student_id)
        print(f"{student.name:<16} {before}  ->  {after}   cleared: {detail}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--apply"]
    asyncio.run(main(args, "--apply" in sys.argv))
