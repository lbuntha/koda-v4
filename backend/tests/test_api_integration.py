"""End-to-end checks over the real app, real routers, and a real database.

Each of these targets a defect class the pure suite structurally cannot see. Every one of
them shipped at some point through a fully green unit suite:

* a thumbnail URL built with an invented `/api` prefix that no router served;
* an assignment's `grade_id` never reaching the code that scopes a learner's path by grade;
* a `MasteryState` datetime written into a string field, which failed only on read-back;
* endpoints whose authorization was never exercised at all.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.models.assignment import Assignment, Placement, ProgressionState
from app.models.content import CurriculumRelease
from app.models.event import LearningEvent
from app.models.mastery import MasteryState
from app.models.user import Role, User
from app.core.security import hash_secret

from .conftest import auth

CURRICULUM = "c-int"
RELEASE = "r-int-1"
ASSET = "custom_svg_int"
SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4"/></svg>'


def _tree() -> dict:
    return {
        "title": "Integration fixture",
        "grades": [
            {"id": "grade-1", "label": "Grade 1", "order": 1},
            {"id": "grade-2", "label": "Grade 2", "order": 2},
        ],
        "subjects": [
            {"id": "g1-math", "gradeId": "grade-1", "label": "Math", "order": 1},
            {"id": "g2-math", "gradeId": "grade-2", "label": "Math", "order": 1},
        ],
        "units": [
            {"id": "u1", "subjectId": "g1-math", "label": "Counting", "order": 1},
            {"id": "u2", "subjectId": "g2-math", "label": "Grade 2 work", "order": 1},
        ],
        "skills": [
            {"id": "s1", "unitId": "u1", "label": "Count to 10", "order": 1, "minQuestions": 1,
             "presentation": {"title": "Count to 10", "thumbnailAssetId": ASSET}},
            {"id": "s2", "unitId": "u1", "label": "Count to 20", "order": 2, "minQuestions": 1,
             "prerequisiteSkillIds": ["s1"]},
            {"id": "g2s1", "unitId": "u2", "label": "Grade 2 skill", "order": 1, "minQuestions": 1},
        ],
    }


def _question(question_id: str, skill_id: str) -> dict:
    return {
        "question_id": question_id,
        "skill_id": skill_id,
        "difficulty": "easy",
        "playable": {"id": question_id, "technique": "MOVE_AND_COUNT", "title": "Count",
                     "skillId": skill_id, "targetCount": 5, "config": {}},
        "grading": {"technique": "MOVE_AND_COUNT", "config": {}},
        "content_hash": f"sha256:{question_id}",
    }


@pytest_asyncio.fixture
async def release(database) -> CurriculumRelease:
    doc = CurriculumRelease(
        release_id=RELEASE, curriculum_id=CURRICULUM, owner_id="owner-1", revision=1,
        tree=_tree(),
        question_manifest=[_question("q1", "s1"), _question("q2", "s2"), _question("q3", "g2s1")],
        asset_manifest=[{"asset_id": ASSET, "snapshot": {"id": ASSET, "markup": SVG},
                         "content_hash": "sha256:asset"}],
        content_hashes={"tree": "sha256:tree", "questions": "sha256:q", "assets": "sha256:a"},
        published_by="owner-1",
    )
    await doc.insert()
    return doc


@pytest_asyncio.fixture
async def assigned(database, release, adult, learner) -> Assignment:
    """A placement-complete Grade 1 assignment — the state a learner actually plays in."""
    assignment = Assignment(
        owner_id=str(adult.id), student_id=str(learner.id), curriculum_id=CURRICULUM,
        release_id=RELEASE, grade_id="grade-1", scope={"kind": "all", "ids": []},
        mode="scheduled", priority=100, placement_required=True,
    )
    await assignment.insert()
    await ProgressionState(
        student_id=str(learner.id), assignment_id=str(assignment.id),
        curriculum_id=CURRICULUM, release_id=RELEASE,
        frontier_skill_id="s1", eligible_skill_ids=[], placement_status="completed",
    ).insert()
    return assignment


# ── authorization ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "path",
    ["/learning/today", "/learning/path", "/svg-assets", "/svg-assets/usage", "/assignments"],
)
async def test_endpoints_reject_anonymous_callers(api, path):
    assert (await api.get(path)).status_code == 401


async def test_a_learner_cannot_read_another_learners_progress(api, database, learner, adult):
    from app.models.student import Student
    other = Student(name="Someone Else")
    await other.insert()

    mine = await api.get(f"/progress/{learner.id}", headers=auth(str(learner.id), Role.student.value))
    theirs = await api.get(f"/progress/{other.id}", headers=auth(str(learner.id), Role.student.value))

    assert mine.status_code == 200
    assert theirs.status_code in (401, 403, 404)


# ── artwork delivery ────────────────────────────────────────────────────────────

async def test_published_artwork_is_served_at_the_url_the_api_hands_out(api, assigned, learner):
    """The URL in the payload must be one this app actually routes.

    It was once built with an invented `/api` prefix; unit tests asserted the string and
    passed, while every learner card showed a broken image.
    """
    today = await api.get("/learning/today", headers=auth(str(learner.id), Role.student.value))
    assert today.status_code == 200
    item = next(row for row in today.json()["queue"] if row["skillId"] == "s1")

    served = await api.get(item["thumbnailUrl"])
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in served.text


async def test_a_missing_asset_is_a_404_not_a_broken_image(api, release):
    assert (await api.get(f"/learning/assets/{RELEASE}/nope")).status_code == 404


# ── grade scoping ───────────────────────────────────────────────────────────────

async def test_the_path_is_scoped_to_the_assigned_grade(api, assigned, learner):
    """`scope={"kind":"all"}` means the whole release, which spans grades.

    `grade_id` was validated at assign time and then never passed to the walk, so a Grade 1
    learner would have been walked into Grade 2 skills.
    """
    response = await api.get("/learning/path", headers=auth(str(learner.id), Role.student.value))
    assert response.status_code == 200
    path = response.json()["paths"][0]

    assert path["gradeId"] == "grade-1"
    walked = [skill["skillId"] for unit in path["units"] for skill in unit["skills"]]
    assert walked == ["s1", "s2"]
    assert "g2s1" not in walked


async def test_the_path_reports_a_status_for_every_skill(api, assigned, learner):
    response = await api.get("/learning/path", headers=auth(str(learner.id), Role.student.value))
    statuses = {
        skill["skillId"]: skill["status"]
        for unit in response.json()["paths"][0]["units"] for skill in unit["skills"]
    }
    assert statuses == {"s1": "new", "s2": "pending"}


# ── assignment release upgrade ──────────────────────────────────────────────────

async def test_an_assignment_can_be_moved_to_a_newer_release(api, assigned, adult, database):
    newer = CurriculumRelease(
        release_id="r-int-2", curriculum_id=CURRICULUM, owner_id="owner-1", revision=2,
        tree=_tree(), question_manifest=[_question("q1", "s1")], asset_manifest=[],
        content_hashes={"tree": "sha256:tree", "questions": "sha256:q", "assets": "sha256:a"},
        published_by="owner-1",
    )
    await newer.insert()

    response = await api.patch(
        f"/assignments/{assigned.id}",
        json={"release_id": "r-int-2"},
        headers=auth(str(adult.id), Role.parent.value),
    )
    assert response.status_code == 200
    assert (await Assignment.get(assigned.id)).release_id == "r-int-2"


# ── removing an assignment ──────────────────────────────────────────────────────

async def test_removing_an_assignment_takes_its_placement_and_progression_with_it(
    api, assigned, adult, learner, database,
):
    """Pausing only stops an assignment being served; there was no way to remove one at all.

    Placement and progression are keyed uniquely on (student, assignment) and mean nothing
    without it, so they go too — otherwise they linger as rows answering a question about an
    assignment that no longer exists.
    """
    # The fixture already carries a completed progression; this adds the placement
    # result that produced it.
    await Placement(
        student_id=str(learner.id), assignment_id=str(assigned.id), grade_id="g1",
        curriculum_id=CURRICULUM, release_id=RELEASE, generator_revision=1, scoring_revision=1,
    ).insert()

    response = await api.delete(
        f"/assignments/{assigned.id}",
        headers=auth(str(adult.id), Role.parent.value),
    )
    assert response.status_code == 200
    assert response.json()["placements"] == 1
    assert response.json()["progressions"] == 1

    assert await Assignment.get(assigned.id) is None
    assert await Placement.find(Placement.assignment_id == str(assigned.id)).count() == 0
    assert await ProgressionState.find(ProgressionState.assignment_id == str(assigned.id)).count() == 0


async def test_removing_an_assignment_keeps_the_play_history(api, assigned, adult, learner, database):
    """XP, levels and streaks are replayed from events rather than stored.

    Deleting them with the assignment would silently rewrite what a child has done — the work
    happened, so the record stays.
    """
    await LearningEvent(
        student_id=str(learner.id), assignment_id=str(assigned.id), owner_id=str(adult.id),
        curriculum_id=CURRICULUM, release_id=RELEASE, skill_id="s1", question_id="q1",
        event_type="attempt", outcome="correct",
    ).insert()

    response = await api.delete(
        f"/assignments/{assigned.id}",
        headers=auth(str(adult.id), Role.parent.value),
    )
    assert response.status_code == 200
    assert response.json()["eventsKept"] == 1
    assert await LearningEvent.find(LearningEvent.assignment_id == str(assigned.id)).count() == 1


async def test_another_familys_assignment_cannot_be_removed(api, assigned, database):
    stranger = User(
        email="stranger@example.com", name="Stranger",
        password_hash=hash_secret("correct-horse-battery"), role=Role.parent.value,
    )
    await stranger.insert()

    response = await api.delete(
        f"/assignments/{assigned.id}",
        headers=auth(str(stranger.id), Role.parent.value),
    )
    assert response.status_code == 404
    assert await Assignment.get(assigned.id) is not None


async def test_a_release_from_another_curriculum_is_refused(api, assigned, adult, database):
    foreign = CurriculumRelease(
        release_id="r-other", curriculum_id="some-other", owner_id="owner-1", revision=1,
        tree=_tree(), question_manifest=[], asset_manifest=[],
        content_hashes={"tree": "sha256:tree", "questions": "sha256:q", "assets": "sha256:a"},
        published_by="owner-1",
    )
    await foreign.insert()

    response = await api.patch(
        f"/assignments/{assigned.id}",
        json={"release_id": "r-other"},
        headers=auth(str(adult.id), Role.parent.value),
    )
    assert response.status_code == 400
    # The pin must be untouched after a rejected upgrade.
    assert (await Assignment.get(assigned.id)).release_id == RELEASE


# ── persistence shapes ──────────────────────────────────────────────────────────

async def test_a_mastery_row_survives_a_write_then_read(database, learner):
    """Beanie validates on read, not on attribute assignment.

    A datetime assigned to `last_practiced_at` (an ISO *string*) saved without complaint and
    only blew up the next time anything loaded it.
    """
    now = datetime.now(timezone.utc)
    await MasteryState(
        student_id=str(learner.id), curriculum_id=CURRICULUM, skill_id="s1",
        level="developing", score=0.7,
        last_practiced_at=now.isoformat(),
        next_review_at=now + timedelta(days=1),
    ).insert()

    loaded = await MasteryState.find_one(MasteryState.student_id == str(learner.id))
    assert isinstance(loaded.last_practiced_at, str)
    assert isinstance(loaded.next_review_at, datetime)
    assert loaded.level == "developing"


async def test_progress_and_activity_signal_answer_for_a_real_learner(api, assigned, learner):
    headers = auth(str(learner.id), Role.student.value)

    progress = await api.get(f"/progress/{learner.id}", headers=headers)
    signal = await api.get(f"/progress/{learner.id}/activity-signal", headers=headers)

    assert progress.status_code == 200
    assert signal.status_code == 200
    assert {skill["skillId"] for skill in progress.json()["skills"]} == {"s1", "s2"}
    # No events yet, so no streak — and it must be a number, not null.
    assert signal.json()["currentStreakDays"] == 0
