"""Authoritative learning-event contract (Phase 0, item 4).

Client events arrive camelCase and loosely typed (analyticsLogger / logSchema.ts).
They are *diagnostic* until their correctness-critical fields are normalized to a
canonical snake_case shape and validated — that canonical, verified form is what
the scoring and recommendation engines are allowed to replay.

This module is that normalizer: pure and database-free, so it is unit-testable and
reusable by both live ingest and the legacy backfill. It reads either camelCase
(live client) or snake_case (already-stored legacy) source keys.

Key rule: a bad event is **not dropped**. The log is append-only. An event that
fails validation is stored `verified=False` with the reason, so the record is kept
but excluded from authoritative mastery. Only `verified` events drive scoring.
"""

from __future__ import annotations

from typing import Any

CURRENT_SCHEMA_VERSION = 1

EVENT_TYPES = frozenset({
    "session_start", "session_end", "slide_view", "attempt",
    "hint_requested", "slide_reset", "lesson_complete", "recommendation_skipped",
})
OUTCOMES = frozenset({"correct", "incorrect", "partial"})
DIFFICULTIES = frozenset({"easy", "medium", "hard"})
# Event types that must reference a specific question.
QUESTION_EVENTS = frozenset({"slide_view", "attempt", "hint_requested"})


class EventContractError(ValueError):
    """A raw event violates the authoritative contract (kept, but not verified)."""


# camelCase source key -> canonical snake_case column
FIELD_MAP: dict[str, str] = {
    "schemaVersion": "schema_version",
    "sessionId": "session_id",
    "occurredAt": "occurred_at",
    "clientTimestampMs": "client_timestamp_ms",
    "eventType": "event_type",
    "outcome": "outcome",
    "attemptNumber": "attempt_number",
    "hintUsedBeforeAttempt": "hint_used_before_attempt",
    "timeOnTaskMs": "time_on_task_ms",
    "questionId": "question_id",
    "technique": "technique",
    "subjectArea": "subject_area",
    "curriculumSkillId": "curriculum_skill_id",
    "curriculumId": "curriculum_id",
    "curriculumRevision": "curriculum_revision",
    "releaseId": "release_id",
    "assignmentId": "assignment_id",
    "slideIndex": "slide_index",
    "totalSlides": "total_slides",
}

CANONICAL_FIELDS: frozenset[str] = frozenset(FIELD_MAP.values()) | {"difficulty"}


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _read(raw: dict, camel: str, snake: str) -> Any:
    """Prefer the camelCase (live) key; fall back to snake (already-stored legacy)."""
    if camel in raw:
        return raw[camel]
    return raw.get(snake)


def to_canonical(raw: dict) -> dict:
    """Map a raw event (camel or snake source keys) to canonical snake fields.
    No validation here — just the shape."""
    out = {snake: _read(raw, camel, snake) for camel, snake in FIELD_MAP.items()}
    difficulty = raw.get("difficulty")
    if difficulty is None:
        difficulty = (raw.get("details") or {}).get("difficulty")
    out["difficulty"] = difficulty
    return out


def validate_canonical(c: dict) -> None:
    """Raise EventContractError on any correctness-critical violation."""
    event_type = c["event_type"]
    if event_type not in EVENT_TYPES:
        raise EventContractError(f"unknown event_type {event_type!r}")

    if not _is_int(c["client_timestamp_ms"]):
        raise EventContractError("client_timestamp_ms must be an integer (ms)")

    if event_type == "attempt":
        if c["outcome"] not in OUTCOMES:
            raise EventContractError("attempt requires an outcome of correct/incorrect/partial")
    elif c["outcome"] is not None:
        raise EventContractError(f"{event_type} must not carry an outcome")

    if c["difficulty"] is not None and c["difficulty"] not in DIFFICULTIES:
        raise EventContractError(f"invalid difficulty {c['difficulty']!r}")

    if event_type in QUESTION_EVENTS and not c["question_id"]:
        raise EventContractError(f"{event_type} requires a questionId")

    attempt_number = c["attempt_number"]
    if attempt_number is not None and (not _is_int(attempt_number) or attempt_number < 1):
        raise EventContractError("attempt_number must be a positive integer")


def normalize_event(raw: dict) -> dict:
    """Canonical fields plus `verified`/`verification_error`. Never raises — an
    invalid event is returned `verified=False` so the caller stores it anyway."""
    canonical = to_canonical(raw)
    try:
        validate_canonical(canonical)
        canonical["verified"] = True
        canonical["verification_error"] = None
    except EventContractError as exc:
        canonical["verified"] = False
        canonical["verification_error"] = str(exc)
    return canonical


def validate_release_binding(
    canonical: dict,
    *,
    release_id: str,
    curriculum_id: str,
    revision: int,
    question_manifest: list[dict],
) -> None:
    """Verify a curriculum-tagged event against one immutable release."""
    if canonical.get("release_id") != release_id:
        raise EventContractError("releaseId does not match the published release")
    if canonical.get("curriculum_id") != curriculum_id:
        raise EventContractError("curriculumId does not match the published release")
    if canonical.get("curriculum_revision") != revision:
        raise EventContractError("curriculumRevision does not match the published release")

    question_id = canonical.get("question_id")
    entry = next((item for item in question_manifest if item.get("question_id") == question_id), None)
    if entry is None:
        raise EventContractError("questionId is not present in the published release")
    if canonical.get("curriculum_skill_id") != entry.get("skill_id"):
        raise EventContractError("curriculumSkillId does not match the released question")
    released_technique = (entry.get("playable") or {}).get("technique")
    if canonical.get("technique") != released_technique:
        raise EventContractError("technique does not match the released question")
