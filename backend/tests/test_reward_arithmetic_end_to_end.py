"""XP, levels and streaks, from posted events to the numbers a child sees.

Everything else about rewards is unit-tested. This exists because the parts were each correct
while the whole was not: a curriculum could award nothing, a release could carry different
rewards from its draft, and the only way anyone found out was by reading the database.

So this posts real events through the real endpoint and asserts the exact figures, with the
arithmetic spelled out. If a number here changes, a child's screen changed.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.core.scoring_config import DEFAULT_SCORING_CONFIG
from app.models.assignment import Assignment
from app.models.content import CurriculumRelease, SystemSettings
from app.models.student import Student
from app.models.user import Role, User
from app.core.security import hash_secret

from .conftest import auth

XP = DEFAULT_SCORING_CONFIG["rewards"]["xp"]
XP_PER_LEVEL = DEFAULT_SCORING_CONFIG["rewards"]["level"]["xpPerLevel"]

SKILL = "skill-count-to-10"
RELEASE = "release-under-test"
CURRICULUM = "curriculum-under-test"
REVISION = 1
#: Fixed so events can name the assignment they belong to without plumbing it through.
ASSIGNMENT = "0123456789abcdef01234567"
TECHNIQUE = "COUNT_ON"
TARGET_COUNT = 3


def question(index: int) -> dict:
    return {
        "question_id": f"q{index}", "skill_id": SKILL, "difficulty": "easy",
        "content_hash": f"h{index}",
        "playable": {"technique": TECHNIQUE, "targetCount": TARGET_COUNT},
    }


@pytest_asyncio.fixture
async def learner(database):
    """A learner on a release that authors no rewards of its own — the common case."""
    parent = User(
        email="p@example.com", name="P", password_hash=hash_secret("correct-horse-battery"),
        role=Role.parent.value, family_code="FAM111",
    )
    await parent.insert()
    student = Student(name="Robin", guardian_parent_ids=[str(parent.id)])
    await student.insert()
    await CurriculumRelease(
        release_id=RELEASE, curriculum_id=CURRICULUM, revision=1,
        owner_id=str(parent.id), published_by=str(parent.id),
        tree={
            "title": "Under test", "grades": [], "subjects": [],
            "units": [{"id": "u1", "subjectId": "s1", "label": "Unit"}],
            "skills": [{"id": SKILL, "unitId": "u1", "label": "Count to 10"}],
        },
        question_manifest=[question(i) for i in range(1, 6)],
        asset_manifest=[],
        content_hashes={"tree": "t", "questions": "q", "assets": "a"},
    ).insert()
    from beanie import PydanticObjectId
    await Assignment(
        id=PydanticObjectId(ASSIGNMENT),
        student_id=str(student.id), curriculum_id=CURRICULUM, release_id=RELEASE,
        grade_id="grade-1", status="active", placement_required=False,
        owner_id=str(parent.id),
    ).insert()
    return student


def attempt(index: int, *, day: str, session: str, first_try: bool = True) -> dict:
    """One correct answer. `first_try` decides whether the bonus applies."""
    return {
        "id": f"{session}-a{index}-{int(first_try)}",
        "eventType": "attempt", "technique": TECHNIQUE, "outcome": "correct",
        # The claimed outcome above is not taken at its word: the server re-grades against
        # the released question, so it is the answer here that decides.
        "selected": TARGET_COUNT,
        "questionId": f"q{index}", "curriculumSkillId": SKILL,
        "curriculumId": CURRICULUM, "releaseId": RELEASE, "sessionId": session,
        # Events are bound to the exact release revision they were played against — the
        # guarantee that a learner's history cannot be rewritten by a later edit.
        "curriculumRevision": REVISION, "assignmentId": ASSIGNMENT,
        "attemptNumber": 1 if first_try else 2,
        "hintUsedBeforeAttempt": False,
        "occurredAt": f"{day}T10:0{index}:00+00:00",
        "clientTimestampMs": 1_800_000_000_000 + index * 1000,
    }


def completion(*, day: str, session: str, assignment_id: str) -> dict:
    return {
        "id": f"{session}-done", "eventType": "lesson_complete",
        "curriculumSkillId": SKILL, "curriculumId": CURRICULUM,
        "releaseId": RELEASE, "sessionId": session, "curriculumRevision": REVISION,
        "assignmentId": assignment_id,
        "occurredAt": f"{day}T10:30:00+00:00",
        "clientTimestampMs": 1_800_000_000_000 + 99_000,
    }


async def post(api, student: Student, events: list[dict]):
    return await api.post(
        "/events", json={"events": events},
        headers=auth(str(student.id), Role.student.value),
    )


async def profile(api, student: Student) -> dict:
    response = await api.get(
        f"/progress/{student.id}", headers=auth(str(student.id), Role.student.value),
    )
    assert response.status_code == 200
    return response.json()["rewardProfile"]


# ── XP ──────────────────────────────────────────────────────────────────────────

async def test_one_finished_activity_pays_exactly_the_advertised_amount(api, learner):
    """5 correct first-try answers plus a completion, with the sum written out."""
    events = [attempt(i, day="2026-07-20", session="s1") for i in range(1, 6)]
    events.append(completion(day="2026-07-20", session="s1", assignment_id=ASSIGNMENT))
    assert (await post(api, learner, events)).status_code == 200

    expected = 5 * XP["correctAnswer"] + 5 * XP["firstTryBonus"] + XP["activityCompletion"]
    assert expected == 42, "the shipped economics changed — docs/rewards.md needs updating"
    assert (await profile(api, learner))["totalXp"] == expected


async def test_a_second_attempt_earns_the_answer_but_not_the_bonus(api, learner):
    await post(api, learner, [attempt(1, day="2026-07-20", session="s1", first_try=False)])
    assert (await profile(api, learner))["totalXp"] == XP["correctAnswer"]


async def test_answering_the_same_question_twice_does_not_pay_twice(api, learner):
    """Otherwise a learner could farm XP by replaying one question."""
    await post(api, learner, [attempt(1, day="2026-07-20", session="s1")])
    once = (await profile(api, learner))["totalXp"]

    repeat = attempt(1, day="2026-07-20", session="s1")
    repeat["id"] = "different-client-id"
    await post(api, learner, [repeat])
    assert (await profile(api, learner))["totalXp"] == once


async def test_a_learner_who_has_played_nothing_has_nothing(api, learner):
    assert (await profile(api, learner))["totalXp"] == 0


# ── levels ──────────────────────────────────────────────────────────────────────

async def test_a_completed_session_is_worth_about_one_level(api, learner):
    """The claim docs/rewards.md makes to justify 120 per level."""
    events: list[dict] = []
    for index, session in enumerate(("s1", "s2", "s3")):
        events += [attempt(i, day="2026-07-20", session=session) for i in range(1, 6)]
        events.append(completion(day="2026-07-20", session=session, assignment_id=ASSIGNMENT))
    await post(api, learner, events)

    total = (await profile(api, learner))["totalXp"]
    assert total == 126
    assert XP_PER_LEVEL <= total < XP_PER_LEVEL * 2, "a session should be worth one level"


async def test_level_reports_progress_toward_the_next(api, learner):
    await post(api, learner, [attempt(1, day="2026-07-20", session="s1")])
    # One first-try correct answer: the answer plus the bonus.
    earned = XP["correctAnswer"] + XP["firstTryBonus"]
    level = (await profile(api, learner))["level"]
    assert level["number"] == 1
    assert level["currentXp"] == earned
    assert level["xpToNext"] == XP_PER_LEVEL - earned


# ── streaks ─────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def settings(database):
    doc = SystemSettings()
    await doc.insert()
    return doc


def days_ago(count: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=count)).strftime("%Y-%m-%d")


async def signal(api, student: Student) -> dict:
    response = await api.get(
        f"/progress/{student.id}/activity-signal",
        headers=auth(str(student.id), Role.student.value),
    )
    assert response.status_code == 200
    return response.json()


async def test_three_consecutive_days_is_a_streak_of_three(api, learner, settings):
    events = [
        attempt(1, day=days_ago(offset), session=f"s{offset}")
        for offset in (2, 1, 0)
    ]
    await post(api, learner, events)
    assert (await signal(api, learner))["currentStreakDays"] == 3


async def test_two_sessions_in_one_day_is_still_one_day(api, learner, settings):
    """A streak counts days practised, not sessions — otherwise it rewards sitting still."""
    await post(api, learner, [
        attempt(1, day=days_ago(0), session="morning"),
        attempt(2, day=days_ago(0), session="evening"),
    ])
    assert (await signal(api, learner))["currentStreakDays"] == 1


async def test_a_long_gap_ends_the_streak(api, learner, settings):
    await post(api, learner, [
        attempt(1, day=days_ago(30), session="old"),
        attempt(2, day=days_ago(29), session="old2"),
        attempt(3, day=days_ago(0), session="today"),
    ])
    assert (await signal(api, learner))["currentStreakDays"] == 1


async def test_a_learner_who_has_played_nothing_has_no_streak(api, learner, settings):
    assert (await signal(api, learner))["currentStreakDays"] == 0



