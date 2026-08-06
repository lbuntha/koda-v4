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
        "developing": {"minPlays": 5},
        "proficient": {"minPlays": 10, "minSessions": 2, "minHardPlays": 2},
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
    # What a learner has to do for a day to count towards their streak.
    #
    # The default is `attempt`: answering at least one question. Historically the streak
    # counted *any* event, so opening an activity and leaving kept it alive — attendance
    # rather than practice, next to labels that read as practice.
    "streak": {
        "counts": "attempt",          # any | attempt | lesson_complete
        "min_events_per_day": 1,      # qualifying events a day needs to count
        "grace_days": 1,              # how stale the newest active day may be before it resets
    },
    # What playing is worth, for every curriculum that does not say otherwise.
    #
    # These used to be authored per curriculum with a zero fallback, so a curriculum whose
    # author never filled the form awarded nothing — silently, with no error and a counter
    # that never moved. Two of three curricula on the first real database were in that state.
    # Rewards now work the same way as the streak and recommendation settings above: set once
    # here, inherited everywhere, overridable per curriculum when a course genuinely needs
    # different economics.
    #
    # Sized against a real Grade 1 course: 5 questions per skill at 4 + 2, plus 12 for
    # finishing, is 42 XP a skill and 126 for a three-activity session — so 120 per level is
    # one level per completed quest, and about ten levels across a thirty-skill year.
    "rewards": {
        "xp": {"correctAnswer": 4, "firstTryBonus": 2, "activityCompletion": 12},
        "level": {"xpPerLevel": 120},
    },
    # Global kill switches for the automated notification types. Turning one off
    # stops new notifications of that kind from being generated; it does not
    # retract ones already sent. A parent's own per-account opt-outs (the weekly
    # digest email, announcement emails) live on `User`, not here — these are the
    # admin-level "does this feature exist at all" switches.
    "notifications": {
        "auto_achievement_enabled": True,
        "auto_streak_enabled": True,
        "auto_weekly_digest_enabled": True,
        "weekly_digest_day": "sun",  # mon|tue|wed|thu|fri|sat|sun
        "streak_milestones": [3, 7, 14, 30, 60, 100],
        # One grouped note when skills come due for review — never one per skill,
        # which at a realistic backlog would fire five to ten times a day.
        "auto_review_enabled": True,
        # A parent hears once when a learner who had been practising goes quiet.
        "auto_inactivity_enabled": True,
        "inactivity_days": 7,
        # A locked PIN is a dead end the child cannot escape and no adult is told
        # about; this is the only notification treated as an account alert.
        "auto_pin_lockout_enabled": True,
    },
}


def default_scoring_config() -> dict[str, Any]:
    return copy.deepcopy(DEFAULT_SCORING_CONFIG)
