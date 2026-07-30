"""Seed a compact, editable Grade 1 Science starter curriculum.

The pilot reuses the server-graded Flexible Canvas drag-and-match component. It
creates an editable curriculum draft, one immutable starter release, the Science
offering, and Science access for Jutta. Existing Math assignments and progress
are never reset or replaced. Curriculum Studio owns every edit after this initial
bootstrap; publishing there updates the learner offering. Re-running is safe.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.core.db import close_db, init_db
from app.features.content.release import build_release_payload
from app.models.academic import Subject
from app.models.assignment import Assignment, CurriculumOffering, ProgressionState
from app.models.content import Curriculum, CurriculumRelease, QuestionDeck
from app.models.student import Student


CURRICULUM_ID = "seed-grade1-science-pilot"
RELEASE_ID = "seed-grade1-science-pilot-release-3"
RELEASE_REVISION = 3
GRADE_ID = "grade-1"
SUBJECT_ID = "grade-1-science"
UNIT_ID = "seed-g1-science-unit-classification"
SKILL_ID = "seed-g1-science-skill-living-things"
QUESTION_ID = "seed-g1-science-q-living-nonliving"
QUESTION_IDS = {
    QUESTION_ID,
    "seed-g1-science-q-animal-habitats",
    "seed-g1-science-q-plant-needs",
    "seed-g1-science-q-weather-ready",
}


def now() -> datetime:
    return datetime.now(timezone.utc)


def pilot_tree() -> dict:
    return {
        "title": "Grade 1 Science Adventures",
        "description": "Hands-on classification activities about living things, habitats, plants, and weather.",
        "version": "starter-2.0",
        "primaryGradeId": GRADE_ID,
        "primarySubjectId": SUBJECT_ID,
        "grades": [{"id": GRADE_ID, "label": "Grade 1", "order": 1}],
        "subjects": [{"id": SUBJECT_ID, "gradeId": GRADE_ID, "label": "Science", "order": 1}],
        "units": [
            {"id": UNIT_ID, "subjectId": SUBJECT_ID, "label": "Living and Nonliving Things", "description": "Notice what living things need and how they differ from objects.", "presentation": {"icon": "leaf", "accent": "green"}, "order": 1},
            {"id": "seed-g1-science-unit-habitats", "subjectId": SUBJECT_ID, "label": "Animals and Habitats", "description": "Match animals to the places that meet their needs.", "presentation": {"icon": "paw", "accent": "blue"}, "order": 2},
            {"id": "seed-g1-science-unit-plants", "subjectId": SUBJECT_ID, "label": "Plants and Growth", "description": "Discover what helps a plant grow strong.", "presentation": {"icon": "leaf", "accent": "green"}, "order": 3},
            {"id": "seed-g1-science-unit-weather", "subjectId": SUBJECT_ID, "label": "Weather and Seasons", "description": "Observe weather and choose what belongs in each kind of day.", "presentation": {"icon": "weather", "accent": "amber"}, "order": 4},
        ],
        "skills": [
            {"id": SKILL_ID, "unitId": UNIT_ID, "label": "Classify living and nonliving things", "order": 1, "minQuestions": 1, "placementCheckpoint": False, "prerequisiteSkillIds": [], "completionXp": 15, "presentation": {"title": "Living or Nonliving?", "description": "Drag each picture into the correct Science group.", "estimatedMinutes": 4, "thumbnailUrl": "/assets/components/flexible-canvas.svg", "accent": "green"}},
            {"id": "seed-g1-science-skill-habitats", "unitId": "seed-g1-science-unit-habitats", "label": "Match animals to their habitats", "order": 1, "minQuestions": 1, "placementCheckpoint": False, "prerequisiteSkillIds": [SKILL_ID], "completionXp": 15, "presentation": {"title": "Where Does It Live?", "description": "Help each animal find the right home.", "estimatedMinutes": 4, "thumbnailUrl": "/assets/components/flexible-canvas.svg", "accent": "blue"}},
            {"id": "seed-g1-science-skill-plant-needs", "unitId": "seed-g1-science-unit-plants", "label": "Identify what plants need", "order": 1, "minQuestions": 1, "placementCheckpoint": False, "prerequisiteSkillIds": ["seed-g1-science-skill-habitats"], "completionXp": 15, "presentation": {"title": "Help the Plant Grow", "description": "Sort what a plant needs from what it does not need.", "estimatedMinutes": 4, "thumbnailUrl": "/assets/components/flexible-canvas.svg", "accent": "green"}},
            {"id": "seed-g1-science-skill-weather", "unitId": "seed-g1-science-unit-weather", "label": "Choose items for different weather", "order": 1, "minQuestions": 1, "placementCheckpoint": False, "prerequisiteSkillIds": ["seed-g1-science-skill-plant-needs"], "completionXp": 15, "presentation": {"title": "Ready for the Weather", "description": "Sort each item into a sunny or rainy day.", "estimatedMinutes": 4, "thumbnailUrl": "/assets/components/flexible-canvas.svg", "accent": "amber"}},
        ],
        "rewards": {
            "quest": {"label": "Science explorer quest", "activitiesPerSession": 1},
            "xp": {"correctAnswer": 5, "firstTryBonus": 2, "activityCompletion": 15},
            "level": {"xpPerLevel": 100},
            "achievements": [],
        },
    }


def pilot_question() -> dict:
    return {
        "id": QUESTION_ID,
        "curriculumId": CURRICULUM_ID,
        "title": "Living or Nonliving?",
        "instruction": "Drag every picture into the Living or Nonliving group.",
        "technique": "FLEXIBLE_CANVAS",
        "skillId": SKILL_ID,
        "difficulty": "easy",
        "objectId": "leaf",
        "targetCount": 6,
        "config": {
            "flexibleMode": "dragmatch",
            "flexibleBgStyle": "meadow",
            "flexibleItems": [
                {"id": "science-dog", "emoji": "🐶", "x": 28, "y": 34, "targetBin": "science-living"},
                {"id": "science-tree", "emoji": "🌳", "x": 100, "y": 34, "targetBin": "science-living"},
                {"id": "science-butterfly", "emoji": "🦋", "x": 172, "y": 34, "targetBin": "science-living"},
                {"id": "science-rock", "emoji": "🪨", "x": 244, "y": 34, "targetBin": "science-nonliving"},
                {"id": "science-ball", "emoji": "⚽", "x": 316, "y": 34, "targetBin": "science-nonliving"},
                {"id": "science-book", "emoji": "📘", "x": 388, "y": 34, "targetBin": "science-nonliving"},
            ],
            "flexibleTargets": [
                {"id": "science-living", "label": "🌱 Living", "x": 46, "y": 180, "width": 170, "height": 100},
                {"id": "science-nonliving", "label": "🪨 Nonliving", "x": 264, "y": 180, "width": 170, "height": 100},
            ],
        },
    }


def science_questions() -> list[dict]:
    return [
        pilot_question(),
        {
            "id": "seed-g1-science-q-animal-habitats", "title": "Where Does It Live?",
            "curriculumId": CURRICULUM_ID,
            "instruction": "Drag every animal into its habitat.", "technique": "FLEXIBLE_CANVAS",
            "skillId": "seed-g1-science-skill-habitats", "difficulty": "easy", "objectId": "animal", "targetCount": 6,
            "config": {"flexibleMode": "dragmatch", "flexibleBgStyle": "sky", "flexibleItems": [
                {"id": "habitat-fish", "emoji": "🐟", "x": 24, "y": 30, "targetBin": "habitat-ocean"},
                {"id": "habitat-dolphin", "emoji": "🐬", "x": 92, "y": 30, "targetBin": "habitat-ocean"},
                {"id": "habitat-fox", "emoji": "🦊", "x": 160, "y": 30, "targetBin": "habitat-forest"},
                {"id": "habitat-owl", "emoji": "🦉", "x": 228, "y": 30, "targetBin": "habitat-forest"},
                {"id": "habitat-cow", "emoji": "🐄", "x": 296, "y": 30, "targetBin": "habitat-farm"},
                {"id": "habitat-chicken", "emoji": "🐔", "x": 364, "y": 30, "targetBin": "habitat-farm"}],
                "flexibleTargets": [
                    {"id": "habitat-ocean", "label": "🌊 Ocean", "x": 18, "y": 180, "width": 130, "height": 100},
                    {"id": "habitat-forest", "label": "🌲 Forest", "x": 165, "y": 180, "width": 130, "height": 100},
                    {"id": "habitat-farm", "label": "🚜 Farm", "x": 312, "y": 180, "width": 130, "height": 100}]},
        },
        {
            "id": "seed-g1-science-q-plant-needs", "title": "Help the Plant Grow",
            "curriculumId": CURRICULUM_ID,
            "instruction": "Sort what a plant needs from what it does not need.", "technique": "FLEXIBLE_CANVAS",
            "skillId": "seed-g1-science-skill-plant-needs", "difficulty": "easy", "objectId": "plant", "targetCount": 6,
            "config": {"flexibleMode": "dragmatch", "flexibleBgStyle": "meadow", "flexibleItems": [
                {"id": "plant-sun", "emoji": "☀️", "x": 28, "y": 34, "targetBin": "plant-needs"},
                {"id": "plant-water", "emoji": "💧", "x": 100, "y": 34, "targetBin": "plant-needs"},
                {"id": "plant-air", "emoji": "💨", "x": 172, "y": 34, "targetBin": "plant-needs"},
                {"id": "plant-soil", "emoji": "🟫", "x": 244, "y": 34, "targetBin": "plant-needs"},
                {"id": "plant-toy", "emoji": "🧸", "x": 316, "y": 34, "targetBin": "plant-not-needs"},
                {"id": "plant-shoe", "emoji": "👟", "x": 388, "y": 34, "targetBin": "plant-not-needs"}],
                "flexibleTargets": [
                    {"id": "plant-needs", "label": "🌱 Plant needs", "x": 46, "y": 180, "width": 170, "height": 100},
                    {"id": "plant-not-needs", "label": "🚫 Does not need", "x": 264, "y": 180, "width": 170, "height": 100}]},
        },
        {
            "id": "seed-g1-science-q-weather-ready", "title": "Ready for the Weather",
            "curriculumId": CURRICULUM_ID,
            "instruction": "Sort each item into a sunny or rainy day.", "technique": "FLEXIBLE_CANVAS",
            "skillId": "seed-g1-science-skill-weather", "difficulty": "easy", "objectId": "weather", "targetCount": 6,
            "config": {"flexibleMode": "dragmatch", "flexibleBgStyle": "sky", "flexibleItems": [
                {"id": "weather-sunglasses", "emoji": "🕶️", "x": 28, "y": 34, "targetBin": "weather-sunny"},
                {"id": "weather-hat", "emoji": "🧢", "x": 100, "y": 34, "targetBin": "weather-sunny"},
                {"id": "weather-sunscreen", "emoji": "🧴", "x": 172, "y": 34, "targetBin": "weather-sunny"},
                {"id": "weather-umbrella", "emoji": "☂️", "x": 244, "y": 34, "targetBin": "weather-rainy"},
                {"id": "weather-raincoat", "emoji": "🧥", "x": 316, "y": 34, "targetBin": "weather-rainy"},
                {"id": "weather-boots", "emoji": "🥾", "x": 388, "y": 34, "targetBin": "weather-rainy"}],
                "flexibleTargets": [
                    {"id": "weather-sunny", "label": "☀️ Sunny day", "x": 46, "y": 180, "width": 170, "height": 100},
                    {"id": "weather-rainy", "label": "🌧️ Rainy day", "x": 264, "y": 180, "width": 170, "height": 100}]},
        },
    ]


async def main() -> None:
    await init_db()
    try:
        subject = await Subject.find_one(Subject.key == SUBJECT_ID, Subject.grade_id == GRADE_ID)
        if not subject:
            raise SystemExit("Grade 1 Science is missing from the Admin subject catalog")
        owner_id = subject.created_by
        tree = pilot_tree()
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
            release = CurriculumRelease(
                release_id=RELEASE_ID,
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                revision=RELEASE_REVISION,
                published_by=owner_id,
                **payload,
            )
            await release.insert()

        offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == GRADE_ID,
            CurriculumOffering.subject_id == SUBJECT_ID,
        )
        if offering:
            if offering.curriculum_id != CURRICULUM_ID or offering.release_id != RELEASE_ID or not offering.active:
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

        jutta = await Student.find_one(Student.name == "Jutta")
        if not jutta:
            raise SystemExit("Jutta profile was not found")
        jutta.grade_level = GRADE_ID
        jutta.primary_subject = jutta.primary_subject if jutta.primary_subject == "grade-1-math" else "grade-1-math"
        jutta.learning_goals = ["grade-1-math", SUBJECT_ID]
        await jutta.save()

        assignment = await Assignment.find_one(
            Assignment.student_id == str(jutta.id),
            Assignment.subject_id == SUBJECT_ID,
            Assignment.status == "active",
        )
        if not assignment:
            owner = next(iter(jutta.guardian_parent_ids), None) or owner_id
            assignment = Assignment(
                owner_id=owner,
                student_id=str(jutta.id),
                curriculum_id=CURRICULUM_ID,
                release_id=RELEASE_ID,
                grade_id=GRADE_ID,
                subject_id=SUBJECT_ID,
                priority=60,
                placement_required=True,
                status="active",
            )
            await assignment.insert()
        elif assignment.release_id != RELEASE_ID:
            assignment.curriculum_id = CURRICULUM_ID
            assignment.release_id = RELEASE_ID
            assignment.updated_at = now()
            await assignment.save()

        progression = await ProgressionState.find_one(
            ProgressionState.student_id == str(jutta.id),
            ProgressionState.assignment_id == str(assignment.id),
        )
        if progression and progression.release_id != RELEASE_ID:
            progression.curriculum_id = CURRICULUM_ID
            progression.release_id = RELEASE_ID
            progression.updated_at = now()
            await progression.save()

        active_assignments = await Assignment.find(
            Assignment.student_id == str(jutta.id),
            Assignment.status == "active",
        ).to_list()
        desired_priority = {"grade-1-math": 50, SUBJECT_ID: 60}
        for row in active_assignments:
            priority = desired_priority.get(row.subject_id)
            if priority is not None and row.priority != priority:
                row.priority = priority
                row.updated_at = now()
                await row.save()

        print({
            "curriculum": CURRICULUM_ID,
            "release": RELEASE_ID,
            "offering": f"{GRADE_ID}/{SUBJECT_ID}",
            "student": jutta.name,
            "assignment": str(assignment.id),
            "component": "FLEXIBLE_CANVAS",
            "units": len(tree["units"]),
            "skills": len(tree["skills"]),
            "questions": len(questions),
        })
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
