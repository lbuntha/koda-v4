from datetime import datetime, timedelta, timezone

from app.features.learning.recommendation import recommend


def assignment(assignment_id: str, priority: int = 100):
    return {
        "id": assignment_id,
        "release_id": f"release-{assignment_id}",
        "curriculum_id": f"curriculum-{assignment_id}",
        "priority": priority,
        "scope": {"kind": "all", "ids": []},
        "available_skill_ids": {"count", "add", "subtract"},
        "question_counts": {"count": 2, "add": 2, "subtract": 2},
        "tree": {
            "grades": [{"id": "g1", "order": 1}],
            "subjects": [{"id": "math", "gradeId": "g1", "order": 1}],
            "units": [{"id": "unit", "subjectId": "math", "order": 1}],
            "skills": [
                {"id": "count", "label": "Count", "unitId": "unit", "order": 1},
                {"id": "add", "label": "Add", "unitId": "unit", "order": 2, "prerequisiteSkillIds": ["count"]},
                {"id": "subtract", "label": "Subtract", "unitId": "unit", "order": 3, "prerequisiteSkillIds": ["add"]},
            ],
        },
    }


CONFIG = {"skills_per_session": 3, "max_non_new": 2, "reinforce_threshold": 0.6}


def test_frontier_and_prerequisites_choose_next_new_skill():
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count"]}],
        skipped_keys=set(),
        config=CONFIG,
    )
    assert [(item["kind"], item["skill_id"]) for item in result["served_items"]] == [("new", "add")]


def test_due_reinforcement_keeps_reserved_new_slot():
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[{
            "curriculum_id": "curriculum-a1", "skill_id": "count", "level": "beginner",
            "score": 0.4, "last_review_outcome": "unsuccessful", "next_review_at": now - timedelta(days=1),
        }],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count"]}],
        skipped_keys=set(),
        config=CONFIG,
        now=now,
    )
    served = [(item["kind"], item["skill_id"]) for item in result["served_items"]]
    assert ("reinforce", "count") in served
    assert ("new", "add") in served


def test_started_skill_below_developing_is_continued_not_dropped():
    """A skill in progress and going well must stay in the plan.

    It is not `new` (mastery exists) and not `review` (below developing), so before the
    `continue` bucket existed it fell through to `stretch` and was never served again —
    stalling at beginner because it could never reach the developing gate's play count.
    """
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[{
            "curriculum_id": "curriculum-a1", "skill_id": "count", "level": "beginner",
            "score": 0.72, "last_review_outcome": "successful", "next_review_at": now - timedelta(minutes=5),
        }],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "count", "eligible_skill_ids": []}],
        skipped_keys=set(),
        config=CONFIG,
        now=now,
    )
    assert ("continue", "count") in [(item["kind"], item["skill_id"]) for item in result["served_items"]]


def test_continuation_outranks_an_older_due_review():
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[
            {
                "curriculum_id": "curriculum-a1", "skill_id": "count", "level": "proficient",
                "score": 0.9, "last_review_outcome": "successful", "next_review_at": now - timedelta(days=5),
            },
            {
                "curriculum_id": "curriculum-a1", "skill_id": "add", "level": "beginner",
                "score": 0.7, "last_review_outcome": "successful", "next_review_at": now - timedelta(minutes=5),
            },
        ],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count"]}],
        skipped_keys=set(),
        config={**CONFIG, "max_non_new": 1},
        now=now,
    )
    assert [(item["kind"], item["skill_id"]) for item in result["served_items"]][0] == ("continue", "add")


def test_beginner_mastery_does_not_unlock_a_dependent_skill():
    """Touching `count` once is exposure, not the sequencing evidence `add` requires."""
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[{
            "curriculum_id": "curriculum-a1", "skill_id": "count", "level": "beginner",
            "score": 0.3, "last_review_outcome": "unsuccessful", "next_review_at": now - timedelta(minutes=5),
        }],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "count", "eligible_skill_ids": []}],
        skipped_keys=set(),
        config=CONFIG,
        now=now,
    )
    add = next(item for item in result["candidates"] if item["skill_id"] == "add")
    assert add["kind"] == "stretch"
    assert [item["skill_id"] for item in result["served_items"]] == ["count"]


def test_developing_mastery_unlocks_a_dependent_skill():
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[{
            "curriculum_id": "curriculum-a1", "skill_id": "count", "level": "developing",
            "score": 0.7, "last_review_outcome": "successful", "next_review_at": now + timedelta(days=1),
        }],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "count", "eligible_skill_ids": []}],
        skipped_keys=set(),
        config=CONFIG,
        now=now,
    )
    assert ("new", "add") in [(item["kind"], item["skill_id"]) for item in result["served_items"]]


def test_skip_cooldown_excludes_skill_and_surfaces_next_candidate():
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "add", "eligible_skill_ids": ["count", "add"]}],
        skipped_keys={("a1", "add")},
        config=CONFIG,
    )
    assert all(item["skill_id"] != "add" for item in result["served_items"])
    excluded = next(item for item in result["candidates"] if item["skill_id"] == "add")
    assert excluded["excluded"] == "skip_cooldown"


def test_completed_skill_is_excluded_for_the_current_session():
    result = recommend(
        assignments=[assignment("a1")],
        mastery_states=[],
        progressions=[{
            "assignment_id": "a1",
            "frontier_skill_id": "add",
            "eligible_skill_ids": ["count"],
        }],
        skipped_keys=set(),
        completed_keys={("a1", "add")},
        config=CONFIG,
    )
    assert all(item["skill_id"] != "add" for item in result["served_items"])
    excluded = next(item for item in result["candidates"] if item["skill_id"] == "add")
    assert excluded["excluded"] == "completed_session"


def test_multiple_assignments_round_robin_by_priority():
    result = recommend(
        assignments=[assignment("a1", 10), assignment("a2", 20)],
        mastery_states=[],
        progressions=[
            {"assignment_id": "a1", "frontier_skill_id": "count", "eligible_skill_ids": []},
            {"assignment_id": "a2", "frontier_skill_id": "count", "eligible_skill_ids": []},
        ],
        skipped_keys=set(),
        config={**CONFIG, "skills_per_session": 2},
    )
    assert [item["assignment_id"] for item in result["served_items"]] == ["a1", "a2"]


def _wide_assignment(assignment_id: str = "a1"):
    """Nine ordered skills, chained — the shape a real curriculum has."""
    ids = [f"s{index}" for index in range(9)]
    return {
        "id": assignment_id,
        "release_id": "r1",
        "curriculum_id": "c1",
        "priority": 100,
        "scope": {"kind": "all", "ids": []},
        "available_skill_ids": set(ids),
        "question_counts": {skill_id: 2 for skill_id in ids},
        "tree": {
            "grades": [{"id": "g1", "order": 1}],
            "subjects": [{"id": "math", "gradeId": "g1", "order": 1}],
            "units": [{"id": "unit", "subjectId": "math", "order": 1}],
            "skills": [
                {
                    "id": skill_id,
                    "label": skill_id,
                    "unitId": "unit",
                    "order": index + 1,
                    **({"prerequisiteSkillIds": [ids[index - 1]]} if index else {}),
                }
                for index, skill_id in enumerate(ids)
            ],
        },
    }


def test_a_placement_gap_in_the_middle_is_still_offered():
    """Placement clears checkpoints and leaves gaps; those gaps must stay reachable.

    With no explicit frontier this used to jump to the last skill whenever *anything* was
    eligible, so every earlier skill was excluded and the queue fell through to a stretch.
    """
    result = recommend(
        assignments=[_wide_assignment()],
        mastery_states=[],
        # Placement cleared s0; s1 is the gap it left behind.
        progressions=[{"assignment_id": "a1", "frontier_skill_id": None, "eligible_skill_ids": ["s0"]}],
        skipped_keys=set(),
        config=CONFIG,
    )
    served = [(item["kind"], item["skill_id"]) for item in result["served_items"]]
    assert ("new", "s1") in served
    assert all(kind != "stretch" for kind, _ in served)


def test_an_explicit_frontier_is_still_honoured():
    result = recommend(
        assignments=[_wide_assignment()],
        mastery_states=[],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": "s4", "eligible_skill_ids": ["s0", "s1", "s2", "s3"]}],
        skipped_keys=set(),
        config=CONFIG,
    )
    assert [item["skill_id"] for item in result["served_items"]] == ["s4"]


def test_clearing_everything_still_lands_at_the_end():
    """The case the old fallback was written for: nothing left unproven."""
    every = [f"s{index}" for index in range(9)]
    result = recommend(
        assignments=[_wide_assignment()],
        mastery_states=[],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": None, "eligible_skill_ids": every}],
        skipped_keys=set(),
        config=CONFIG,
    )
    # Every skill is eligible, so none is `new`; the queue degrades to the stretch fallback
    # rather than re-teaching skills placement already cleared.
    assert [item["kind"] for item in result["served_items"]] == ["stretch"]


def test_started_skills_do_not_push_the_frontier_backwards():
    """A skill in progress is served by `continue`, not by rewinding the frontier."""
    now = datetime.now(timezone.utc)
    result = recommend(
        assignments=[_wide_assignment()],
        mastery_states=[{
            "curriculum_id": "c1", "skill_id": "s1", "level": "beginner",
            "score": 0.7, "last_review_outcome": "successful", "next_review_at": now - timedelta(minutes=5),
        }],
        progressions=[{"assignment_id": "a1", "frontier_skill_id": None, "eligible_skill_ids": ["s0"]}],
        skipped_keys=set(),
        config=CONFIG,
        now=now,
    )
    served = dict((item["skill_id"], item["kind"]) for item in result["served_items"])
    assert served.get("s1") == "continue"
    # s2 needs s1, which is only at beginner — not yet proof, so it stays out.
    assert "s2" not in served
