"""Seed a compact Grade 2 Science curriculum and its Grade 1 promotion path.

The seed is intentionally small but complete: four units, four playable and
server-graded Flexible Canvas activities, an immutable release, and an active
Grade 2 Science offering. It does not assign the curriculum directly to a
learner; the parent-approved promotion flow creates that assignment. Re-running
the script is safe and does not reset learner progress.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.core.db import close_db, init_db
from app.features.content.release import build_release_payload
from app.models.academic import Grade, Subject
from app.models.assignment import CurriculumOffering
from app.models.content import Curriculum, CurriculumRelease, QuestionDeck
from app.models.user import User


CURRICULUM_ID = "seed-grade2-science"
RELEASE_ID = "seed-grade2-science-release-1"
RELEASE_REVISION = 1
GRADE_ID = "grade-2"
SUBJECT_ID = "grade-2-science"
GRADE_1_SUBJECT_ID = "grade-1-science"

SKILL_IDS = [
    "seed-g2-science-skill-animal-coverings",
    "seed-g2-science-skill-plant-life-cycle",
    "seed-g2-science-skill-material-properties",
    "seed-g2-science-skill-push-pull",
]
QUESTION_IDS = {skill_id.replace("skill", "q", 1) for skill_id in SKILL_IDS}


def now() -> datetime:
    return datetime.now(timezone.utc)


def science_tree() -> dict:
    units = [
        ("animals", "Animals and Adaptations", "Notice how body coverings help us classify animals.", "paw", "blue"),
        ("plants", "Plant Life Cycles", "Explore how plants change as they grow.", "leaf", "green"),
        ("materials", "Materials and Properties", "Compare how everyday materials behave around water.", "sparkles", "purple"),
        ("forces", "Forces and Motion", "Recognize pushes and pulls in everyday movement.", "brain", "amber"),
    ]
    skill_details = [
        ("Classify animals by body covering", "Animal Coverings", "Sort animals by fur, feathers, or scales."),
        ("Sequence the stages of a plant life cycle", "How Plants Grow", "Match each plant stage to the beginning or later part of its life cycle."),
        ("Compare absorbent and waterproof materials", "Materials and Water", "Sort materials by how they behave with water."),
        ("Distinguish pushes from pulls", "Push or Pull?", "Sort each everyday action as a push or a pull."),
    ]
    return {
        "title": "Grade 2 Science Explorers",
        "description": "Playful investigations of animals, plant life cycles, materials, and forces.",
        "version": "starter-1.0",
        "primaryGradeId": GRADE_ID,
        "primarySubjectId": SUBJECT_ID,
        "grades": [{"id": GRADE_ID, "label": "Grade 2", "order": 2}],
        "subjects": [{"id": SUBJECT_ID, "gradeId": GRADE_ID, "label": "Science", "order": 1}],
        "units": [
            {
                "id": f"seed-g2-science-unit-{key}",
                "subjectId": SUBJECT_ID,
                "label": label,
                "description": description,
                "presentation": {"icon": icon, "accent": accent},
                "order": index,
            }
            for index, (key, label, description, icon, accent) in enumerate(units, start=1)
        ],
        "skills": [
            {
                "id": skill_id,
                "unitId": f"seed-g2-science-unit-{units[index][0]}",
                "label": skill_details[index][0],
                "order": 1,
                "minQuestions": 1,
                "placementCheckpoint": index in {0, 2},
                "prerequisiteSkillIds": [] if index == 0 else [SKILL_IDS[index - 1]],
                "completionXp": 20,
                "presentation": {
                    "title": skill_details[index][1],
                    "description": skill_details[index][2],
                    "estimatedMinutes": 5,
                    "thumbnailUrl": "/assets/components/flexible-canvas.svg",
                    "accent": units[index][4],
                },
            }
            for index, skill_id in enumerate(SKILL_IDS)
        ],
        "rewards": {
            "quest": {"label": "Science explorer quest", "activitiesPerSession": 2},
            "xp": {"correctAnswer": 5, "firstTryBonus": 2, "activityCompletion": 20},
            "level": {"xpPerLevel": 120},
            "achievements": [],
        },
    }


def _question(
    *,
    skill_id: str,
    title: str,
    instruction: str,
    background: str,
    items: list[tuple[str, str, str]],
    targets: list[tuple[str, str]],
) -> dict:
    return {
        "id": skill_id.replace("skill", "q", 1),
        "curriculumId": CURRICULUM_ID,
        "title": title,
        "instruction": instruction,
        "technique": "FLEXIBLE_CANVAS",
        "skillId": skill_id,
        "difficulty": "medium",
        "objectId": "science",
        "targetCount": len(items),
        "config": {
            "flexibleMode": "dragmatch",
            "flexibleBgStyle": background,
            "flexibleItems": [
                {
                    "id": item_id,
                    "emoji": emoji,
                    "x": 24 + index * 68,
                    "y": 30,
                    "targetBin": target_bin,
                }
                for index, (item_id, emoji, target_bin) in enumerate(items)
            ],
            "flexibleTargets": [
                {
                    "id": target_id,
                    "label": label,
                    "x": 18 + index * (424 // len(targets)),
                    "y": 180,
                    "width": (406 // len(targets)),
                    "height": 100,
                }
                for index, (target_id, label) in enumerate(targets)
            ],
        },
    }


def science_questions() -> list[dict]:
    return [
        _question(
            skill_id=SKILL_IDS[0],
            title="Animal Coverings",
            instruction="Sort every animal by its body covering.",
            background="sky",
            items=[
                ("covering-dog", "🐶", "covering-fur"),
                ("covering-bear", "🐻", "covering-fur"),
                ("covering-owl", "🦉", "covering-feathers"),
                ("covering-chicken", "🐔", "covering-feathers"),
                ("covering-fish", "🐟", "covering-scales"),
                ("covering-snake", "🐍", "covering-scales"),
            ],
            targets=[("covering-fur", "🐻 Fur"), ("covering-feathers", "🪶 Feathers"), ("covering-scales", "🐟 Scales")],
        ),
        _question(
            skill_id=SKILL_IDS[1],
            title="How Plants Grow",
            instruction="Sort each picture into an early or later plant stage.",
            background="meadow",
            items=[
                ("plant-seed", "🫘", "plant-early"),
                ("plant-sprout", "🌱", "plant-early"),
                ("plant-seedling", "🪴", "plant-early"),
                ("plant-flower", "🌻", "plant-later"),
                ("plant-fruit", "🍎", "plant-later"),
                ("plant-tree", "🌳", "plant-later"),
            ],
            targets=[("plant-early", "🌱 Early stages"), ("plant-later", "🌻 Later stages")],
        ),
        _question(
            skill_id=SKILL_IDS[2],
            title="Materials and Water",
            instruction="Sort what absorbs water and what keeps water out.",
            background="sky",
            items=[
                ("material-sponge", "🧽", "material-absorbs"),
                ("material-towel", "🧻", "material-absorbs"),
                ("material-paper", "📄", "material-absorbs"),
                ("material-umbrella", "☂️", "material-waterproof"),
                ("material-boot", "🥾", "material-waterproof"),
                ("material-raincoat", "🧥", "material-waterproof"),
            ],
            targets=[("material-absorbs", "💧 Absorbs water"), ("material-waterproof", "☔ Keeps water out")],
        ),
        _question(
            skill_id=SKILL_IDS[3],
            title="Push or Pull?",
            instruction="Sort each action as a push or a pull.",
            background="classroom",
            items=[
                ("force-cart", "🛒", "force-push"),
                ("force-ball", "⚽", "force-push"),
                ("force-door", "🚪", "force-push"),
                ("force-wagon", "🛷", "force-pull"),
                ("force-rope", "🪢", "force-pull"),
                ("force-suitcase", "🧳", "force-pull"),
            ],
            targets=[("force-push", "👉 Push"), ("force-pull", "👈 Pull")],
        ),
    ]


async def _owner_id() -> str:
    grade_one_science = await Subject.find_one(Subject.key == GRADE_1_SUBJECT_ID)
    if grade_one_science:
        return grade_one_science.created_by
    admin = await User.find_one(User.role == "admin")
    if not admin:
        raise SystemExit("Create or seed an admin account before seeding Grade 2 Science")
    return str(admin.id)


async def _ensure_catalog(owner_id: str) -> Subject:
    grade = await Grade.find_one(Grade.key == GRADE_ID)
    if not grade:
        grade = Grade(
            key=GRADE_ID,
            code="G2",
            name="Grade 2",
            description="Developing independence through connected ideas and guided practice.",
            age_range="7–8 years",
            order=2,
            layout_band="kid",
            created_by=owner_id,
            updated_by=owner_id,
        )
        await grade.insert()

    subject = await Subject.find_one(Subject.key == SUBJECT_ID)
    if not subject:
        subject = Subject(
            key=SUBJECT_ID,
            grade_id=GRADE_ID,
            code="SCI",
            name="Science",
            description="Animals, plants, materials, forces, and observation skills for Grade 2.",
            icon="FlaskConical",
            color="#10B981",
            order=2,
            created_by=owner_id,
            updated_by=owner_id,
        )
        await subject.insert()
    return subject


async def main() -> None:
    await init_db()
    try:
        owner_id = await _owner_id()
        subject = await _ensure_catalog(owner_id)
        owner_id = subject.created_by
        tree = science_tree()
        questions = science_questions()

        draft = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
        if draft:
            draft.tree = tree
            draft.published = True
            draft.revision += 1
            draft.updated_at = now()
            await draft.save()
        else:
            await Curriculum(
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                tree=tree,
                revision=1,
                published=True,
            ).insert()

        deck = await QuestionDeck.find_one(QuestionDeck.owner_id == owner_id)
        if deck:
            deck.questions = [item for item in deck.questions if item.get("id") not in QUESTION_IDS] + questions
            deck.revision += 1
            deck.updated_at = now()
            await deck.save()
        else:
            await QuestionDeck(owner_id=owner_id, questions=questions, revision=1).insert()

        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == RELEASE_ID)
        if not release:
            payload = build_release_payload(tree=tree, questions=questions, assets=[])
            await CurriculumRelease(
                release_id=RELEASE_ID,
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                revision=RELEASE_REVISION,
                published_by=owner_id,
                **payload,
            ).insert()

        offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == GRADE_ID,
            CurriculumOffering.subject_id == SUBJECT_ID,
        )
        if offering:
            changed = (
                offering.curriculum_id != CURRICULUM_ID
                or offering.release_id != RELEASE_ID
                or not offering.active
            )
            if changed:
                offering.curriculum_id = CURRICULUM_ID
                offering.release_id = RELEASE_ID
                offering.active = True
                offering.revision += 1
                offering.updated_by = owner_id
                offering.updated_at = now()
                await offering.save()
        else:
            await CurriculumOffering(
                grade_id=GRADE_ID,
                subject_id=SUBJECT_ID,
                curriculum_id=CURRICULUM_ID,
                release_id=RELEASE_ID,
                created_by=owner_id,
                updated_by=owner_id,
            ).insert()

        grade_one_offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == "grade-1",
            CurriculumOffering.subject_id == GRADE_1_SUBJECT_ID,
        )
        linked = False
        if grade_one_offering and not (
            grade_one_offering.successor_grade_id or grade_one_offering.successor_subject_id
        ):
            grade_one_offering.successor_grade_id = GRADE_ID
            grade_one_offering.successor_subject_id = SUBJECT_ID
            grade_one_offering.promotion_placement_required = True
            grade_one_offering.revision += 1
            grade_one_offering.updated_by = owner_id
            grade_one_offering.updated_at = now()
            await grade_one_offering.save()
            linked = True

        print({
            "curriculum": CURRICULUM_ID,
            "release": RELEASE_ID,
            "offering": f"{GRADE_ID}/{SUBJECT_ID}",
            "grade1PromotionLinked": linked or bool(
                grade_one_offering
                and grade_one_offering.successor_grade_id == GRADE_ID
                and grade_one_offering.successor_subject_id == SUBJECT_ID
            ),
            "units": len(tree["units"]),
            "skills": len(tree["skills"]),
            "questions": len(questions),
        })
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
