"""Pure projection + backfill logic behind the replay command (Phase 0, item 8).

Two rebuild concerns, both pure and DB-free so they are unit-testable and safe to
dry-run:

  * **backfill** — re-normalize a stored (possibly legacy) event through the
    authoritative contract and report whether its canonical columns would change.
    `plan_backfill` counts, `apply_backfill_fields` produces the update.
  * **replay** — rebuild the `mastery_states` projection from a student's VERIFIED
    events by running the backend scoring engine. `build_mastery_states` groups by
    (curriculum, skill) and scores each.

`mastery_states` is a pure projection of the event log, which is what makes the
replay rollback-safe: recomputing it can never lose source data, only rebuild the
cache. The command writes idempotently (upsert by student+curriculum+skill).
"""

from __future__ import annotations

from typing import Any

from ..events.contract import CANONICAL_FIELDS, normalize_event
from .scoring import DEFAULT_SCORING_CONFIG, ENGINE_REVISION, score_skill


# ── Backfill ────────────────────────────────────────────────────────────────────

def apply_backfill_fields(stored_event: dict) -> dict:
    """Canonical fields (incl. `verified`) this stored event *should* have."""
    return normalize_event(stored_event)


def needs_backfill(stored_event: dict) -> bool:
    """True if re-normalizing would change any canonical column or the verified flag."""
    fresh = apply_backfill_fields(stored_event)
    return any(stored_event.get(key) != value for key, value in fresh.items())


def plan_backfill(stored_events: list[dict]) -> dict:
    """Dry-run summary: how many stored events would change, and how many would
    flip verified true/false — without writing anything."""
    changed = 0
    to_verified = 0
    to_unverified = 0
    for e in stored_events:
        fresh = apply_backfill_fields(e)
        if any(e.get(k) != v for k, v in fresh.items()):
            changed += 1
        was = bool(e.get("verified"))
        now = bool(fresh["verified"])
        if now and not was:
            to_verified += 1
        elif was and not now:
            to_unverified += 1
    return {
        "scanned": len(stored_events),
        "would_change": changed,
        "would_verify": to_verified,
        "would_unverify": to_unverified,
    }


# ── Replay: events → mastery projection ─────────────────────────────────────────

def _to_engine_event(e: dict) -> dict:
    """Adapt a stored canonical (snake_case) event into the engine's event shape."""
    difficulty = e.get("difficulty")
    return {
        "eventType": e.get("event_type"),
        "outcome": e.get("outcome"),
        "attemptNumber": e.get("attempt_number"),
        "hintUsedBeforeAttempt": e.get("hint_used_before_attempt"),
        "timeOnTaskMs": e.get("time_on_task_ms"),
        "sessionId": e.get("session_id"),
        "occurredAt": e.get("occurred_at"),
        "clientTimestampMs": e.get("client_timestamp_ms"),
        "details": {"difficulty": difficulty} if difficulty else {},
    }


def build_mastery_states(
    student_id: str,
    stored_events: list[dict],
    config: dict = DEFAULT_SCORING_CONFIG,
    now_ms: int | None = None,
    scoring_revision: int = 1,
) -> list[dict]:
    """Rebuild every (curriculum, skill) mastery projection for one student from
    that student's stored events. Only VERIFIED events count — unverifiable rows
    are kept in the log but excluded from authoritative mastery.
    """
    groups: dict[tuple[Any, Any], list[dict]] = {}
    for e in stored_events:
        if not e.get("verified"):
            continue
        skill_id = e.get("curriculum_skill_id")
        if not skill_id:
            continue
        curriculum_id = e.get("curriculum_id")
        groups.setdefault((curriculum_id, skill_id), []).append(e)

    states: list[dict] = []
    for (curriculum_id, skill_id), events in groups.items():
        engine_events = [_to_engine_event(e) for e in events]
        r = score_skill(student_id, skill_id, engine_events, config, now_ms)
        last_event = max(events, key=lambda e: e.get("client_timestamp_ms") or 0)
        states.append({
            "student_id": student_id,
            "skill_id": skill_id,
            "curriculum_id": curriculum_id,
            "level": r["level"],
            "score": r["score"],
            "components": r["components"],
            "plays": r["plays"],
            "sessions": r["sessions"],
            "distinct_days": r["distinctDays"],
            "hard_plays": r["hardPlays"],
            "last_practiced_at": r["lastPracticedAt"] or None,
            "last_successful_review_at": r["lastSuccessfulReviewAt"] or None,
            "last_review_outcome": r["lastReviewOutcome"],
            "recent_score": r["recentScore"],
            "next_review_at_ms": r["nextReviewAtMs"],
            "highest_earned_level": r["level"],
            "scoring_revision": scoring_revision,
            "engine_revision": ENGINE_REVISION,
            "last_event_id": last_event.get("client_id"),
        })
    return states
