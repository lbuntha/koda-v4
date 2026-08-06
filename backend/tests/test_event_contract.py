"""Unit tests for the authoritative event contract (features/events/contract.py).

Pure logic, no database. Verifies camel→snake normalization, camel/snake source
reading (for legacy backfill), and that correctness-critical violations mark an
event `verified=False` (kept, not dropped) rather than crashing ingest.
"""

import pytest

from app.features.events.contract import (
    EventContractError,
    normalize_event,
    to_canonical,
    validate_canonical,
    validate_release_binding,
)


def _attempt(**over):
    base = {
        "id": "evt-1",
        "schemaVersion": 1,
        "sessionId": "s1",
        "occurredAt": "2026-07-20T10:00:00.000Z",
        "clientTimestampMs": 1_753_005_600_000,
        "eventType": "attempt",
        "outcome": "correct",
        "attemptNumber": 1,
        "questionId": "q1",
        "curriculumSkillId": "count-to-10",
        "details": {"difficulty": "hard"},
    }
    base.update(over)
    return base


# ── Normalization ────────────────────────────────────────────────────────────────

def test_camel_maps_to_snake_canonical():
    c = to_canonical(_attempt())
    assert c["event_type"] == "attempt"
    assert c["session_id"] == "s1"
    assert c["client_timestamp_ms"] == 1_753_005_600_000
    assert c["curriculum_skill_id"] == "count-to-10"
    assert c["difficulty"] == "hard"          # lifted from details.difficulty


def test_top_level_difficulty_wins_over_details():
    c = to_canonical(_attempt(difficulty="easy", details={"difficulty": "hard"}))
    assert c["difficulty"] == "easy"


def test_snake_source_keys_are_read_for_backfill():
    # a legacy row already stored snake_case should normalize too
    legacy = {"event_type": "attempt", "outcome": "correct", "attempt_number": 1,
              "question_id": "q1", "client_timestamp_ms": 123}
    c = to_canonical(legacy)
    assert c["event_type"] == "attempt"
    assert c["question_id"] == "q1"
    assert c["client_timestamp_ms"] == 123


# ── Validation → verified flag ───────────────────────────────────────────────────

def test_valid_attempt_is_verified():
    n = normalize_event(_attempt())
    assert n["verified"] is True
    assert n["verification_error"] is None


def test_attempt_without_outcome_is_unverified_not_dropped():
    n = normalize_event(_attempt(outcome=None))
    assert n["verified"] is False
    assert "outcome" in n["verification_error"]


def test_non_attempt_with_outcome_is_unverified():
    n = normalize_event({
        "eventType": "slide_view", "questionId": "q1",
        "clientTimestampMs": 1, "outcome": "correct",
    })
    assert n["verified"] is False
    assert "must not carry an outcome" in n["verification_error"]


def test_unknown_event_type_is_unverified():
    n = normalize_event({"eventType": "teleport", "clientTimestampMs": 1})
    assert n["verified"] is False


def test_question_event_requires_question_id():
    n = normalize_event({"eventType": "attempt", "outcome": "correct", "clientTimestampMs": 1})
    assert n["verified"] is False
    assert "questionId" in n["verification_error"]


def test_missing_timestamp_is_unverified():
    n = normalize_event(_attempt(clientTimestampMs=None))
    assert n["verified"] is False


def test_bad_explicit_difficulty_is_unverified():
    n = normalize_event(_attempt(difficulty="spicy"))
    assert n["verified"] is False
    assert "difficulty" in n["verification_error"]


def test_technique_specific_detail_is_not_mistaken_for_curriculum_difficulty():
    n = normalize_event(_attempt(details={"difficulty": "guided"}))
    assert n["verified"] is True
    assert n["difficulty"] is None


def test_bad_attempt_number_is_unverified():
    n = normalize_event(_attempt(attemptNumber=0))
    assert n["verified"] is False


def test_session_lifecycle_events_need_no_question():
    for et in ("session_start", "session_end", "lesson_complete"):
        n = normalize_event({"eventType": et, "clientTimestampMs": 5})
        assert n["verified"] is True, et


def test_validate_canonical_raises_directly():
    with pytest.raises(EventContractError):
        validate_canonical(to_canonical({"eventType": "attempt", "clientTimestampMs": 1, "questionId": "q"}))


def test_release_binding_accepts_exact_manifest_identity():
    canonical = to_canonical(_attempt(
        curriculumId="curr-1",
        curriculumRevision=3,
        releaseId="rel-1",
        technique="ONE_TO_ONE",
    ))
    validate_release_binding(
        canonical,
        release_id="rel-1",
        curriculum_id="curr-1",
        revision=3,
        question_manifest=[{
            "question_id": "q1",
            "skill_id": "count-to-10",
            "playable": {"technique": "ONE_TO_ONE"},
        }],
    )


@pytest.mark.parametrize(
    "override,error",
    [
        ({"releaseId": "fake"}, "releaseId"),
        ({"curriculumId": "fake"}, "curriculumId"),
        ({"curriculumRevision": 4}, "curriculumRevision"),
        ({"questionId": "fake"}, "questionId"),
        ({"curriculumSkillId": "fake"}, "curriculumSkillId"),
        ({"technique": "COUNT_ON"}, "technique"),
    ],
)
def test_release_binding_rejects_fabricated_identity(override, error):
    raw = _attempt(
        curriculumId="curr-1",
        curriculumRevision=3,
        releaseId="rel-1",
        technique="ONE_TO_ONE",
    )
    raw.update(override)
    canonical = to_canonical(raw)
    with pytest.raises(EventContractError, match=error):
        validate_release_binding(
            canonical,
            release_id="rel-1",
            curriculum_id="curr-1",
            revision=3,
            question_manifest=[{
                "question_id": "q1",
                "skill_id": "count-to-10",
                "playable": {"technique": "ONE_TO_ONE"},
            }],
        )
