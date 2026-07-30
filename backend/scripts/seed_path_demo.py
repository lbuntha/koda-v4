"""Stage one student so the curriculum road shows every status at once.

Two halves:

1. Grow the Grade 1 curriculum into something with a real shape — several units, several
   skills each, chained by prerequisites — and clone existing questions onto the new skills
   so they are genuinely playable rather than dead entries.
2. Give ONE student mastery rows chosen so the walk produces `completed`, `overdue`,
   `in_progress`, `new` and `pending` together.

Everything is written through the normal models, so the result is ordinary data: the release
is cut by the real publisher, and the mastery rows are the same shape the scoring engine
writes. Re-running is safe — skills and questions are keyed by id and upserted.

    docker exec koda-v4-api-1 python -m scripts.seed_path_demo --dry-run
    docker exec koda-v4-api-1 python -m scripts.seed_path_demo --student TestKid
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta, timezone

from app.core.db import init_db
from app.models.assignment import Assignment
from app.models.content import Curriculum, QuestionDeck
from app.models.mastery import MasteryState
from app.models.student import Student
from app.models.user import User

CURRICULUM_ID = "seed-grade1-phase1"

#: (skill id, label, unit, order-in-unit, prerequisite, skill to clone questions from)
NEW_SKILLS = [
    ("demo-g1-count-20", "Count to 20", "seed-g1-unit-counting", 3,
     "seed-g1-skill-subitize", "seed-g1-skill-count"),
    ("demo-g1-compare", "Compare two numbers", "seed-g1-unit-counting", 4,
     "demo-g1-count-20", "seed-g1-skill-count"),
    ("demo-g1-add-20", "Add within 20", "seed-g1-unit-addition", 2,
     "seed-g1-skill-add", "seed-g1-skill-add"),
    ("demo-g1-add-three", "Add three numbers", "seed-g1-unit-addition", 3,
     "demo-g1-add-20", "seed-g1-skill-add"),
    ("demo-g1-sub-20", "Take away within 20", "seed-g1-unit-subtraction", 2,
     "seed-g1-skill-subtract", "seed-g1-skill-subtract"),
]

#: Existing skills get an explicit order within their unit, so the road reads in sequence.
UNIT_ORDER = {
    "seed-g1-skill-count": 1,
    "seed-g1-skill-subitize": 2,
    "seed-g1-skill-add": 1,
    "seed-g1-skill-subtract": 1,
}

#: The staged learner. Each entry becomes one MasteryState; everything else stays untouched,
#: so `new` and `pending` fall out of the prerequisite rules rather than being written down.
STAGED = [
    # skill id,                level,        due?,   score
    ("seed-g1-skill-count",    "master",     False,  0.95),  # -> completed
    ("seed-g1-skill-subitize", "beginner",   True,   0.42),  # -> overdue
    ("demo-g1-count-20",       "developing", False,  0.71),  # -> in_progress
]


def grow_curriculum(tree: dict) -> tuple[int, int]:
    """Add the demo skills and set within-unit ordering. Returns (added, reordered)."""
    by_id = {skill.get("id"): skill for skill in tree["skills"]}
    added = 0
    for skill_id, label, unit_id, order, prerequisite, _source in NEW_SKILLS:
        if skill_id in by_id:
            continue
        tree["skills"].append({
            "id": skill_id,
            "unitId": unit_id,
            "label": label,
            "order": order,
            "minQuestions": 2,
            "prerequisiteSkillIds": [prerequisite],
            "placementCheckpoint": False,
            "presentation": {"title": label, "estimatedMinutes": 4, "accent": "blue"},
        })
        added += 1
    reordered = 0
    for skill in tree["skills"]:
        wanted = UNIT_ORDER.get(skill.get("id"))
        if wanted is not None and skill.get("order") != wanted:
            skill["order"] = wanted
            reordered += 1
    return added, reordered


def clone_questions(questions: list[dict]) -> int:
    """Give each new skill playable questions by copying a sibling skill's."""
    existing_ids = {q.get("id") for q in questions}
    added = 0
    for skill_id, _label, _unit, _order, _prereq, source in NEW_SKILLS:
        if any(q.get("skillId") == skill_id for q in questions):
            continue
        for index, source_question in enumerate([q for q in questions if q.get("skillId") == source][:2]):
            clone = dict(source_question)
            clone["id"] = f"{skill_id}-q{index + 1}"
            if clone["id"] in existing_ids:
                continue
            clone["skillId"] = skill_id
            clone["difficulty"] = "easy" if index == 0 else "medium"
            questions.append(clone)
            existing_ids.add(clone["id"])
            added += 1
    return added


async def main(student_name: str, dry_run: bool) -> None:
    await init_db()
    now = datetime.now(timezone.utc)

    doc = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
    if not doc:
        raise SystemExit(f"curriculum {CURRICULUM_ID!r} not found")
    student = await Student.find_one(Student.name == student_name)
    if not student:
        raise SystemExit(f"student {student_name!r} not found")

    added, reordered = grow_curriculum(doc.tree)
    deck = await QuestionDeck.find_one(QuestionDeck.owner_id == doc.owner_id)
    cloned = clone_questions(deck.questions) if deck else 0
    print(f"curriculum: +{added} skills, {reordered} reordered, +{cloned} questions")

    if dry_run:
        print("dry run — nothing written")
        return

    doc.revision += 1
    await doc.save()
    if deck and cloned:
        deck.revision += 1
        await deck.save()

    # Cut a release through the real publisher so manifests and hashes are built properly.
    from app.features.content.router import _publish_release
    owner = await User.get(doc.owner_id)
    release = await _publish_release(doc, owner)
    print(f"published rev {release.revision} ({release.release_id})")

    assignment = await Assignment.find_one(
        Assignment.student_id == str(student.id), Assignment.status == "active"
    )
    if not assignment:
        raise SystemExit(f"{student_name} has no active assignment; run seed_assignments first")
    assignment.release_id = release.release_id
    assignment.updated_at = now
    await assignment.save()
    print(f"{student_name} moved to rev {release.revision}")

    for skill_id, level, due, score in STAGED:
        row = await MasteryState.find_one(
            MasteryState.student_id == str(student.id),
            MasteryState.curriculum_id == CURRICULUM_ID,
            MasteryState.skill_id == skill_id,
        ) or MasteryState(
            student_id=str(student.id), curriculum_id=CURRICULUM_ID, skill_id=skill_id,
        )
        row.level = level
        row.highest_earned_level = level
        row.score = score
        row.recent_score = score
        row.plays = 8 if level == "master" else 4
        row.sessions = 3 if level == "master" else 2
        row.distinct_days = 3 if level == "master" else 1
        # `last_practiced_at` is an ISO string on the model; `next_review_at` is the datetime
        # the scheduler queries "due" off. Keeping them straight matters — the engine writes
        # them from different sources.
        row.last_practiced_at = (now - timedelta(days=2)).isoformat()
        row.last_successful_review_at = None if due else (now - timedelta(days=2)).isoformat()
        row.last_review_outcome = "unsuccessful" if due else "successful"
        row.next_review_at = now - timedelta(days=1) if due else now + timedelta(days=4)
        row.promoted_at = now - timedelta(days=1)
        row.updated_at = now
        await row.save()
        print(f"  staged {skill_id:<24} {level:<11} {'overdue' if due else 'not due'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student", default="TestKid")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.student, args.dry_run))
