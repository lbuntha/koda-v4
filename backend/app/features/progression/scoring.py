"""Server-authoritative proficiency engine (Phase 0, item 5).

A faithful Python port of the reference implementation in
`frontend/src/services/scoringEngine.ts`. The backend — not the client — decides
a student's mastery level; the frontend engine is a preview/reference and the
source of the shared fixtures both must satisfy (see `shared/scoring-fixtures.json`
and the parity tests). Given one `ScoringConfig` and one set of attempt events,
this must produce the same `level`, `score`, and scheduling outputs as the TS
engine, bit-for-bit within rounding.

Scope boundary: this computes the *authoritative* outputs (level, score,
retention, "due"). The human-readable "what's left to the next rung" coaching
text stays a frontend concern (`toNextLevel`) and is intentionally not ported.

Events here use the same field names as the TS `LearningEvent` (camelCase):
`eventType, outcome, attemptNumber, hintUsedBeforeAttempt, timeOnTaskMs,
sessionId, occurredAt, clientTimestampMs, details.difficulty`. Phase 4's ingest
path adapts stored Mongo events (snake_case) into this shape.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ...core.scoring_config import DEFAULT_SCORING_CONFIG, default_scoring_config

# Bumped when the engine's algorithm changes shape (not on config edits). Stamped
# onto every projected mastery_state so a row's provenance is explainable and a
# re-score job can find rows produced by an older engine.
ENGINE_REVISION = "scoring-2"

MASTERY_ORDER = ["not_started", "beginner", "developing", "proficient", "master"]

_DAY_MS = 24 * 60 * 60 * 1000


def default_config() -> dict[str, Any]:
    """A fresh, mutable copy of the defaults — never hand out the shared singleton."""
    return default_scoring_config()


# ── Small helpers (mirror the TS ones exactly) ──────────────────────────────────

def _clamp01(n: float) -> float:
    return 0.0 if n < 0 else 1.0 if n > 1 else n


def _is_number(v: Any) -> bool:
    # JS `typeof x === "number"` — and in Python a bool is an int subclass, so
    # exclude it explicitly to match the TS behavior.
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _median(nums: list[float]) -> float:
    if not nums:
        return 0
    s = sorted(nums)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


def _difficulty_of(e: dict) -> str | None:
    d = (e.get("details") or {}).get("difficulty")
    return d if d in ("easy", "medium", "hard") else None


def _is_scorable(e: dict) -> bool:
    return e.get("eventType") == "attempt" and bool(e.get("outcome"))


def _iso_to_ms(iso: str) -> int:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return round(dt.timestamp() * 1000)


# ── Components ──────────────────────────────────────────────────────────────────

def compute_components(attempts: list[dict], config: dict = DEFAULT_SCORING_CONFIG) -> dict:
    total = len(attempts)
    if not total:
        return {
            "components": {"firstTryAccuracy": 0, "overallAccuracy": 0, "independence": 0,
                           "speedScore": 0, "speedMeasured": False},
            "score": 0.0, "plays": 0, "correctFirstTry": 0,
        }

    numbered = [e for e in attempts if _is_number(e.get("attemptNumber"))]
    first_attempts = [e for e in attempts if e.get("attemptNumber") == 1] if numbered else attempts
    plays = len(first_attempts) or total
    correct_first_try = sum(1 for e in first_attempts if e.get("outcome") == "correct")
    first_try_accuracy = correct_first_try / plays if plays else 0

    overall_accuracy = sum(1 for e in attempts if e.get("outcome") == "correct") / total
    hint_rate = sum(1 for e in attempts if e.get("hintUsedBeforeAttempt")) / total
    independence = 1 - hint_rate

    times = [e["timeOnTaskMs"] for e in attempts if _is_number(e.get("timeOnTaskMs"))]
    speed_measured = len(times) > 0
    med = _median(times)
    speed_score = _clamp01(config["speedBaselineMs"] / med) if (speed_measured and med > 0) else 0

    w = config["weights"]
    parts = [(w["firstTry"], first_try_accuracy), (w["accuracy"], overall_accuracy),
             (w["independence"], independence)]
    if speed_measured:
        parts.append((w["speed"], speed_score))
    total_w = sum(weight for weight, _ in parts)
    score = _clamp01(sum(weight * value for weight, value in parts) / total_w)

    return {
        "components": {
            "firstTryAccuracy": first_try_accuracy, "overallAccuracy": overall_accuracy,
            "independence": independence, "speedScore": speed_score, "speedMeasured": speed_measured,
        },
        "score": score, "plays": plays, "correctFirstTry": correct_first_try,
    }


# ── Level derivation ────────────────────────────────────────────────────────────

def _meets_developing(s: dict, c: dict) -> bool:
    return s["score"] >= c["developingScore"] and s["plays"] >= c["gates"]["developing"]["minPlays"]


def _meets_proficient(s: dict, c: dict) -> bool:
    g = c["gates"]["proficient"]
    hard_ok = (not s["difficultyTagged"]) or s["hardPlays"] >= g["minHardPlays"]
    return (
        s["score"] >= c["proficientScore"]
        and s["plays"] >= g["minPlays"]
        and s["sessions"] >= g["minSessions"]
        and hard_ok
    )


def _meets_master(s: dict, c: dict) -> bool:
    g = c["gates"]["master"]
    hard_ok = (not s["difficultyTagged"]) or s["hardPlays"] >= g["minHardPlays"]
    return (
        _meets_proficient(s, c)
        and s["score"] >= c["masterScore"]
        and s["plays"] >= g["minPlays"]
        and s["distinctDays"] >= g["minDistinctDays"]
        and s["recentScore"] >= g["minRecentScore"]
        and hard_ok
    )


def derive_level(s: dict, c: dict) -> str:
    if s["plays"] == 0:
        return "not_started"
    if _meets_master(s, c):
        return "master"
    if _meets_proficient(s, c):
        return "proficient"
    if _meets_developing(s, c):
        return "developing"
    return "beginner"


# ── Public: score one skill's events ────────────────────────────────────────────

def score_skill(
    student_id: str | None,
    skill_id: str,
    events: list[dict],
    config: dict = DEFAULT_SCORING_CONFIG,
    now_ms: int | None = None,
) -> dict:
    now = now_ms if now_ms is not None else round(datetime.now(timezone.utc).timestamp() * 1000)
    attempts = [e for e in events if _is_scorable(e)]

    by_time = sorted(attempts, key=lambda e: e["clientTimestampMs"])
    cc = compute_components(attempts, config)
    score, plays = cc["score"], cc["plays"]

    sessions = len({e.get("sessionId") for e in attempts})
    distinct_days = len({e["occurredAt"][:10] for e in attempts})
    difficulty_tagged = any(_difficulty_of(e) is not None for e in attempts)
    numbered = [e for e in attempts if _is_number(e.get("attemptNumber"))]
    first_attempts = [e for e in attempts if e.get("attemptNumber") == 1] if numbered else attempts
    hard_plays = sum(1 for e in first_attempts if _difficulty_of(e) == "hard")
    hint_rate = (sum(1 for e in attempts if e.get("hintUsedBeforeAttempt")) / len(attempts)) if attempts else 0
    timed = [e["timeOnTaskMs"] for e in attempts if _is_number(e.get("timeOnTaskMs"))]
    avg_time_on_task_ms = (sum(timed) / len(timed)) if timed else 0

    latest_session_id = by_time[-1]["sessionId"] if by_time else None
    recent_attempts = [e for e in attempts if e.get("sessionId") == latest_session_id]
    recent_score = score if sessions <= 1 else compute_components(recent_attempts, config)["score"]
    successful_review_score = config.get("successfulReviewScore", 0.8)
    attempts_by_session: dict[Any, list[dict]] = {}
    for event in by_time:
        attempts_by_session.setdefault(event.get("sessionId"), []).append(event)
    session_reviews = []
    for session_attempts in attempts_by_session.values():
        last_event = max(session_attempts, key=lambda event: event["clientTimestampMs"])
        session_reviews.append({
            "score": compute_components(session_attempts, config)["score"],
            "occurredAt": last_event["occurredAt"],
            "clientTimestampMs": last_event["clientTimestampMs"],
        })
    successful_reviews = [
        review for review in session_reviews if review["score"] >= successful_review_score
    ]
    last_successful_review = (
        max(successful_reviews, key=lambda review: review["clientTimestampMs"])
        if successful_reviews else None
    )
    latest_review = (
        max(session_reviews, key=lambda review: review["clientTimestampMs"])
        if session_reviews else None
    )
    last_successful_review_at = (
        last_successful_review["occurredAt"] if last_successful_review else ""
    )
    last_review_outcome = (
        "successful"
        if latest_review and latest_review["score"] >= successful_review_score
        else "unsuccessful" if latest_review else None
    )

    stats = {
        "score": score, "plays": plays, "sessions": sessions, "distinctDays": distinct_days,
        "hardPlays": hard_plays, "difficultyTagged": difficulty_tagged, "recentScore": recent_score,
    }
    level = derive_level(stats, config)

    last_practiced_at = by_time[-1]["occurredAt"] if by_time else ""
    interval = config["reviewIntervalDays"][level]
    next_review_at_ms: int | None = None
    is_due = False
    review_anchor = last_successful_review_at or last_practiced_at
    if level != "not_started" and review_anchor:
        due = _iso_to_ms(review_anchor) + (interval or 0) * _DAY_MS
        next_review_at_ms = due
        is_due = now >= due

    idx = MASTERY_ORDER.index(level)
    next_level = None if level == "master" else MASTERY_ORDER[idx + 1]

    return {
        "studentId": student_id,
        "skillId": skill_id,
        "level": level,
        "score": score,
        "components": cc["components"],
        "plays": plays,
        "attempts": len(attempts),
        "sessions": sessions,
        "distinctDays": distinct_days,
        "hardPlays": hard_plays,
        "difficultyTagged": difficulty_tagged,
        "hintRate": hint_rate,
        "avgTimeOnTaskMs": avg_time_on_task_ms,
        "recentScore": recent_score,
        "lastPracticedAt": last_practiced_at,
        "lastSuccessfulReviewAt": last_successful_review_at,
        "lastReviewOutcome": last_review_outcome,
        "nextReviewAtMs": next_review_at_ms,
        "isDue": is_due,
        "nextLevel": next_level,
    }
