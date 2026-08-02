"""A solved bottle-sort board, from posted events to the XP a child is shown.

This is the path that failed in production twice. First `LIQUID_SORT` had no registered
grader, so every attempt was stored unverified and the activity could never complete.
Then the board itself never reached the server: the canvas reported the solved bottles,
but GameLauncher's `onSuccess` bridge logged an empty attempt first and the real one was
dropped by the first-writer guard. Both times the unit tests were green.

So this exercises the whole chain the way a learner does — release built by the real
`build_release_payload`, events posted to the real `/events` endpoint, XP read back from
the real progress endpoint — and asserts the figures a child actually sees.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from beanie import PydanticObjectId

from app.core.security import hash_secret
from app.features.content.release import build_release_payload
from app.models.assignment import Assignment
from app.models.content import CurriculumRelease
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth

CURRICULUM = "liquid-sort-under-test"
RELEASE = "liquid-sort-release"
REVISION = 1
ASSIGNMENT = "0123456789abcdef01234568"
SKILL = "skill-first-pour"
QUESTION = "q-first-pour"
COMPLETION_XP = 20

#: The level's starting liquid: two colours, three layers each, exactly as a seeded level
#: carries it. Solving means each colour ends up alone in one bottle.
LAYERS = {"cyan": 3, "magenta": 3}
SOLVED = [["cyan", "cyan", "cyan"], ["magenta", "magenta", "magenta"], []]
UNSOLVED = [["cyan", "cyan", "magenta"], ["magenta", "magenta", "cyan"], []]


def tree() -> dict:
    return {
        "title": "Bottle sort under test",
        "grades": [{"id": "grade-1", "order": 1}],
        "subjects": [{"id": "logic", "gradeId": "grade-1", "order": 1}],
        "units": [{"id": "u1", "subjectId": "logic", "label": "Liquid Bottle Sort", "order": 1}],
        "skills": [{
            "id": SKILL, "unitId": "u1", "label": "Sort two colours", "order": 1,
            "completionXp": COMPLETION_XP,
            "presentation": {"title": "First Pour"},
        }],
        # The same economics scripts/seed_grade1_thinking_logic.py authors, so the figures
        # below are the ones the shipped ladder pays, not the platform fallback.
        "rewards": {
            "quest": {"label": "Bottle sort quest", "activitiesPerSession": 2},
            "xp": {"correctAnswer": 5, "firstTryBonus": 2, "activityCompletion": 20},
            "level": {"xpPerLevel": 120},
            "achievements": [],
        },
    }


def question() -> dict:
    return {
        "id": QUESTION, "curriculumId": CURRICULUM, "skillId": SKILL,
        "technique": "LIQUID_SORT", "difficulty": "easy", "targetCount": 3,
        "config": {"levelId": "level_1", "difficultyTier": "beginner", "liquidSortLayers": LAYERS},
    }


@pytest_asyncio.fixture
async def learner(database):
    parent = User(
        email="sorter@example.com", name="P", password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value, family_code="FAM222",
    )
    await parent.insert()
    student = Student(name="Robin", guardian_parent_ids=[str(parent.id)])
    await student.insert()
    payload = build_release_payload(tree=tree(), questions=[question()], assets=[])
    await CurriculumRelease(
        release_id=RELEASE, curriculum_id=CURRICULUM, revision=REVISION,
        owner_id=str(parent.id), published_by=str(parent.id), **payload,
    ).insert()
    await Assignment(
        id=PydanticObjectId(ASSIGNMENT), student_id=str(student.id), curriculum_id=CURRICULUM,
        release_id=RELEASE, grade_id="grade-1", status="active", placement_required=False,
        owner_id=str(parent.id),
    ).insert()
    return student


def solve(board, *, session="s1", event_id="a1") -> dict:
    """What the canvas reports when a board is finished."""
    return {
        "id": event_id, "eventType": "attempt", "technique": "LIQUID_SORT",
        # Claimed by the client and deliberately not trusted: the board below decides.
        "outcome": "correct", "selected": board,
        "questionId": QUESTION, "curriculumSkillId": SKILL, "curriculumId": CURRICULUM,
        "releaseId": RELEASE, "sessionId": session, "curriculumRevision": REVISION,
        "assignmentId": ASSIGNMENT, "attemptNumber": 1, "hintUsedBeforeAttempt": False,
        "occurredAt": "2026-08-01T10:00:00+00:00", "clientTimestampMs": 1_800_000_000_000,
    }


def finished(*, session="s1") -> dict:
    return {
        "id": f"{session}-done", "eventType": "lesson_complete", "curriculumSkillId": SKILL,
        "curriculumId": CURRICULUM, "releaseId": RELEASE, "sessionId": session,
        "curriculumRevision": REVISION, "assignmentId": ASSIGNMENT,
        "occurredAt": "2026-08-01T10:05:00+00:00", "clientTimestampMs": 1_800_000_005_000,
    }


async def post(api, student, events):
    return await api.post(
        "/events", json={"events": events}, headers=auth(str(student.id), Role.student.value),
    )


async def total_xp(api, student) -> int:
    response = await api.get(
        f"/progress/{student.id}", headers=auth(str(student.id), Role.student.value),
    )
    assert response.status_code == 200
    return response.json()["rewardProfile"]["totalXp"]


async def test_a_solved_board_verifies_and_pays_the_advertised_xp(api, learner):
    assert (await post(api, learner, [solve(SOLVED), finished()])).status_code == 200
    # One correct answer (5) + first-try bonus (2) + the skill's completion award (20).
    assert await total_xp(api, learner) == 27


async def test_an_unsolved_board_pays_nothing_however_it_is_labelled(api, learner):
    """The client calls it correct; the bottles say otherwise, and the server believes them."""
    assert (await post(api, learner, [solve(UNSOLVED), finished()])).status_code == 200
    assert await total_xp(api, learner) == 0


async def test_a_board_that_invented_liquid_pays_nothing(api, learner):
    cheated = [["cyan"] * 3, ["magenta"] * 3, ["gold"] * 3]
    assert (await post(api, learner, [solve(cheated), finished()])).status_code == 200
    assert await total_xp(api, learner) == 0


async def test_the_answer_key_never_reaches_the_client(api, learner):
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == RELEASE)
    entry = release.question_manifest[0]
    assert entry["grading"]["keys"] == {"liquidSortLayers": LAYERS}
    assert "liquidSortLayers" not in entry["playable"]["config"]


async def test_replaying_the_same_board_in_one_session_does_not_pay_twice(api, learner):
    await post(api, learner, [solve(SOLVED), finished()])
    once = await total_xp(api, learner)
    repeat = solve(SOLVED, event_id="a1-again")
    await post(api, learner, [repeat, finished()])
    assert await total_xp(api, learner) == once
