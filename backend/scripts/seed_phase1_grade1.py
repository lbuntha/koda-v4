"""Seed a small, repeatable Grade 1 fixture for end-to-end local testing.

The fixture is intentionally isolated from authored content:

* it uses a stable ``seed-*`` curriculum/release id;
* it appends only stable ``seed-*`` questions to the owner's question deck;
* it creates a dedicated parent + Grade 1 learner with stable demo credentials;
* it pins Grade 1 to the ``kid`` layout band;
* by default it resets only that demo learner's learning state;
* ``SEED_GRADE1_SCENARIO=missed`` completes placement and creates two overdue
  mastery states so the Kid home shows retry/review recommendations;
* rerunning this script is safe and does not mutate an immutable release.

Run in Docker with:
    make seed-grade1
    make seed-grade1-missed
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ``docker compose exec api python scripts/...`` may set the container working
# directory to a service-specific path. Make imports reliable in both Docker
# and local virtualenv runs.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.audit import record_audit
from app.core.db import close_db, init_db
from app.core.runtime_settings import get_system_settings
from app.core.security import hash_secret
from app.features.analytics.service import purge_learning_data
from app.features.content.release import build_release_payload
from app.features.progression.scoring import ENGINE_REVISION as SCORING_ENGINE_REVISION
from app.models.assignment import Assignment, CurriculumOffering, Placement, ProgressionState
from app.models.academic import Grade, Subject
from app.models.content import Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary
from app.models.event import LearningEvent
from app.models.mastery import MasteryState
from app.models.student import Student
from app.models.user import Role, User


OWNER_EMAIL = os.getenv("SEED_OWNER_EMAIL", "lbuntha@gmail.com")
PARENT_EMAIL = os.getenv("SEED_GRADE1_PARENT_EMAIL", "grade1.parent@example.com")
PARENT_PASSWORD = os.getenv("SEED_GRADE1_PARENT_PASSWORD", "Grade1Demo!2026")
PARENT_NAME = os.getenv("SEED_GRADE1_PARENT_NAME", "Grade 1 Demo Parent")
FAMILY_CODE = os.getenv("SEED_GRADE1_FAMILY_CODE", "G1DEMO")
STUDENT_NAME = os.getenv("SEED_GRADE1_STUDENT_NAME", "Grade 1 Learner")
STUDENT_PIN = os.getenv("SEED_GRADE1_STUDENT_PIN", "1111")
CURRICULUM_ID = "seed-grade1-phase1"
RELEASE_ID = "seed-grade1-phase1-release-9"
RESET_LEARNING = os.getenv("SEED_GRADE1_RESET", "1").lower() not in {"0", "false", "no"}
SCENARIO = os.getenv("SEED_GRADE1_SCENARIO", "fresh").strip().lower()

if SCENARIO not in {"fresh", "missed"}:
    raise RuntimeError("SEED_GRADE1_SCENARIO must be either 'fresh' or 'missed'")

LIBRARY_ASSET_ID = "seed-g1-svg-quick-look"

# Studio-shaped markup on purpose: authored SVGs are JSX-style fragments with no `xmlns`
# and `width/height="100%"`, which is exactly the case the student home has to render
# through `<img src="/api/learning/assets/...">`. Keeping the fixture honest here is what
# makes the namespace repair in features/learning/router.py testable end to end.
LIBRARY_ASSET_MARKUP = (
    '<svg width="100%" height="100%" viewBox="0 0 512 512">'
    '<circle cx="256" cy="256" r="150" fill="#EAF4FF" stroke="#8CC6FF" stroke-width="10"/>'
    '<circle cx="196" cy="196" r="34" fill="#4AA8F0"/>'
    '<circle cx="316" cy="196" r="34" fill="#FF9B4A"/>'
    '<circle cx="196" cy="316" r="34" fill="#55D6A7"/>'
    '<circle cx="316" cy="316" r="34" fill="#FFBF3E"/>'
    '<circle cx="256" cy="256" r="34" fill="#7964F5"/>'
    "</svg>"
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def fixture_tree() -> dict:
    return {
        "title": "Grade 1 Functional Test Fixture",
        "description": "LOCAL TEST FIXTURE — placement and recommendation coverage.",
        "version": "test-9.0",
        "primaryGradeId": "grade-1",
        "primarySubjectId": "grade-1-math",
        "grades": [{"id": "grade-1", "order": 1}],
        "subjects": [{"id": "grade-1-math", "gradeId": "grade-1", "label": "Maths", "order": 1}],
        "units": [
            {"id": "seed-g1-unit-counting", "subjectId": "grade-1-math", "label": "Counting & Number Sense", "order": 1},
            {"id": "seed-g1-unit-addition", "subjectId": "grade-1-math", "label": "Addition", "order": 2},
            {"id": "seed-g1-unit-subtraction", "subjectId": "grade-1-math", "label": "Subtraction", "order": 3},
        ],
        "rewards": {
            "quest": {"label": "Today’s number quest", "activitiesPerSession": 3},
            "xp": {"correctAnswer": 5, "firstTryBonus": 2, "activityCompletion": 10},
            "level": {"xpPerLevel": 100},
            "achievements": [
                {
                    "id": "star-award",
                    "label": "Star Award",
                    "description": "Get a correct answer on your first try.",
                    "metric": "firstTryCorrect",
                    "target": 1,
                    "icon": "star",
                    "accent": "purple",
                },
                {
                    "id": "math-champ",
                    "label": "Math Champ",
                    "description": "Reach Proficient in one skill.",
                    "metric": "proficientSkills",
                    "target": 1,
                    "icon": "medal",
                    "accent": "green",
                },
                {
                    "id": "first-win",
                    "label": "First Win",
                    "description": "Complete one practice activity.",
                    "metric": "lessonsCompleted",
                    "target": 1,
                    "icon": "award",
                    "accent": "amber",
                },
                {
                    "id": "practice-hero",
                    "label": "3 Wins",
                    "description": "Complete three practice activities.",
                    "metric": "lessonsCompleted",
                    "target": 3,
                    "icon": "trophy",
                    "accent": "pink",
                },
                {
                    "id": "skill-master",
                    "label": "Skill Master",
                    "description": "Master one curriculum skill.",
                    "metric": "masteredSkills",
                    "target": 1,
                    "icon": "trophy",
                    "accent": "purple",
                },
                {
                    "id": "gem-collector",
                    "label": "Gem Collector",
                    "description": "Earn 100 XP from practice.",
                    "metric": "xpEarned",
                    "target": 100,
                    "icon": "gem",
                    "accent": "blue",
                },
            ],
        },
        "skills": [
            {
                "id": "seed-g1-skill-count",
                "unitId": "seed-g1-unit-counting",
                "label": "Count to 10",
                "order": 1,
                "placementCheckpoint": True,
                "completionXp": 12,
                "presentation": {
                    "title": "Count to 10",
                    "description": "Count each object once and discover how many there are.",
                    "estimatedMinutes": 3,
                    "accent": "purple",
                },
            },
            {
                "id": "seed-g1-skill-subitize",
                "unitId": "seed-g1-unit-counting",
                "label": "See numbers quickly",
                "order": 2,
                "placementCheckpoint": True,
                "prerequisiteSkillIds": ["seed-g1-skill-count"],
                "presentation": {
                    "title": "Spot the number",
                    "description": "See a small group and tell how many without counting one by one.",
                    "estimatedMinutes": 2,
                    "thumbnailAssetId": LIBRARY_ASSET_ID,
                    "accent": "blue",
                },
            },
            {
                "id": "seed-g1-skill-add",
                "unitId": "seed-g1-unit-addition",
                "label": "Add within 10",
                "order": 3,
                "placementCheckpoint": True,
                "prerequisiteSkillIds": ["seed-g1-skill-subitize"],
                "presentation": {
                    "title": "Add within 10",
                    "description": "Put two groups together and find the total.",
                    "estimatedMinutes": 4,
                    "thumbnailUrl": "/assets/curriculum/count-to-10.svg",
                    "accent": "green",
                },
            },
            {
                "id": "seed-g1-skill-subtract",
                "unitId": "seed-g1-unit-subtraction",
                "label": "Take away within 10",
                "order": 4,
                "placementCheckpoint": True,
                "prerequisiteSkillIds": ["seed-g1-skill-add"],
                "presentation": {
                    "title": "Take away within 10",
                    "description": "Remove part of a group and find how many remain.",
                    "estimatedMinutes": 4,
                    "thumbnailUrl": "/assets/curriculum/subtraction-within-10.svg",
                    "accent": "amber",
                },
            },
        ],
    }


def fixture_questions() -> list[dict]:
    questions = [
        {
            "id": "seed-g1-q-count-easy",
            "title": "Move and count the apples",
            "instruction": "Move every apple to the other basket, then enter how many you moved.",
            "technique": "MOVE_AND_COUNT",
            "skillId": "seed-g1-skill-count",
            "difficulty": "easy",
            "objectId": "apple",
            "targetCount": 5,
            "config": {
                "requireAnswerInput": True,
                "sourceBinLabel": "Ready to move",
                "destinationBinLabel": "Counted",
            },
        },
        {
            "id": "seed-g1-q-count-hard",
            "title": "Move and count the stars",
            "instruction": "Move every star to the other basket, then enter how many you moved.",
            "technique": "MOVE_AND_COUNT",
            "skillId": "seed-g1-skill-count",
            "difficulty": "hard",
            "objectId": "star",
            "targetCount": 8,
            "config": {
                "requireAnswerInput": True,
                "sourceBinLabel": "Ready to move",
                "destinationBinLabel": "Counted",
            },
        },
        {
            "id": "seed-g1-q-subitize-easy",
            "title": "Quick look at the dots",
            "instruction": "Watch carefully. How many dots did you see?",
            "technique": "SUBITIZE",
            "skillId": "seed-g1-skill-subitize",
            "difficulty": "easy",
            "objectId": "blue_dot",
            "targetCount": 4,
            "config": {"pattern": "dice", "flashDurationMs": 1800},
        },
        {
            "id": "seed-g1-q-subitize-hard",
            "title": "Quick look at the stars",
            "instruction": "Watch carefully. How many stars did you see?",
            "technique": "SUBITIZE",
            "skillId": "seed-g1-skill-subitize",
            "difficulty": "hard",
            "objectId": "star",
            "targetCount": 6,
            "config": {"pattern": "pairs", "flashDurationMs": 1200},
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
        {
            "id": "seed-g1-q-subtract-easy",
            "title": "Take away within 10",
            "instruction": "Subtract the bottom number from the top number.",
            "technique": "SUBTRACTION_COLUMN",
            "skillId": "seed-g1-skill-subtract",
            "difficulty": "easy",
            "objectId": "apple",
            "targetCount": 3,
            "config": {"minuend": 7, "subtrahend": 4, "frameColor": "indigo"},
        },
        {
            "id": "seed-g1-q-subtract-hard",
            "title": "Take away with a new pair",
            "instruction": "Subtract the bottom number from the top number.",
            "technique": "SUBTRACTION_COLUMN",
            "skillId": "seed-g1-skill-subtract",
            "difficulty": "hard",
            "objectId": "star",
            "targetCount": 4,
            "config": {"minuend": 10, "subtrahend": 6, "frameColor": "purple"},
        },
    ]
    for question in questions:
        question["curriculumId"] = CURRICULUM_ID
    return questions



async def seed_learning_history(
    *,
    student_id: str,
    assignment: Assignment,
    days: int = 3,
) -> dict[str, int]:
    """Insert verified attempt + lesson_complete events across the last few days.

    XP, the day streak and the lessons-completed achievement are all derived from events, so
    the only honest way to demo them is to lay down the events and let the same aggregation
    run. Deterministic: reruns replace the seeded learner's data via purge_learning_data.
    """
    assignment_id = str(assignment.id)
    plan = [
        ("seed-g1-skill-count", "seed-g1-q-count-easy", "easy"),
        ("seed-g1-skill-subitize", "seed-g1-q-subitize-easy", "easy"),
        ("seed-g1-skill-count", "seed-g1-q-count-hard", "hard"),
    ]
    events: list[LearningEvent] = []
    lessons = 0
    for day_offset in range(days):
        day = now() - timedelta(days=day_offset)
        skill_id, question_id, difficulty = plan[day_offset % len(plan)]
        session_id = f"seed-session-{day_offset}"
        for attempt in range(2):
            events.append(LearningEvent(
                student_id=student_id,
                session_id=session_id,
                event_type="attempt",
                outcome="correct",
                attempt_number=1,
                hint_used_before_attempt=False,
                time_on_task_ms=9000,
                question_id=question_id,
                difficulty=difficulty,
                curriculum_skill_id=skill_id,
                curriculum_id=CURRICULUM_ID,
                release_id=RELEASE_ID,
                assignment_id=assignment_id,
                occurred_at=(day - timedelta(minutes=5 - attempt)).isoformat(),
                client_timestamp_ms=int((day - timedelta(minutes=5 - attempt)).timestamp() * 1000),
                verified=True,
            ))
        events.append(LearningEvent(
            student_id=student_id,
            session_id=session_id,
            event_type="lesson_complete",
            question_id=question_id,
            curriculum_skill_id=skill_id,
            curriculum_id=CURRICULUM_ID,
            release_id=RELEASE_ID,
            assignment_id=assignment_id,
            occurred_at=day.isoformat(),
            client_timestamp_ms=int(day.timestamp() * 1000),
            verified=True,
        ))
        lessons += 1
    for event in events:
        await event.insert()
    return {"events": len(events), "lessonsCompleted": lessons, "days": days}


async def seed_missed_recommendations(
    *,
    student_id: str,
    assignment: Assignment,
    scoring_revision: int,
) -> list[dict[str, str]]:
    """Create a completed placement plus deterministic overdue queue items."""
    seeded_at = now()
    due_at = seeded_at - timedelta(days=1)
    practiced_at = (seeded_at - timedelta(days=3)).isoformat()
    assignment_id = str(assignment.id)

    placement = Placement(
        student_id=student_id,
        assignment_id=assignment_id,
        grade_id="grade-1",
        curriculum_id=CURRICULUM_ID,
        release_id=RELEASE_ID,
        generator_revision=1,
        scoring_revision=scoring_revision,
        status="completed",
        item_manifest=[],
        responses=[],
        score_by_skill={
            "seed-g1-skill-count": 0.35,
            "seed-g1-skill-subitize": 0.75,
        },
        frontier_skill_id="seed-g1-skill-add",
        eligible_skill_ids=["seed-g1-skill-count", "seed-g1-skill-subitize"],
        completed_at=seeded_at,
    )
    await placement.insert()
    await ProgressionState(
        student_id=student_id,
        assignment_id=assignment_id,
        curriculum_id=CURRICULUM_ID,
        release_id=RELEASE_ID,
        frontier_skill_id="seed-g1-skill-add",
        eligible_skill_ids=["seed-g1-skill-count", "seed-g1-skill-subitize"],
        placement_id=str(placement.id),
        placement_status="completed",
        updated_at=seeded_at,
    ).insert()

    states = [
        MasteryState(
            student_id=student_id,
            skill_id="seed-g1-skill-count",
            curriculum_id=CURRICULUM_ID,
            level="beginner",
            score=0.35,
            plays=2,
            sessions=1,
            distinct_days=1,
            hard_plays=1,
            last_practiced_at=practiced_at,
            last_review_outcome="unsuccessful",
            recent_score=0.35,
            next_review_at=due_at,
            highest_earned_level="beginner",
            scoring_revision=scoring_revision,
            engine_revision=SCORING_ENGINE_REVISION,
            updated_at=seeded_at,
        ),
        MasteryState(
            student_id=student_id,
            skill_id="seed-g1-skill-subitize",
            curriculum_id=CURRICULUM_ID,
            level="developing",
            score=0.75,
            plays=5,
            sessions=2,
            distinct_days=2,
            hard_plays=2,
            last_practiced_at=practiced_at,
            last_successful_review_at=practiced_at,
            last_review_outcome="successful",
            recent_score=0.75,
            next_review_at=due_at,
            highest_earned_level="developing",
            scoring_revision=scoring_revision,
            engine_revision=SCORING_ENGINE_REVISION,
            updated_at=seeded_at,
        ),
    ]
    for state in states:
        await state.insert()
    return [
        {"skillId": "seed-g1-skill-count", "expectedKind": "reinforce"},
        {"skillId": "seed-g1-skill-subitize", "expectedKind": "review"},
        {"skillId": "seed-g1-skill-add", "expectedKind": "new"},
    ]


async def main() -> None:
    await init_db()
    try:
        owner = await User.find_one(User.email == OWNER_EMAIL)
        if not owner:
            raise RuntimeError(f"Owner account {OWNER_EMAIL!r} was not found")

        owner_id = str(owner.id)

        grade = await Grade.find_one(Grade.key == "grade-1")
        if not grade:
            grade = Grade(
                key="grade-1",
                code="G1",
                name="Grade 1",
                description="Foundational Grade 1 learning",
                age_range="6–7",
                order=1,
                layout_band="kid",
                active=True,
                created_by=owner_id,
                updated_by=owner_id,
            )
            await grade.insert()
        else:
            grade.name = "Grade 1"
            grade.order = 1
            grade.layout_band = "kid"
            grade.active = True
            grade.updated_by = owner_id
            grade.updated_at = now()
            await grade.save()

        subject = await Subject.find_one(Subject.key == "grade-1-math")
        if not subject:
            subject = Subject(
                key="grade-1-math",
                grade_id="grade-1",
                code="MATH",
                name="Mathematics",
                description="Grade 1 counting and addition",
                icon="Calculator",
                color="#6B57D8",
                order=1,
                active=True,
                created_by=owner_id,
                updated_by=owner_id,
            )
            await subject.insert()
        else:
            subject.grade_id = "grade-1"
            subject.name = "Mathematics"
            subject.active = True
            subject.updated_by = owner_id
            subject.updated_at = now()
            await subject.save()

        parent = await User.find_one(User.email == PARENT_EMAIL)
        if not parent:
            parent = User(
                role=Role.parent,
                email=PARENT_EMAIL,
                password_hash=hash_secret(PARENT_PASSWORD),
                name=PARENT_NAME,
                family_code=FAMILY_CODE,
            )
            await parent.insert()
        else:
            parent.role = Role.parent
            parent.password_hash = hash_secret(PARENT_PASSWORD)
            parent.name = PARENT_NAME
            parent.family_code = FAMILY_CODE
            parent.disabled_at = None
            await parent.save()

        parent_id = str(parent.id)
        student = await Student.find_one(
            Student.name == STUDENT_NAME,
            Student.guardian_parent_ids == parent_id,
        )
        if not student:
            student = Student(
                name=STUDENT_NAME,
                avatar="🦉",
                pin_hash=hash_secret(STUDENT_PIN),
                guardian_parent_ids=[parent_id],
                birth_year=datetime.now(timezone.utc).year - 6,
            )
            await student.insert()
        else:
            student.avatar = "🦉"
            student.pin_hash = hash_secret(STUDENT_PIN)
            student.guardian_parent_ids = [parent_id]
            await student.save()

        student_id = str(student.id)
        reset_counts = await purge_learning_data(student_id) if RESET_LEARNING else {}
        tree = fixture_tree()
        questions = fixture_questions()

        curriculum = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
        if not curriculum:
            curriculum = Curriculum(
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                tree=tree,
                revision=9,
                published=True,
            )
            await curriculum.insert()
            await record_audit(
                actor=owner,
                owner_id=owner_id,
                resource_type="curriculum",
                action="seeded_test_fixture",
                curriculum_id=CURRICULUM_ID,
                revision=9,
                reason="Local Grade 1 functional verification fixture",
                summary={"title": tree["title"], "fixture": True},
            )
        else:
            # Keep the draft visibly aligned with this deterministic fixture,
            # without changing any published release.
            if curriculum.tree != tree or curriculum.owner_id != owner_id:
                curriculum.tree = tree
                curriculum.owner_id = owner_id
                curriculum.published = True
                curriculum.revision = max(curriculum.revision, 9)
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

        # One stable seed-* SVG in the owner's library, mirroring how the deck is seeded.
        # A skill attaches it by id, so publishing carries a snapshot into the release and
        # the student home fetches it from /api/learning/assets/...
        svg_library = await SvgLibrary.find_one(SvgLibrary.owner_id == owner_id)
        if not svg_library:
            svg_library = SvgLibrary(owner_id=owner_id, assets=[], overrides={})
        library_asset = {
            "id": LIBRARY_ASSET_ID,
            "label": "Quick look dots (seed)",
            "markup": LIBRARY_ASSET_MARKUP,
            "scale": 1,
        }
        kept = [a for a in svg_library.assets if a.get("id") != LIBRARY_ASSET_ID]
        svg_library.assets = kept + [library_asset]
        svg_library.revision += 1
        svg_library.updated_at = now()
        await svg_library.save()

        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == RELEASE_ID)
        release_created = False
        if not release:
            payload = build_release_payload(
                tree=tree,
                questions=deck.questions,
                assets=svg_library.assets,
            )
            release = CurriculumRelease(
                release_id=RELEASE_ID,
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                revision=9,
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
                revision=9,
                reason="Local Grade 1 functional verification fixture",
                summary={"releaseId": RELEASE_ID, "questionCount": len(release.question_manifest), "fixture": True},
            )

        offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == "grade-1",
            CurriculumOffering.subject_id == "grade-1-math",
        )
        if not offering:
            await CurriculumOffering(
                grade_id="grade-1",
                subject_id="grade-1-math",
                curriculum_id=CURRICULUM_ID,
                release_id=RELEASE_ID,
                created_by=owner_id,
                updated_by=owner_id,
            ).insert()
        elif offering.release_id != RELEASE_ID or offering.curriculum_id != CURRICULUM_ID:
            offering.curriculum_id = CURRICULUM_ID
            offering.release_id = RELEASE_ID
            offering.active = True
            offering.revision += 1
            offering.updated_by = owner_id
            offering.updated_at = now()
            await offering.save()

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
                subject_id="grade-1-math",
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
                reason="Local Grade 1 functional verification fixture",
                summary={"assignmentId": str(assignment.id), "studentId": student_id, "fixture": True},
            )

        history = await seed_learning_history(student_id=student_id, assignment=assignment)

        recommendation_scenario: list[dict[str, str]] = []
        if SCENARIO == "missed":
            settings_doc = await get_system_settings()
            recommendation_scenario = await seed_missed_recommendations(
                student_id=student_id,
                assignment=assignment,
                scoring_revision=settings_doc.scoring_revision,
            )

        print(json.dumps({
            "fixture": True,
            "scenario": SCENARIO,
            "ownerEmail": OWNER_EMAIL,
            "parent": {
                "email": PARENT_EMAIL,
                "password": PARENT_PASSWORD,
                "familyCode": FAMILY_CODE,
            },
            "student": {
                "id": student_id,
                "name": student.name,
                "pin": STUDENT_PIN,
                "gradeBand": "kid",
            },
            "grade": {"id": "grade-1", "name": grade.name, "layoutBand": grade.layout_band},
            "curriculumId": CURRICULUM_ID,
            "releaseId": RELEASE_ID,
            "releaseCreated": release_created,
            "assignmentId": str(assignment.id),
            "assignmentCreated": assignment_created,
            "learningReset": RESET_LEARNING,
            "learningHistory": history,
            "resetCounts": reset_counts,
            "questionIds": [entry["question_id"] for entry in release.question_manifest],
            "questionCount": len(release.question_manifest),
            "recommendationScenario": recommendation_scenario,
        }, indent=2))
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
