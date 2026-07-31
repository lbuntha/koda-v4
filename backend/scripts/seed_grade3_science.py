"""Seed a compact Grade 3 Science curriculum and link Grade 2 Science to it.

Mirrors `seed_grade2_science.py`: four units, four playable and server-graded
Flexible Canvas activities, an immutable release, and an active Grade 3 Science
offering. Its purpose beyond content is to make the promotion path more than one
hop — grade 1 → grade 2 → grade 3 — so a learner finishing Grade 2 has somewhere
to go instead of reaching a terminal curriculum.

It does not assign anything to a learner; the parent-approved promotion flow does
that. Re-running is safe and never resets learner progress.
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

CURRICULUM_ID = "seed-grade3-science"
RELEASE_ID = "seed-grade3-science-release-1"
RELEASE_REVISION = 1
GRADE_ID = "grade-3"
SUBJECT_ID = "grade-3-science"
GRADE_2_GRADE_ID = "grade-2"
GRADE_2_SUBJECT_ID = "grade-2-science"

SKILL_IDS = [
    "seed-g3-science-skill-states-of-matter",
    "seed-g3-science-skill-backbones",
    "seed-g3-science-skill-food-chains",
    "seed-g3-science-skill-magnetism",
]
QUESTION_IDS = {skill_id.replace("skill", "q", 1) for skill_id in SKILL_IDS}


def now() -> datetime:
    return datetime.now(timezone.utc)


def science_tree() -> dict:
    units = [
        ("matter", "States of Matter", "Tell solids, liquids, and gases apart.", "sparkles", "blue"),
        ("animals", "Animal Classification", "Group animals by whether they have a backbone.", "paw", "green"),
        ("energy", "Food Chains", "Trace where the energy in a food chain begins.", "leaf", "amber"),
        ("forces", "Magnetism", "Predict which materials a magnet attracts.", "brain", "purple"),
    ]
    skill_details = [
        ("Classify materials as solid, liquid, or gas", "Solid, Liquid, Gas", "Sort everyday things by their state of matter."),
        ("Sort animals by vertebrate or invertebrate", "Backbone or Not?", "Group animals by whether they have a backbone."),
        ("Identify producers and consumers", "Who Makes Food?", "Sort living things into producers and consumers."),
        ("Predict magnetic and non-magnetic materials", "Will It Stick?", "Sort objects by whether a magnet attracts them."),
    ]
    return {
        "title": "Grade 3 Science Investigators",
        "description": "Classifying matter and living things, tracing energy, and testing forces.",
        "version": "starter-1.0",
        "primaryGradeId": GRADE_ID,
        "primarySubjectId": SUBJECT_ID,
        "grades": [{"id": GRADE_ID, "label": "Grade 3", "order": 3}],
        "subjects": [{"id": SUBJECT_ID, "gradeId": GRADE_ID, "label": "Science", "order": 1}],
        "units": [
            {
                "id": f"seed-g3-science-unit-{key}",
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
                "unitId": f"seed-g3-science-unit-{units[index][0]}",
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
            "quest": {"label": "Science investigator quest", "activitiesPerSession": 2},
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
            title="Solid, Liquid, Gas",
            instruction="Sort each thing by its state of matter.",
            background="classroom",
            items=[
                ("matter-rock", "🪨", "matter-solid"),
                ("matter-ice", "🧊", "matter-solid"),
                ("matter-book", "📕", "matter-solid"),
                ("matter-water", "💧", "matter-liquid"),
                ("matter-milk", "🥛", "matter-liquid"),
                ("matter-juice", "🧃", "matter-liquid"),
                ("matter-balloon", "🎈", "matter-gas"),
                ("matter-cloud", "☁️", "matter-gas"),
            ],
            targets=[("matter-solid", "🪨 Solid"), ("matter-liquid", "💧 Liquid"), ("matter-gas", "☁️ Gas")],
        ),
        _question(
            skill_id=SKILL_IDS[1],
            title="Backbone or Not?",
            instruction="Sort the animals by whether they have a backbone.",
            background="meadow",
            items=[
                ("bone-dog", "🐶", "bone-vertebrate"),
                ("bone-fish", "🐟", "bone-vertebrate"),
                ("bone-bird", "🐦", "bone-vertebrate"),
                ("bone-frog", "🐸", "bone-vertebrate"),
                ("bone-worm", "🪱", "bone-invertebrate"),
                ("bone-snail", "🐌", "bone-invertebrate"),
                ("bone-crab", "🦀", "bone-invertebrate"),
                ("bone-butterfly", "🦋", "bone-invertebrate"),
            ],
            targets=[("bone-vertebrate", "🦴 Has a backbone"), ("bone-invertebrate", "🐌 No backbone")],
        ),
        _question(
            skill_id=SKILL_IDS[2],
            title="Who Makes Food?",
            instruction="Sort each living thing into producers and consumers.",
            background="meadow",
            items=[
                ("chain-grass", "🌿", "chain-producer"),
                ("chain-tree", "🌳", "chain-producer"),
                ("chain-flower", "🌻", "chain-producer"),
                ("chain-algae", "🍀", "chain-producer"),
                ("chain-rabbit", "🐰", "chain-consumer"),
                ("chain-fox", "🦊", "chain-consumer"),
                ("chain-deer", "🦌", "chain-consumer"),
                ("chain-owl", "🦉", "chain-consumer"),
            ],
            targets=[("chain-producer", "🌱 Makes its own food"), ("chain-consumer", "🦊 Eats other living things")],
        ),
        _question(
            skill_id=SKILL_IDS[3],
            title="Will It Stick?",
            instruction="Sort the objects by whether a magnet attracts them.",
            background="classroom",
            items=[
                ("magnet-nail", "🔩", "magnet-yes"),
                ("magnet-key", "🔑", "magnet-yes"),
                ("magnet-scissors", "✂️", "magnet-yes"),
                ("magnet-can", "🥫", "magnet-yes"),
                ("magnet-wood", "🪵", "magnet-no"),
                ("magnet-paper", "📄", "magnet-no"),
                ("magnet-apple", "🍎", "magnet-no"),
                ("magnet-sponge", "🧽", "magnet-no"),
            ],
            targets=[("magnet-yes", "🧲 A magnet attracts it"), ("magnet-no", "🚫 It is not magnetic")],
        ),
    ]


async def _owner_id() -> str:
    grade_two_science = await Subject.find_one(Subject.key == GRADE_2_SUBJECT_ID)
    if grade_two_science:
        return grade_two_science.created_by
    admin = await User.find_one(User.role == "admin")
    if not admin:
        raise SystemExit("Create or seed an admin account before seeding Grade 3 Science")
    return str(admin.id)


async def _ensure_catalog(owner_id: str) -> Subject:
    grade = await Grade.find_one(Grade.key == GRADE_ID)
    if not grade:
        grade = Grade(
            key=GRADE_ID,
            code="G3",
            name="Grade 3",
            description="Classifying, explaining, and testing ideas with growing independence.",
            age_range="8–9 years",
            order=3,
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
            description="Matter, classification, food chains, and magnetism for Grade 3.",
            icon="FlaskConical",
            color="#0EA5E9",
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

        # The point of this seed: Grade 2 Science stops being a dead end.
        grade_two_offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == GRADE_2_GRADE_ID,
            CurriculumOffering.subject_id == GRADE_2_SUBJECT_ID,
        )
        linked = False
        if grade_two_offering and not (
            grade_two_offering.successor_grade_id or grade_two_offering.successor_subject_id
        ):
            grade_two_offering.successor_grade_id = GRADE_ID
            grade_two_offering.successor_subject_id = SUBJECT_ID
            grade_two_offering.promotion_placement_required = True
            grade_two_offering.revision += 1
            grade_two_offering.updated_by = owner_id
            grade_two_offering.updated_at = now()
            await grade_two_offering.save()
            linked = True

        print({
            "curriculum": CURRICULUM_ID,
            "release": RELEASE_ID,
            "offering": f"{GRADE_ID}/{SUBJECT_ID}",
            "grade2PromotionLinked": linked or bool(
                grade_two_offering
                and grade_two_offering.successor_grade_id == GRADE_ID
                and grade_two_offering.successor_subject_id == SUBJECT_ID
            ),
            "units": len(tree["units"]),
            "skills": len(tree["skills"]),
            "questions": len(questions),
        })
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
