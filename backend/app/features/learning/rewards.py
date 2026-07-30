"""Curriculum-driven quest presentation and replayable XP calculation."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .streak import longest_run, streak_days


#: The floor, used only when nothing else is configured at all. Zero on purpose: XP that
#: nobody chose is XP the product invented. In practice the system settings always supply
#: real values (see DEFAULT_SCORING_CONFIG["rewards"]), so this is the last resort rather
#: than the normal case it used to be.
DEFAULT_REWARDS = {
    "quest": {"label": "Today’s quest", "activitiesPerSession": 3},
    "xp": {"correctAnswer": 0, "firstTryBonus": 0, "activityCompletion": 0},
    "level": {},
    "achievements": [],
}


def reward_config(
    tree: dict[str, Any],
    system: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Resolve what playing is worth for one curriculum.

    Three layers, each overriding the one before: the floor above, the admin's system-wide
    settings, then whatever this curriculum authored. A course that says nothing inherits
    working values instead of silently awarding nothing, and a course with unusual economics
    can still say so.

    Achievements are not merged field-by-field — a curriculum either defines its own ladder
    or uses the shared one, because half of one ladder and half of another is not a ladder.
    """
    system = system or {}
    authored = tree.get("rewards") or {}
    return {
        "quest": {
            **DEFAULT_REWARDS["quest"], **(system.get("quest") or {}), **(authored.get("quest") or {}),
        },
        "xp": {
            **DEFAULT_REWARDS["xp"], **(system.get("xp") or {}), **(authored.get("xp") or {}),
        },
        "level": {
            **DEFAULT_REWARDS["level"], **(system.get("level") or {}), **(authored.get("level") or {}),
        },
        "achievements": authored.get("achievements") or system.get("achievements") or [],
    }


def skill_metadata(tree: dict[str, Any], skill_id: str) -> dict[str, Any]:
    skill = next((row for row in tree.get("skills", []) if row.get("id") == skill_id), {})
    presentation = skill.get("presentation") or {}
    return {
        "title": presentation.get("title") or skill.get("label") or skill_id,
        "description": presentation.get("description") or skill.get("description") or "",
        "thumbnailUrl": presentation.get("thumbnailUrl"),
        "thumbnailAssetId": presentation.get("thumbnailAssetId"),
        "accent": presentation.get("accent") or "purple",
        "estimatedMinutes": presentation.get("estimatedMinutes"),
        "completionXp": skill.get("completionXp"),
    }


def available_xp(
    tree: dict[str, Any], skill_id: str, question_count: int,
    system: dict[str, Any] | None = None,
) -> int:
    config = reward_config(tree, system)["xp"]
    skill = skill_metadata(tree, skill_id)
    completion = (
        skill["completionXp"]
        if skill["completionXp"] is not None
        else config["activityCompletion"]
    )
    return int(question_count * (config["correctAnswer"] + config["firstTryBonus"]) + completion)


def calculate_xp(
    events: list[Any],
    release_trees: dict[str, dict[str, Any]],
    system: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Replay verified events into XP; duplicate question/completion awards collapse."""
    correct: dict[tuple, Any] = {}
    completions: dict[tuple, Any] = {}
    for event in sorted(events, key=lambda row: row.client_timestamp_ms or 0):
        if not event.verified or not event.release_id:
            continue
        if event.event_type == "attempt" and event.outcome == "correct" and event.question_id:
            key = (
                event.session_id, event.assignment_id, event.release_id,
                event.curriculum_skill_id, event.question_id,
            )
            correct.setdefault(key, event)
        elif event.event_type == "lesson_complete" and event.curriculum_skill_id:
            key = (
                event.session_id, event.assignment_id, event.release_id,
                event.curriculum_skill_id,
            )
            completions.setdefault(key, event)

    breakdown: dict[tuple[str, str], dict[str, Any]] = {}
    for event in correct.values():
        tree = release_trees.get(event.release_id)
        if not tree:
            continue
        config = reward_config(tree, system)["xp"]
        key = (event.release_id, event.curriculum_skill_id)
        row = breakdown.setdefault(key, {
            "releaseId": event.release_id,
            "skillId": event.curriculum_skill_id,
            "correctXp": 0,
            "firstTryXp": 0,
            "completionXp": 0,
            "totalXp": 0,
        })
        row["correctXp"] += int(config["correctAnswer"])
        if event.attempt_number == 1 and not event.hint_used_before_attempt:
            row["firstTryXp"] += int(config["firstTryBonus"])

    for event in completions.values():
        tree = release_trees.get(event.release_id)
        if not tree:
            continue
        config = reward_config(tree, system)["xp"]
        skill = skill_metadata(tree, event.curriculum_skill_id)
        value = skill["completionXp"]
        if value is None:
            value = config["activityCompletion"]
        key = (event.release_id, event.curriculum_skill_id)
        row = breakdown.setdefault(key, {
            "releaseId": event.release_id,
            "skillId": event.curriculum_skill_id,
            "correctXp": 0,
            "firstTryXp": 0,
            "completionXp": 0,
            "totalXp": 0,
        })
        row["completionXp"] += int(value)

    for row in breakdown.values():
        row["totalXp"] = row["correctXp"] + row["firstTryXp"] + row["completionXp"]
    return {
        "totalXp": sum(row["totalXp"] for row in breakdown.values()),
        "breakdown": list(breakdown.values()),
    }


def achievement_profile(
    events: list[Any],
    release_trees: dict[str, dict[str, Any]],
    active_curricula: list[tuple[str, dict[str, Any]]],
    mastery_states: list[Any],
    streak_config: dict[str, Any] | None = None,
    system_rewards: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build level and badge progress from verified, replayable learning state."""
    verified = [event for event in events if event.verified]
    all_xp = calculate_xp(verified, release_trees, system_rewards)
    primary_config = reward_config(
        active_curricula[0][1] if active_curricula else {}, system_rewards,
    )
    xp_per_level = int(primary_config["level"].get("xpPerLevel") or 0)
    total_xp = int(all_xp["totalXp"])
    current_xp = total_xp % xp_per_level if xp_per_level else 0
    level_number = total_xp // xp_per_level + 1 if xp_per_level else None

    achievements: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for curriculum_id, tree in active_curricula:
        curriculum_events = [
            event for event in verified
            if event.curriculum_id == curriculum_id
        ]
        curriculum_xp = calculate_xp(curriculum_events, release_trees, system_rewards)["totalXp"]
        completions = {
            (
                event.session_id,
                event.assignment_id,
                event.release_id,
                event.curriculum_skill_id,
            )
            for event in curriculum_events
            if event.event_type == "lesson_complete" and event.curriculum_skill_id
        }
        first_try = {
            (
                event.session_id,
                event.release_id,
                event.curriculum_skill_id,
                event.question_id,
            )
            for event in curriculum_events
            if event.event_type == "attempt"
            and event.outcome == "correct"
            and event.attempt_number == 1
            and not event.hint_used_before_attempt
            and event.question_id
        }
        curriculum_mastery = [
            state for state in mastery_states
            if state.curriculum_id == curriculum_id
        ]
        metrics = {
            "xpEarned": int(curriculum_xp),
            "lessonsCompleted": len(completions),
            "firstTryCorrect": len(first_try),
            "proficientSkills": sum(
                state.highest_earned_level in {"proficient", "master"}
                for state in curriculum_mastery
            ),
            "masteredSkills": sum(
                state.highest_earned_level == "master"
                for state in curriculum_mastery
            ),
            # Same day rule as the learner's home chip; longest run rather than current.
            "streakDays": longest_run(streak_days(curriculum_events, streak_config)),
        }
        for definition in reward_config(tree, system_rewards)["achievements"]:
            key = (curriculum_id, definition["id"])
            if key in seen:
                continue
            seen.add(key)
            target = int(definition["target"])
            current = int(metrics.get(definition["metric"], 0))
            achievements.append({
                **definition,
                "curriculumId": curriculum_id,
                "current": current,
                "earned": current >= target,
                "progress": min(1.0, current / target),
            })

    return {
        "totalXp": total_xp,
        "level": ({
            "number": level_number,
            "currentXp": current_xp,
            "xpPerLevel": xp_per_level,
            "xpToNext": xp_per_level - current_xp,
            "progress": current_xp / xp_per_level,
        } if xp_per_level else None),
        "achievements": achievements,
    }
