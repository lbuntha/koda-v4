"""A sorted shelf, from posted events to the XP a child is shown.

The sibling file for Liquid Sort exists because that path failed in production twice —
once with no registered grader, so every attempt was stored unverified and the activity
could never complete, and once with the solved board never reaching the server at all.
Unit tests were green both times, because every piece worked and the chain did not.

Goods Sort is the same chain with the same failure modes available to it, so it gets the
same cover: a release built by the real `build_release_payload`, events posted to the real
`/events` endpoint, XP read back from the real progress endpoint.

The board here is **the level the seed actually ships** — its goods counts are read from
`scripts/data/goods_sort_levels.json`, the file the seed authors from. Inventing a fixture
board would leave the interesting question unasked: whether the level a child is given can
be graded by the grader that will grade it.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest_asyncio
from beanie import PydanticObjectId

from app.core.security import hash_secret
from app.features.content.release import build_release_payload
from app.models.assignment import Assignment
from app.models.content import CurriculumRelease
from app.models.student import Student
from app.models.user import Role, User

from .conftest import auth

CURRICULUM = "goods-sort-under-test"
RELEASE = "goods-sort-release"
REVISION = 1
ASSIGNMENT = "0123456789abcdef01234569"
SKILL = "skill-first-delivery"
QUESTION = "q-first-delivery"
COMPLETION_XP = 20

LEVELS = json.loads(
    (Path(__file__).resolve().parents[1] / "scripts" / "data" / "goods_sort_levels.json")
    .read_text(encoding="utf-8")
)
LEVEL = next(level for level in LEVELS if level["id"] == "level_1")
COUNTS: dict[str, int] = LEVEL["counts"]
KINDS = list(COUNTS)


def sorted_shelf() -> list[list[str]]:
    """Every kind gathered into a compartment of its own, spare compartments left empty —
    the shape `GoodsSortCanvas` reports, one list per compartment including the empties."""
    gathered = [[kind] * count for kind, count in COUNTS.items()]
    return gathered + [[] for _ in range(LEVEL["shelves"] - len(gathered))]


def tree() -> dict:
    return {
        "title": "Goods sort under test",
        "grades": [{"id": "grade-1", "order": 1}],
        "subjects": [{"id": "logic", "gradeId": "grade-1", "order": 1}],
        "units": [{"id": "u1", "subjectId": "logic", "label": "Goods Shelf Sort", "order": 1}],
        "skills": [{
            "id": SKILL, "unitId": "u1", "label": "Group two kinds of goods", "order": 1,
            "completionXp": COMPLETION_XP,
            "presentation": {"title": "First Delivery"},
        }],
        # The economics scripts/seed_grade1_thinking_logic.py authors, so the figures below
        # are the ones the shipped ladder pays, not the platform fallback.
        "rewards": {
            "quest": {"label": "Sorting quest", "activitiesPerSession": 2},
            "xp": {"correctAnswer": 5, "firstTryBonus": 2, "activityCompletion": 20},
            "level": {"xpPerLevel": 120},
            "achievements": [],
        },
    }


def question() -> dict:
    return {
        "id": QUESTION, "curriculumId": CURRICULUM, "skillId": SKILL,
        "technique": "GOODS_SORT", "difficulty": "easy", "targetCount": LEVEL["kinds"],
        "config": {
            "levelId": LEVEL["id"],
            "difficultyTier": LEVEL["difficultyTier"],
            "goodsSortCounts": COUNTS,
        },
    }


@pytest_asyncio.fixture
async def learner(database):
    parent = User(
        email="shelver@example.com", name="P", password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value, family_code="FAM333",
    )
    await parent.insert()
    student = Student(name="Sam", guardian_parent_ids=[str(parent.id)])
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


def solve(shelf, *, session="s1", event_id="a1") -> dict:
    """What the canvas reports when a board is finished."""
    return {
        "id": event_id, "eventType": "attempt", "technique": "GOODS_SORT",
        # Claimed by the client and deliberately not trusted: the shelf below decides.
        "outcome": "correct", "selected": shelf,
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


async def test_a_sorted_shelf_verifies_and_pays_the_advertised_xp(api, learner):
    assert (await post(api, learner, [solve(sorted_shelf()), finished()])).status_code == 200
    # One correct answer (5) + first-try bonus (2) + the skill's completion award (20).
    assert await total_xp(api, learner) == 27


async def test_the_shelf_the_level_opens_with_pays_nothing(api, learner):
    """The board as authored is unsorted by construction, and the client calling it correct
    does not change that."""
    unsorted = [
        [item["typeKey"] if isinstance(item, dict) else item for item in shelf]
        for shelf in _opening_shelf()
    ]
    assert (await post(api, learner, [solve(unsorted), finished()])).status_code == 200
    assert await total_xp(api, learner) == 0


def _opening_shelf() -> list[list[str]]:
    """The level's own starting arrangement, rebuilt from its counts.

    The export does not carry the board layout — only the counts, which is all the grader
    needs — so this reproduces an unsorted arrangement holding exactly those goods: one of
    each kind per compartment, which cannot be a solved board while more than one kind
    exists.
    """
    spread = [list(KINDS) for _ in range(COUNTS[KINDS[0]])]
    return spread + [[] for _ in range(LEVEL["shelves"] - len(spread))]


async def test_a_kind_split_across_two_compartments_is_not_sorted(api, learner):
    """Every compartment holds one kind here, and the board is still unfinished — three
    chips in two compartments is the case a naive "each compartment is uniform" check
    passes and a child would rightly dispute."""
    first, second = KINDS[0], KINDS[1]
    split = [[first] * (COUNTS[first] - 1), [first], [second] * COUNTS[second]]
    split += [[] for _ in range(LEVEL["shelves"] - len(split))]
    assert (await post(api, learner, [solve(split), finished()])).status_code == 200
    assert await total_xp(api, learner) == 0


async def test_a_shelf_that_invented_goods_pays_nothing(api, learner):
    cheated = [[kind] * count for kind, count in COUNTS.items()] + [["diamond"] * 3]
    cheated += [[] for _ in range(LEVEL["shelves"] - len(cheated))]
    assert (await post(api, learner, [solve(cheated), finished()])).status_code == 200
    assert await total_xp(api, learner) == 0


async def test_the_answer_key_never_reaches_the_client(api, learner):
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == RELEASE)
    entry = release.question_manifest[0]
    assert entry["grading"]["keys"] == {"goodsSortCounts": COUNTS}
    assert "goodsSortCounts" not in entry["playable"]["config"]


async def test_replaying_the_same_shelf_in_one_session_does_not_pay_twice(api, learner):
    await post(api, learner, [solve(sorted_shelf()), finished()])
    once = await total_xp(api, learner)
    repeat = solve(sorted_shelf(), event_id="a1-again")
    await post(api, learner, [repeat, finished()])
    assert await total_xp(api, learner) == once
