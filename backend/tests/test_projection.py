"""Unit tests for the replay/backfill projection (features/progression/projection.py).

Pure logic, no database: backfill planning (which stored events would change) and
the mastery projection (verified events → per-skill mastery via the engine).
"""

from app.features.progression.projection import (
    build_mastery_states,
    needs_backfill,
    plan_backfill,
    plan_projection_drift,
    _to_engine_event,
)
from app.features.events.contract import normalize_event

_BASE_MS = 1_753_005_600_000


def _snake_event(seq, skill="count-10", curriculum="c1", session="s1",
                 day="2026-07-20", difficulty=None, verified=True):
    return {
        "verified": verified,
        "event_type": "attempt", "outcome": "correct", "attempt_number": 1,
        "session_id": session, "occurred_at": f"{day}T10:00:{seq:02d}.000Z",
        "client_timestamp_ms": _BASE_MS + seq, "curriculum_skill_id": skill,
        "curriculum_id": curriculum, "difficulty": difficulty, "client_id": f"e{seq}",
    }


# ── Backfill planning ────────────────────────────────────────────────────────────

def test_legacy_camel_event_needs_backfill():
    legacy = {"eventType": "attempt", "outcome": "correct", "attemptNumber": 1,
              "questionId": "q1", "clientTimestampMs": 5}
    assert needs_backfill(legacy) is True


def test_normalized_event_is_idempotent():
    legacy = {"eventType": "attempt", "outcome": "correct", "attemptNumber": 1,
              "questionId": "q1", "clientTimestampMs": 5}
    normalized = normalize_event(legacy)
    # re-running the contract over an already-normalized row changes nothing
    assert needs_backfill(normalized) is False


def test_plan_backfill_counts_changes_and_verify_flips():
    events = [
        {"eventType": "attempt", "outcome": "correct", "attemptNumber": 1,
         "questionId": "q1", "clientTimestampMs": 5},                      # legacy → verify
        {"eventType": "attempt", "clientTimestampMs": 6, "questionId": "q"},  # invalid → stays unverified
        normalize_event({"eventType": "attempt", "outcome": "correct",
                         "questionId": "q2", "clientTimestampMs": 7}),     # already normalized
    ]
    plan = plan_backfill(events)
    assert plan["scanned"] == 3
    assert plan["would_change"] == 2          # the two non-normalized rows
    assert plan["would_verify"] == 1          # only the valid legacy one becomes verified


# ── Engine-event adapter ─────────────────────────────────────────────────────────

def test_to_engine_event_maps_snake_to_camel():
    e = _snake_event(1, difficulty="hard")
    m = _to_engine_event(e)
    assert m["eventType"] == "attempt"
    assert m["attemptNumber"] == 1
    assert m["clientTimestampMs"] == _BASE_MS + 1
    assert m["details"] == {"difficulty": "hard"}


def test_to_engine_event_derives_missing_occurrence_time_from_client_timestamp():
    event = _snake_event(1)
    event["occurred_at"] = None
    mapped = _to_engine_event(event)
    assert mapped["occurredAt"].startswith("2025-07-20T")
    assert build_mastery_states("stu-1", [event])[0]["distinct_days"] == 1


# ── Projection ───────────────────────────────────────────────────────────────────

def test_build_mastery_states_scores_each_skill():
    events = [_snake_event(i, skill="count-10") for i in range(6)]
    states = build_mastery_states("stu-1", events)
    assert len(states) == 1
    s = states[0]
    assert s["skill_id"] == "count-10"
    assert s["curriculum_id"] == "c1"
    assert s["level"] == "developing"      # 6 clean first-try
    assert s["plays"] == 6
    assert s["engine_revision"] == "scoring-2"
    assert s["last_event_id"] == "e5"      # highest client_timestamp_ms


def test_build_mastery_states_groups_by_skill():
    events = [
        *[_snake_event(i, skill="count-10") for i in range(6)],
        *[_snake_event(10 + i, skill="count-20") for i in range(3)],
    ]
    states = build_mastery_states("stu-1", events)
    assert {s["skill_id"] for s in states} == {"count-10", "count-20"}


def test_build_mastery_states_excludes_unverified_and_skill_less():
    events = [
        *[_snake_event(i, skill="count-10") for i in range(6)],
        _snake_event(20, skill="count-10", verified=False),      # excluded
        {"verified": True, "event_type": "attempt", "outcome": "correct",
         "client_timestamp_ms": 99, "curriculum_skill_id": None},  # no skill → excluded
    ]
    states = build_mastery_states("stu-1", events)
    assert len(states) == 1
    assert states[0]["plays"] == 6          # the unverified 7th did not count


def test_projection_drift_reports_missing_changed_and_extra_rows():
    base = {
        "student_id": "stu-1",
        "curriculum_id": "c1",
        "level": "beginner",
        "score": 0.5,
        "components": {},
        "plays": 2,
        "sessions": 1,
        "distinct_days": 1,
        "hard_plays": 0,
        "recent_score": 0.5,
        "last_event_id": "e2",
        "scoring_revision": 1,
        "engine_revision": "scoring-2",
    }
    expected = [
        {**base, "skill_id": "count"},
        {**base, "skill_id": "add", "level": "developing"},
    ]
    stored = [
        {**base, "skill_id": "count", "score": 0.4},
        {**base, "skill_id": "subtract"},
    ]
    report = plan_projection_drift(expected, stored)
    assert report["expected"] == 2
    assert report["stored"] == 2
    assert report["changed"] == 1
    assert report["missing"] == 1
    assert report["extra"] == 1
    assert report["drifted"] == 3
