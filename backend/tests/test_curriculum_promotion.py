import pytest

from app.features.promotions.service import completion_snapshot
from app.models.academic import Grade, Subject
from app.models.assignment import Assignment, CurriculumOffering
from app.models.content import CurriculumRelease
from app.models.event import LearningEvent
from app.models.user import Role

from .conftest import auth


TREE = {
    "grades": [{"id": "g1", "order": 1}],
    "subjects": [{"id": "math", "gradeId": "g1", "order": 1}],
    "units": [{"id": "u1", "subjectId": "math", "order": 1}],
    "skills": [
        {"id": "s1", "unitId": "u1", "order": 1},
        {"id": "s2", "unitId": "u1", "order": 2},
    ],
}


def snapshot(
    levels,
    available={"s1", "s2"},
    completed=None,
    rule="activities_completed",
):
    return completion_snapshot(
        tree=TREE,
        scope={"kind": "all", "ids": []},
        grade_id="g1",
        available_skill_ids=set(available),
        mastery_levels=levels,
        completed_skill_ids=set(completed or []),
        completion_rule=rule,
    )


def test_every_required_activity_must_be_completed_by_default():
    assert snapshot({}, completed={"s1"})["complete"] is False
    result = snapshot({}, completed={"s1", "s2"})
    assert result["complete"] is True
    assert result["completionRule"] == "activities_completed"


def test_proficient_rule_accepts_proficient_or_master_skills():
    assert snapshot({"s1": "proficient", "s2": "developing"}, rule="proficient")["complete"] is False
    assert snapshot({"s1": "proficient", "s2": "master"}, rule="proficient")["complete"] is True


def test_master_rule_requires_every_skill_to_be_mastered():
    assert snapshot({"s1": "master", "s2": "proficient"}, rule="master")["complete"] is False
    assert snapshot({"s1": "master", "s2": "master"}, rule="master")["complete"] is True


def test_missing_published_content_blocks_accidental_promotion():
    result = snapshot({}, {"s1"}, {"s1", "s2"})
    assert result["complete"] is False
    assert result["unavailableSkillIds"] == ["s2"]


def release(release_id: str, curriculum_id: str, grade_id: str, subject_id: str, skill_id: str):
    return CurriculumRelease(
        release_id=release_id,
        curriculum_id=curriculum_id,
        owner_id="admin",
        revision=1,
        tree={
            "title": f"{grade_id} curriculum",
            "grades": [{"id": grade_id, "label": grade_id, "order": 1}],
            "subjects": [{"id": subject_id, "gradeId": grade_id, "label": "Mathematics", "order": 1}],
            "units": [{"id": f"{skill_id}-unit", "subjectId": subject_id, "label": "Unit", "order": 1}],
            "skills": [{"id": skill_id, "unitId": f"{skill_id}-unit", "label": "Skill", "order": 1}],
        },
        question_manifest=[{
            "question_id": f"{skill_id}-q",
            "skill_id": skill_id,
            "difficulty": "easy",
            "playable": {"id": f"{skill_id}-q", "title": "Question", "technique": "MOVE_AND_COUNT", "targetCount": 3, "config": {}},
            "grading": {},
            "content_hash": "hash",
        }],
        asset_manifest=[],
        content_hashes={"tree": "tree", "questions": "questions", "assets": "assets"},
        published_by="admin",
    )


@pytest.mark.asyncio
async def test_parent_approval_promotes_only_the_completed_subject(api, database, adult, learner):
    for key, order in (("grade-1", 1), ("grade-2", 2)):
        await Grade(key=key, code=key.upper(), name=key.title(), order=order, created_by="admin", updated_by="admin").insert()
    for key, grade_id in (("g1-math", "grade-1"), ("g2-math", "grade-2"), ("g1-science", "grade-1")):
        await Subject(key=key, grade_id=grade_id, code=key.upper(), name="Mathematics" if "math" in key else "Science", created_by="admin", updated_by="admin").insert()

    source_release = release("r-g1", "c-g1", "grade-1", "g1-math", "s-g1")
    target_release = release("r-g2", "c-g2", "grade-2", "g2-math", "s-g2")
    await source_release.insert()
    await target_release.insert()
    source_offering = CurriculumOffering(
        grade_id="grade-1", subject_id="g1-math", curriculum_id="c-g1", release_id="r-g1",
        created_by="admin", updated_by="admin",
    )
    await source_offering.insert()
    await CurriculumOffering(
        grade_id="grade-2", subject_id="g2-math", curriculum_id="c-g2", release_id="r-g2",
        promotion_placement_required=False, created_by="admin", updated_by="admin",
    ).insert()
    source = Assignment(
        owner_id=str(adult.id), student_id=str(learner.id), curriculum_id="c-g1", release_id="r-g1",
        grade_id="grade-1", subject_id="g1-math", placement_required=False,
    )
    await source.insert()
    science = Assignment(
        owner_id=str(adult.id), student_id=str(learner.id), curriculum_id="science", release_id="science-r",
        grade_id="grade-1", subject_id="g1-science", placement_required=False,
    )
    await science.insert()
    await LearningEvent(
        student_id=str(learner.id),
        event_type="lesson_complete",
        assignment_id=str(source.id),
        curriculum_id="c-g1",
        release_id="r-g1",
        curriculum_skill_id="s-g1",
        verified=True,
    ).insert()

    headers = auth(str(adult.id), Role.parent.value)
    listed = await api.get("/promotions", headers=headers)
    assert listed.status_code == 200, listed.text
    pending = listed.json()["promotions"]
    assert len(pending) == 1
    assert pending[0]["successorReady"] is False

    source_offering.successor_grade_id = "grade-2"
    source_offering.successor_subject_id = "g2-math"
    await source_offering.save()
    listed = await api.get("/promotions", headers=headers)
    assert listed.status_code == 200, listed.text
    pending = listed.json()["promotions"]
    assert pending[0]["successorReady"] is True

    approved = await api.post(f"/promotions/{pending[0]['id']}/approve", headers=headers)
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "completed"
    saved_source = await Assignment.get(source.id)
    saved_science = await Assignment.get(science.id)
    assert saved_source and saved_source.status == "completed"
    assert saved_science and saved_science.status == "active"
    target = await Assignment.find_one(
        Assignment.student_id == str(learner.id),
        Assignment.subject_id == "g2-math",
        Assignment.status == "active",
    )
    assert target and target.grade_id == "grade-2" and target.placement_required is False
    retried = await api.post(f"/promotions/{pending[0]['id']}/approve", headers=headers)
    assert retried.status_code == 200
    assert await Assignment.find(
        Assignment.student_id == str(learner.id),
        Assignment.subject_id == "g2-math",
        Assignment.status == "active",
    ).count() == 1
    saved_learner = await type(learner).get(learner.id)
    assert saved_learner and saved_learner.grade_level == "grade_1"
