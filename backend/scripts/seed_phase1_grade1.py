"""Seed a small, repeatable Grade 1 fixture for local Phase 1 testing.

The fixture is intentionally isolated from authored content:

* it uses a stable ``seed-*`` curriculum/release id;
* it appends only stable ``seed-*`` questions to the owner's question deck;
* it reuses an existing local student instead of creating a student account;
* rerunning this script is safe and does not mutate an immutable release.

Run inside the API container with:
    python scripts/seed_phase1_grade1.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ``docker compose exec api python scripts/...`` may set the container working
# directory to a service-specific path. Make imports reliable in both Docker
# and local virtualenv runs.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.audit import record_audit
from app.core.db import close_db, init_db
from app.features.content.release import build_release_payload
from app.models.assignment import Assignment
from app.models.content import Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary
from app.models.student import Student
from app.models.user import User


OWNER_EMAIL = os.getenv("SEED_OWNER_EMAIL", "lbuntha@gmail.com")
CURRICULUM_ID = "seed-grade1-phase1"
RELEASE_ID = "seed-grade1-phase1-release-1"
STUDENT_ID = os.getenv("SEED_STUDENT_ID")


def now() -> datetime:
    return datetime.now(timezone.utc)


def fixture_tree() -> dict:
    return {
        "title": "Grade 1 Placement Test Fixture",
        "description": "LOCAL TEST FIXTURE — archive after Phase 1 verification.",
        "version": "test-1.0",
        "primaryGradeId": "grade-1",
        "primarySubjectId": "grade-1-math",
        "grades": [{"id": "grade-1", "order": 1}],
        "subjects": [{"id": "grade-1-math", "gradeId": "grade-1", "order": 1}],
        "units": [{"id": "seed-g1-unit-counting", "subjectId": "grade-1-math", "order": 1}],
        "skills": [
            {
                "id": "seed-g1-skill-count",
                "unitId": "seed-g1-unit-counting",
                "label": "Count to 10",
                "order": 1,
                "placementCheckpoint": True,
            },
            {
                "id": "seed-g1-skill-add",
                "unitId": "seed-g1-unit-counting",
                "label": "Add within 10",
                "order": 2,
                "placementCheckpoint": True,
                "prerequisiteSkillIds": ["seed-g1-skill-count"],
            },
        ],
    }


def fixture_questions() -> list[dict]:
    return [
        {
            "id": "seed-g1-q-count-easy",
            "title": "Count the objects",
            "technique": "ONE_TO_ONE",
            "skillId": "seed-g1-skill-count",
            "difficulty": "easy",
            "targetCount": 5,
            "config": {"object": "apple"},
        },
        {
            "id": "seed-g1-q-count-hard",
            "title": "Count the objects carefully",
            "technique": "ONE_TO_ONE",
            "skillId": "seed-g1-skill-count",
            "difficulty": "hard",
            "targetCount": 8,
            "config": {"object": "star"},
        },
        {
            "id": "seed-g1-q-add-medium",
            "title": "Add within 10",
            "technique": "ADDITION_COLUMN",
            "skillId": "seed-g1-skill-add",
            "difficulty": "medium",
            "config": {"num1": 3, "num2": 4},
        },
        {
            "id": "seed-g1-q-add-hard",
            "title": "Add within 10 with a new pair",
            "technique": "ADDITION_COLUMN",
            "skillId": "seed-g1-skill-add",
            "difficulty": "hard",
            "config": {"num1": 6, "num2": 3},
        },
    ]


async def main() -> None:
    await init_db()
    try:
        owner = await User.find_one(User.email == OWNER_EMAIL)
        if not owner:
            raise RuntimeError(f"Owner account {OWNER_EMAIL!r} was not found")

        if STUDENT_ID:
            student = await Student.get(STUDENT_ID)
        else:
            student = await Student.find_all().sort("+created_at").first_or_none()
        if not student:
            raise RuntimeError("No local student exists; create one before seeding the fixture")

        owner_id = str(owner.id)
        student_id = str(student.id)
        tree = fixture_tree()
        questions = fixture_questions()

        curriculum = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
        if not curriculum:
            curriculum = Curriculum(
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                tree=tree,
                revision=1,
                published=True,
            )
            await curriculum.insert()
            await record_audit(
                actor=owner,
                owner_id=owner_id,
                resource_type="curriculum",
                action="seeded_test_fixture",
                curriculum_id=CURRICULUM_ID,
                revision=1,
                reason="Local Phase 1 Grade 1 verification fixture",
                summary={"title": tree["title"], "fixture": True},
            )
        else:
            # Keep the draft visibly aligned with this deterministic fixture,
            # without changing any published release.
            if curriculum.tree != tree or curriculum.owner_id != owner_id:
                curriculum.tree = tree
                curriculum.owner_id = owner_id
                curriculum.published = True
                curriculum.revision = max(curriculum.revision, 1)
                curriculum.updated_at = now()
                await curriculum.save()

        deck = await QuestionDeck.find_one(QuestionDeck.owner_id == owner_id)
        if not deck:
            deck = QuestionDeck(owner_id=owner_id, questions=[], revision=0)
        existing = [q for q in deck.questions if not str(q.get("id", "")).startswith("seed-g1-")]
        deck.questions = existing + questions
        deck.revision += 1
        deck.updated_at = now()
        await deck.save()

        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == RELEASE_ID)
        release_created = False
        if not release:
            svg_library = await SvgLibrary.find_one(SvgLibrary.owner_id == owner_id)
            payload = build_release_payload(
                tree=tree,
                questions=deck.questions,
                assets=(svg_library.assets if svg_library else []),
            )
            release = CurriculumRelease(
                release_id=RELEASE_ID,
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                revision=1,
                published_by=owner_id,
                **payload,
            )
            await release.insert()
            release_created = True
            await record_audit(
                actor=owner,
                owner_id=owner_id,
                resource_type="curriculum_release",
                action="published_test_fixture",
                curriculum_id=CURRICULUM_ID,
                revision=1,
                reason="Local Phase 1 Grade 1 verification fixture",
                summary={"releaseId": RELEASE_ID, "questionCount": len(release.question_manifest), "fixture": True},
            )

        assignment = await Assignment.find_one(
            Assignment.student_id == student_id,
            Assignment.release_id == RELEASE_ID,
            Assignment.status == "active",
        )
        assignment_created = False
        if not assignment:
            assignment = Assignment(
                owner_id=owner_id,
                student_id=student_id,
                curriculum_id=CURRICULUM_ID,
                release_id=RELEASE_ID,
                grade_id="grade-1",
                scope={"kind": "all", "ids": []},
                mode="self_paced",
                priority=100,
                placement_required=True,
                status="active",
            )
            await assignment.insert()
            assignment_created = True
            await record_audit(
                actor=owner,
                owner_id=owner_id,
                resource_type="assignment",
                action="seeded_test_fixture",
                curriculum_id=CURRICULUM_ID,
                reason="Local Phase 1 Grade 1 verification fixture",
                summary={"assignmentId": str(assignment.id), "studentId": student_id, "fixture": True},
            )

        print(json.dumps({
            "fixture": True,
            "ownerEmail": OWNER_EMAIL,
            "student": {"id": student_id, "name": student.name},
            "curriculumId": CURRICULUM_ID,
            "releaseId": RELEASE_ID,
            "releaseCreated": release_created,
            "assignmentId": str(assignment.id),
            "assignmentCreated": assignment_created,
            "questionIds": [entry["question_id"] for entry in release.question_manifest],
            "questionCount": len(release.question_manifest),
        }, indent=2))
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
