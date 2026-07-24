"""Canonical persisted defaults for the server-authoritative scoring engine."""

from __future__ import annotations

import copy
from typing import Any


DEFAULT_SCORING_CONFIG: dict[str, Any] = {
    "weights": {"firstTry": 0.45, "accuracy": 0.2, "independence": 0.2, "speed": 0.15},
    "developingScore": 0.6,
    "proficientScore": 0.85,
    "masterScore": 0.92,
    "successfulReviewScore": 0.8,
    "gates": {
        "developing": {"minPlays": 6},
        "proficient": {"minPlays": 10, "minSessions": 2, "minHardPlays": 3},
        "master": {
            "minPlays": 15,
            "minDistinctDays": 3,
            "minHardPlays": 3,
            "minRecentScore": 0.9,
        },
    },
    "speedBaselineMs": 8000,
    "reviewIntervalDays": {
        "not_started": None,
        "beginner": 0,
        "developing": 1,
        "proficient": 4,
        "master": 14,
    },
    "placement": {
        "per_skill": 2,
        "checkpoint_cap": 8,
        "pass_threshold": 0.8,
        "checkpoints_only": True,
        "generator_revision": 1,
        "rapid_confirmation_plays": 2,
    },
    "recommendation": {
        "skills_per_session": 3,
        "max_non_new": 2,
        "skip_cooldown_sessions": 1,
        "reinforce_threshold": 0.6,
    },
}


def default_scoring_config() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT_SCORING_CONFIG)
