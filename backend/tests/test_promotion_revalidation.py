"""A promotion must still be earned at the moment it is approved.

Completion is derived state. A learner who qualified last week can stop qualifying:
an admin raises the requirement, or a scoring-config change triggers a re-score that
lowers mastery. The card was written once and then trusted forever, so tightening a
rule silently promoted exactly the learners it was written to hold back — found on a
real database, where a learner sitting at `beginner` in all four science skills had a
live, approvable card to Grade 2 under a `master` rule.

These cover both halves of the fix: the card is withdrawn when it stops qualifying,
and approval re-judges rather than trusting the row.
"""

from __future__ import annotations

import pytest
import pytest_asyncio

from app.features.promotions.service import (
    approve_promotion,
    sync_promotions_for_parent,
)
from app.models.academic import Grade, Subject
from app.models.assignment import Assignment, CurriculumOffering, CurriculumPromotion
from app.models.content import CurriculumRelease
from app.models.event import LearningEvent
from app.models.mastery import MasteryState

SKILLS = ["s1", "s2"]


def build_release(release_id: str, curriculum_id: str, grade_id: str, subject_id: str) -> CurriculumRelease:
    return CurriculumRelease(
        release_id=release_id,
        curriculum_id=curriculum_id,
        owner_id="admin",
        published_by="admin",
        revision=1,
        tree={
            "title": f"{grade_id} {subject_id}",
            "grades": [{"id": grade_id, "label": grade_id, "order": 1}],
            "subjects": [{"id": subject_id, "gradeId": grade_id, "label": "Science", "order": 1}],
            "units": [{"id": "u1", "subjectId": subject_id, "label": "Unit", "order": 1}],
            "skills": [
                {"id": skill, "unitId": "u1", "label": skill, "order": index + 1}
                for index, skill in enumerate(SKILLS)
            ],
        },
        question_manifest=[
            {
                "question_id": f"{skill}-q",
                "skill_id": skill,
                "difficulty": "easy",
                "playable": {"id": f"{skill}-q", "title": "Q", "technique": "MOVE_AND_COUNT", "targetCount": 3, "config": {}},
                "grading": {},
                "content_hash": "hash",
            }
            for skill in SKILLS
        ],
        asset_manifest=[],
        content_hashes={"tree": "t", "questions": "q", "assets": "a"},
    )


@pytest_asyncio.fixture
async def science(database, adult, learner):
    """A learner one step from promotion: every activity finished, mastery still low.

    That gap is the whole point — it qualifies under `activities_completed` and fails
    under `proficient` or `master`, so one fixture exercises every rule.
    """
    for key, order in (("grade-1", 1), ("grade-2", 2)):
        await Grade(key=key, code=key.upper(), name=key.title(), order=order,
                    created_by="admin", updated_by="admin").insert()
    for key, grade_id in (("g1-science", "grade-1"), ("g2-science", "grade-2")):
        await Subject(key=key, grade_id=grade_id, code=key.upper(), name="Science",
                      created_by="admin", updated_by="admin").insert()
    await build_release("r-g1", "c-g1", "grade-1", "g1-science").insert()
    await build_release("r-g2", "c-g2", "grade-2", "g2-science").insert()

    source_offering = CurriculumOffering(
        grade_id="grade-1", subject_id="g1-science", curriculum_id="c-g1", release_id="r-g1",
        successor_grade_id="grade-2", successor_subject_id="g2-science",
        promotion_completion_rule="activities_completed",
        created_by="admin", updated_by="admin",
    )
    await source_offering.insert()
    await CurriculumOffering(
        grade_id="grade-2", subject_id="g2-science", curriculum_id="c-g2", release_id="r-g2",
        promotion_placement_required=False, created_by="admin", updated_by="admin",
    ).insert()

    assignment = Assignment(
        owner_id=str(adult.id), student_id=str(learner.id),
        curriculum_id="c-g1", release_id="r-g1",
        grade_id="grade-1", subject_id="g1-science", placement_required=False,
    )
    await assignment.insert()

    for skill in SKILLS:
        await LearningEvent(
            student_id=str(learner.id), assignment_id=str(assignment.id),
            release_id="r-g1", curriculum_id="c-g1", curriculum_skill_id=skill,
            event_type="lesson_complete", verified=True,
        ).insert()
        await MasteryState(
            student_id=str(learner.id), curriculum_id="c-g1", skill_id=skill, level="beginner",
        ).insert()
    return source_offering, assignment


async def set_rule(offering: CurriculumOffering, rule: str) -> None:
    offering.promotion_completion_rule = rule
    await offering.save()


async def set_all_mastery(student_id: str, level: str) -> None:
    for row in await MasteryState.find(MasteryState.student_id == student_id).to_list():
        row.level = level
        await row.save()


# ── detection still works ────────────────────────────────────────────────────

async def test_a_genuinely_finished_learner_still_gets_a_card(science, adult):
    """The guard must not block the case it is protecting."""
    rows = await sync_promotions_for_parent(str(adult.id))
    assert [row.status for row in rows] == ["pending"]


@pytest.mark.parametrize(
    "rule,level",
    [("activities_completed", "beginner"), ("proficient", "proficient"), ("master", "master")],
)
async def test_a_qualified_learner_is_approved_and_actually_assigned(
    science, adult, learner, rule, level,
):
    """Every rule, all the way through: qualify, approve, land in the next curriculum.

    Parametrized because the refusal tests alone would let a bug that blocks *all*
    approvals pass silently — the guard has to say no to the right people and yes
    to everyone else.
    """
    offering, _ = science
    await set_rule(offering, rule)
    await set_all_mastery(str(learner.id), level)

    await sync_promotions_for_parent(str(adult.id))
    promotion = await CurriculumPromotion.find_one(CurriculumPromotion.student_id == str(learner.id))
    assert promotion.status == "pending", f"{rule}: no card for a qualified learner"

    updated = await approve_promotion(promotion, str(adult.id))

    assert updated.status == "completed"
    target = await Assignment.find_one(
        Assignment.student_id == str(learner.id),
        Assignment.subject_id == "g2-science",
        Assignment.status == "active",
    )
    assert target is not None, f"{rule}: approved but no Grade 2 assignment was created"
    assert target.curriculum_id == "c-g2"
    # And the learner has genuinely left the old curriculum behind.
    assert (await Assignment.get(updated.from_assignment_id)).status == "completed"


# ── raising the requirement, for every rule ──────────────────────────────────

@pytest.mark.parametrize("rule", ["proficient", "master"])
async def test_raising_the_requirement_withdraws_the_card(science, adult, learner, rule):
    offering, _ = science
    await sync_promotions_for_parent(str(adult.id))
    assert (await CurriculumPromotion.find_one(
        CurriculumPromotion.student_id == str(learner.id))).status == "pending"

    await set_rule(offering, rule)
    await sync_promotions_for_parent(str(adult.id))

    promotion = await CurriculumPromotion.find_one(CurriculumPromotion.student_id == str(learner.id))
    assert promotion.status == "withdrawn"


@pytest.mark.parametrize("rule", ["proficient", "master"])
async def test_approval_is_refused_once_the_learner_no_longer_qualifies(science, adult, learner, rule):
    """The half that actually protects the learner: the stored row is not trusted."""
    offering, assignment = science
    await sync_promotions_for_parent(str(adult.id))
    promotion = await CurriculumPromotion.find_one(CurriculumPromotion.student_id == str(learner.id))

    await set_rule(offering, rule)

    with pytest.raises(ValueError, match="no longer meets the promotion requirement"):
        await approve_promotion(promotion, str(adult.id))

    # Nothing moved: the source stays active and no Grade 2 assignment appeared.
    assert (await Assignment.get(assignment.id)).status == "active"
    assert await Assignment.find(
        Assignment.student_id == str(learner.id), Assignment.subject_id == "g2-science",
    ).count() == 0


async def test_approval_is_refused_even_without_a_sync_first(science, adult, learner):
    """A parent's open tab still holds the old card; the server cannot rely on a re-sync."""
    offering, _ = science
    await sync_promotions_for_parent(str(adult.id))
    promotion = await CurriculumPromotion.find_one(CurriculumPromotion.student_id == str(learner.id))
    await set_rule(offering, "master")

    with pytest.raises(ValueError, match="no longer meets"):
        await approve_promotion(promotion, str(adult.id))


async def test_a_lowered_mastery_score_also_withdraws_the_card(science, adult, learner):
    """Not only admin edits: a re-score after a scoring-config change moves levels too."""
    offering, _ = science
    await set_rule(offering, "master")
    await set_all_mastery(str(learner.id), "master")
    await sync_promotions_for_parent(str(adult.id))
    assert (await CurriculumPromotion.find_one(
        CurriculumPromotion.student_id == str(learner.id))).status == "pending"

    await set_all_mastery(str(learner.id), "developing")   # what a re-score can do
    await sync_promotions_for_parent(str(adult.id))

    assert (await CurriculumPromotion.find_one(
        CurriculumPromotion.student_id == str(learner.id))).status == "withdrawn"


# ── and back again ───────────────────────────────────────────────────────────

async def test_re_qualifying_brings_the_card_back(science, adult, learner):
    offering, _ = science
    # Earn the card under the original rule first — there is nothing to restore
    # otherwise, since a learner who never qualified never had a row.
    await sync_promotions_for_parent(str(adult.id))
    await set_rule(offering, "master")
    await sync_promotions_for_parent(str(adult.id))
    assert (await CurriculumPromotion.find_one(
        CurriculumPromotion.student_id == str(learner.id))).status == "withdrawn"

    await set_all_mastery(str(learner.id), "master")
    await sync_promotions_for_parent(str(adult.id))

    restored = await CurriculumPromotion.find_one(CurriculumPromotion.student_id == str(learner.id))
    assert restored.status == "pending"
    assert restored.decided_at is None
    assert await approve_promotion(restored, str(adult.id)) is not None


async def test_an_approved_promotion_is_never_withdrawn(science, adult, learner):
    """Completed is history, not a live offer — a later rule change must not rewrite it."""
    offering, _ = science
    await sync_promotions_for_parent(str(adult.id))
    promotion = await CurriculumPromotion.find_one(CurriculumPromotion.student_id == str(learner.id))
    await approve_promotion(promotion, str(adult.id))

    await set_rule(offering, "master")
    await sync_promotions_for_parent(str(adult.id))

    assert (await CurriculumPromotion.find_one(
        CurriculumPromotion.student_id == str(learner.id))).status == "completed"
