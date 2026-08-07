from __future__ import annotations

import pytest

from app.core.security import hash_secret
from app.core.seed_academic import ensure_academic_catalogs
from app.core.subject_icons import MATH_SUBJECT_ICON, THINKING_LOGIC_SUBJECT_ICON
from app.models.academic import Grade, Subject
from app.models.assignment import Assignment, CurriculumOffering
from app.models.content import CurriculumRelease, SvgLibrary
from app.models.user import Role, User
from app.models.student import Student
from app.features.content.release import build_release_payload

from .conftest import auth


def release_tree() -> dict:
    return {
        "primaryGradeId": "grade-1",
        "primarySubjectId": "grade-1-math",
        "grades": [{"id": "grade-1"}],
        "subjects": [
            {"id": "grade-1-math", "gradeId": "grade-1", "label": "Math"},
            {"id": "grade-1-reading", "gradeId": "grade-1", "label": "Reading"},
        ],
        "units": [],
        "skills": [],
    }


async def seed_catalog(admin_id: str) -> None:
    await Grade(
        key="grade-1", code="G1", name="Grade 1", created_by=admin_id, updated_by=admin_id
    ).insert()
    for key, code, name in (
        ("grade-1-math", "MATH", "Math"),
        ("grade-1-reading", "READ", "Reading"),
    ):
        await Subject(
            key=key,
            grade_id="grade-1",
            code=code,
            name=name,
            created_by=admin_id,
            updated_by=admin_id,
        ).insert()


@pytest.mark.asyncio
async def test_legacy_math_and_logic_subjects_receive_first_party_svg_assets(database):
    admin = User(
        email="subject-assets@example.com",
        name="Subject assets",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    await admin.insert()
    await Grade(
        key="grade-1", code="G1", name="Grade 1", created_by=str(admin.id), updated_by=str(admin.id)
    ).insert()
    math = Subject(
        key="grade-1-math", grade_id="grade-1", code="MATH", name="Mathematics",
        icon="Calculator", created_by=str(admin.id), updated_by=str(admin.id),
    )
    logic = Subject(
        key="grade-1-thinking-logic", grade_id="grade-1", code="LOGIC", name="Thinking & Logic",
        icon="Brain", created_by=str(admin.id), updated_by=str(admin.id),
    )
    await math.insert()
    await logic.insert()

    await ensure_academic_catalogs()

    saved_math = await Subject.find_one(Subject.key == math.key)
    saved_logic = await Subject.find_one(Subject.key == logic.key)
    assert saved_math and saved_math.icon_asset == MATH_SUBJECT_ICON
    assert saved_math.icon == MATH_SUBJECT_ICON["id"]
    assert saved_logic and saved_logic.icon_asset == THINKING_LOGIC_SUBJECT_ICON
    assert saved_logic.icon == THINKING_LOGIC_SUBJECT_ICON["id"]
    library = await SvgLibrary.find_one(SvgLibrary.owner_id == str(admin.id))
    assert library
    assert {asset["id"] for asset in library.assets} == {
        MATH_SUBJECT_ICON["id"], THINKING_LOGIC_SUBJECT_ICON["id"],
    }

    custom_asset = {
        "id": "custom-subject-math", "label": "My math icon",
        "markup": '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>', "scale": 1.0,
    }
    saved_math.icon = custom_asset["id"]
    saved_math.icon_asset = custom_asset
    await saved_math.save()
    await ensure_academic_catalogs()
    preserved_math = await Subject.find_one(Subject.key == math.key)
    assert preserved_math and preserved_math.icon_asset == custom_asset


async def seed_release(admin_id: str) -> CurriculumRelease:
    release = CurriculumRelease(
        release_id="multi-release-1",
        curriculum_id="multi-curriculum",
        owner_id=admin_id,
        revision=1,
        tree=release_tree(),
        question_manifest=[],
        asset_manifest=[],
        content_hashes={"tree": "tree", "questions": "questions", "assets": "assets"},
        published_by=admin_id,
    )
    await release.insert()
    return release


async def seed_placement_release(admin_id: str, subject_id: str, label: str, number: int) -> CurriculumRelease:
    curriculum_id = f"{subject_id}-placement-curriculum"
    release_id = f"{subject_id}-placement-release"
    unit_id = f"{subject_id}-unit"
    skill_id = f"{subject_id}-skill"
    question_id = f"{subject_id}-question"
    tree = {
        "title": f"{label} placement",
        "primaryGradeId": "grade-1",
        "primarySubjectId": subject_id,
        "grades": [{"id": "grade-1", "label": "Grade 1", "order": 1}],
        "subjects": [{"id": subject_id, "gradeId": "grade-1", "label": label, "order": 1}],
        "units": [{"id": unit_id, "subjectId": subject_id, "label": f"{label} unit", "order": 1}],
        "skills": [{
            "id": skill_id,
            "unitId": unit_id,
            "label": f"{label} checkpoint",
            "order": 1,
            "placementCheckpoint": True,
            "prerequisiteSkillIds": [],
        }],
    }
    question = {
        "id": question_id,
        "title": f"Count for {label}",
        "instruction": "Count the objects.",
        "technique": "ONE_TO_ONE",
        "skillId": skill_id,
        "difficulty": "easy",
        "objectId": "apple",
        "targetCount": number,
        "config": {},
    }
    payload = build_release_payload(tree=tree, questions=[question], assets=[])
    release = CurriculumRelease(
        release_id=release_id,
        curriculum_id=curriculum_id,
        owner_id=admin_id,
        revision=1,
        published_by=admin_id,
        **payload,
    )
    await release.insert()
    return release


@pytest.mark.asyncio
async def test_multi_subject_placement_advances_one_subject_at_a_time(api, database, adult):
    learner = Student(name="Placement Learner", guardian_parent_ids=[str(adult.id)])
    await learner.insert()
    math_release = await seed_placement_release(str(adult.id), "grade-1-math", "Mathematics", 3)
    reading_release = await seed_placement_release(str(adult.id), "grade-1-reading", "Reading", 4)
    for priority, subject_id, release in (
        (50, "grade-1-math", math_release),
        (60, "grade-1-reading", reading_release),
    ):
        await Assignment(
            owner_id=str(adult.id),
            student_id=str(learner.id),
            curriculum_id=release.curriculum_id,
            release_id=release.release_id,
            grade_id="grade-1",
            subject_id=subject_id,
            priority=priority,
            placement_required=True,
        ).insert()

    headers = auth(str(learner.id), Role.student.value)
    first = await api.get("/student/placement/quiz", headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["subjectName"] == "Mathematics"
    assert (first.json()["subjectPosition"], first.json()["subjectTotal"]) == (1, 2)
    submitted = await api.post(
        f"/student/placement/{first.json()['placementId']}/submit",
        headers=headers,
        json={"responses": [{
            "questionId": first.json()["items"][0]["placementItemId"],
            "selection": 3,
        }]},
    )
    assert submitted.status_code == 200, submitted.text

    second = await api.get("/student/placement/quiz", headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["subjectName"] == "Reading"
    assert (second.json()["subjectPosition"], second.json()["subjectTotal"]) == (2, 2)


@pytest.mark.asyncio
async def test_admin_can_map_a_grade_subject_to_a_published_release(api, database):
    admin = User(
        email="offerings-admin@example.com",
        name="Admin",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    await admin.insert()
    await seed_catalog(str(admin.id))
    await seed_release(str(admin.id))

    response = await api.put(
        "/settings/curriculum-offerings",
        headers=auth(str(admin.id), Role.admin.value),
        json={
            "grade_id": "grade-1",
            "subject_id": "grade-1-math",
            "curriculum_id": "multi-curriculum",
            "release_id": "multi-release-1",
            "promotion_completion_rule": "proficient",
            "revision": 0,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["subject_id"] == "grade-1-math"
    assert response.json()["promotion_completion_rule"] == "proficient"
    assert await CurriculumOffering.find_one(CurriculumOffering.subject_id == "grade-1-math")
    catalog = await api.get(
        "/settings/curriculum-catalog",
        headers=auth(str(admin.id), Role.admin.value),
    )
    ready = {item["key"]: item["content_ready"] for item in catalog.json()["subjects"]}
    assert ready == {"grade-1-math": True, "grade-1-reading": False}


@pytest.mark.asyncio
async def test_subject_svg_icon_is_saved_and_delivered_to_learners(api, database):
    admin = User(
        email="subject-icon-admin@example.com",
        name="Admin",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    learner = Student(name="Icon Learner")
    await admin.insert()
    await learner.insert()
    await seed_catalog(str(admin.id))
    subject = await Subject.find_one(Subject.key == "grade-1-math")
    assert subject

    icon_asset = {
        "id": "svg-subject-math",
        "label": "Math blocks",
        "markup": '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6"/></svg>',
        "scale": 1,
    }
    saved = await api.put(
        "/settings/subjects/grade-1-math",
        headers=auth(str(admin.id), Role.admin.value),
        json={
            "key": subject.key,
            "grade_id": subject.grade_id,
            "code": subject.code,
            "name": subject.name,
            "description": subject.description,
            "icon": icon_asset["id"],
            "icon_asset": icon_asset,
            "color": subject.color,
            "order": subject.order,
            "active": subject.active,
            "revision": subject.revision,
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["icon_asset"] == icon_asset

    await Assignment(
        owner_id=str(admin.id),
        student_id=str(learner.id),
        subject_id=subject.key,
        grade_id=subject.grade_id,
        curriculum_id="icon-curriculum",
        release_id="icon-release",
        placement_required=False,
        created_by=str(admin.id),
        updated_by=str(admin.id),
    ).insert()
    response = await api.get(
        "/learning/subjects",
        headers=auth(str(learner.id), Role.student.value),
    )
    assert response.status_code == 200, response.text
    assert response.json()["subjects"][0]["iconAsset"] == icon_asset


@pytest.mark.asyncio
async def test_new_child_receives_one_assignment_per_selected_subject(api, database):
    admin = User(
        email="multi-admin@example.com",
        name="Admin",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    parent = User(
        email="multi-parent@example.com",
        name="Parent",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value,
    )
    await admin.insert()
    await parent.insert()
    await seed_catalog(str(admin.id))
    release = await seed_release(str(admin.id))
    for subject_id in ("grade-1-math", "grade-1-reading"):
        await CurriculumOffering(
            grade_id="grade-1",
            subject_id=subject_id,
            curriculum_id=release.curriculum_id,
            release_id=release.release_id,
            created_by=str(admin.id),
            updated_by=str(admin.id),
        ).insert()

    response = await api.post(
        "/family/children",
        headers=auth(str(parent.id), Role.parent.value),
        json={
            "name": "Multi Learner",
            "grade_level": "grade-1",
            "primary_subject": "grade-1-math",
            "learning_goals": ["grade-1-math", "grade-1-reading"],
            "placement_required": True,
        },
    )
    assert response.status_code == 201, response.text
    rows = await Assignment.find(Assignment.student_id == response.json()["id"]).sort("priority").to_list()
    assert [row.subject_id for row in rows] == ["grade-1-math", "grade-1-reading"]
    assert {row.release_id for row in rows} == {"multi-release-1"}
    assert [row.priority for row in rows] == [50, 60]

    # Empty fixture releases have no placement-compatible questions, so both
    # subject placements are safely skipped and become ready for navigation.
    placement = await api.get(
        "/student/placement/quiz",
        headers=auth(response.json()["id"], Role.student.value),
    )
    assert placement.status_code == 200, placement.text
    subjects_response = await api.get(
        "/learning/subjects",
        headers=auth(response.json()["id"], Role.student.value),
    )
    assert subjects_response.status_code == 200, subjects_response.text
    assert subjects_response.json()["currentSubjectId"] == "grade-1-math"
    assert [item["id"] for item in subjects_response.json()["subjects"]] == [
        "grade-1-math",
        "grade-1-reading",
    ]
    assert all(item["ready"] for item in subjects_response.json()["subjects"])

    selected = await api.put(
        "/learning/subjects/current",
        headers=auth(response.json()["id"], Role.student.value),
        json={"subject_id": "grade-1-reading"},
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["currentSubjectId"] == "grade-1-reading"
    refreshed = await api.get(
        "/learning/subjects",
        headers=auth(response.json()["id"], Role.student.value),
    )
    assert refreshed.json()["currentSubjectId"] == "grade-1-reading"
    learner = await Student.get(response.json()["id"])
    assert learner and learner.preferred_subject == "grade-1-reading"


@pytest.mark.asyncio
async def test_child_creation_rejects_an_unpublished_selected_subject(api, database):
    admin = User(
        email="missing-admin@example.com",
        name="Admin",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    parent = User(
        email="missing-parent@example.com",
        name="Parent",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value,
    )
    await admin.insert()
    await parent.insert()
    await seed_catalog(str(admin.id))

    response = await api.post(
        "/family/children",
        headers=auth(str(parent.id), Role.parent.value),
        json={
            "name": "No Content Yet",
            "grade_level": "grade-1",
            "primary_subject": "grade-1-reading",
            "learning_goals": ["grade-1-reading"],
        },
    )
    assert response.status_code == 409
    assert "grade-1-reading" in response.json()["detail"]


@pytest.mark.asyncio
async def test_parent_can_remove_and_restore_subject_access_without_deleting_history(api, database):
    admin = User(
        email="edit-admin@example.com",
        name="Admin",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.admin.value,
    )
    parent = User(
        email="edit-parent@example.com",
        name="Parent",
        password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value,
    )
    await admin.insert()
    await parent.insert()
    await seed_catalog(str(admin.id))
    release = await seed_release(str(admin.id))
    for subject_id in ("grade-1-math", "grade-1-reading"):
        await CurriculumOffering(
            grade_id="grade-1",
            subject_id=subject_id,
            curriculum_id=release.curriculum_id,
            release_id=release.release_id,
            created_by=str(admin.id),
            updated_by=str(admin.id),
        ).insert()

    created = await api.post(
        "/family/children",
        headers=auth(str(parent.id), Role.parent.value),
        json={
            "name": "Subject Editor",
            "grade_level": "grade-1",
            "primary_subject": "grade-1-math",
            "learning_goals": ["grade-1-math", "grade-1-reading"],
        },
    )
    child_id = created.json()["id"]
    removed = await api.patch(
        f"/family/children/{child_id}",
        headers=auth(str(parent.id), Role.parent.value),
        json={
            "primary_subject": "grade-1-math",
            "learning_goals": ["grade-1-math"],
        },
    )
    assert removed.status_code == 200, removed.text
    rows = await Assignment.find(Assignment.student_id == child_id).to_list()
    reading_assignment = next(row for row in rows if row.subject_id == "grade-1-reading")
    assert {(row.subject_id, row.status) for row in rows} == {
        ("grade-1-math", "active"),
        ("grade-1-reading", "archived"),
    }

    restored = await api.patch(
        f"/family/children/{child_id}",
        headers=auth(str(parent.id), Role.parent.value),
        json={
            "primary_subject": "grade-1-reading",
            "learning_goals": ["grade-1-reading", "grade-1-math"],
        },
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["primary_subject"] == "grade-1-reading"
    active = await Assignment.find(
        Assignment.student_id == child_id,
        Assignment.status == "active",
    ).sort("priority").to_list()
    assert [row.subject_id for row in active] == ["grade-1-reading", "grade-1-math"]
    restored_reading = next(row for row in active if row.subject_id == "grade-1-reading")
    assert restored_reading.id == reading_assignment.id
