"""Curriculum-driven quest presentation and replayable XP calculation."""

from __future__ import annotations

from datetime import datetime
from typing import Any


DEFAULT_REWARDS = {
    "quest": {"label": "Today’s quest", "activitiesPerSession": 3},
    # Legacy curricula without admin-authored rewards must not mint XP.
    "xp": {"correctAnswer": 0, "firstTryBonus": 0, "activityCompletion": 0},
    "level": {},
    "achievements": [],
}


def reward_config(tree: dict[str, Any]) -> dict[str, Any]:
    authored = tree.get("rewards") or {}
    return {
        "quest": {**DEFAULT_REWARDS["quest"], **(authored.get("quest") or {})},
        "xp": {**DEFAULT_REWARDS["xp"], **(authored.get("xp") or {})},
        "level": {**DEFAULT_REWARDS["level"], **(authored.get("level") or {})},
        "achievements": authored.get("achievements") or [],
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


def available_xp(tree: dict[str, Any], skill_id: str, question_count: int) -> int:
    config = reward_config(tree)["xp"]
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
        config = reward_config(tree)["xp"]
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
        config = reward_config(tree)["xp"]
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


def _longest_streak(events: list[Any]) -> int:
    days = set()
    for event in events:
        raw = event.occurred_at
        if not raw:
            continue
        try:
            days.add(datetime.fromisoformat(raw.replace("Z", "+00:00")).date())
        except ValueError:
            continue
    longest = run = 0
    previous = None
    for day in sorted(days):
        run = run + 1 if previous and (day - previous).days == 1 else 1
        longest = max(longest, run)
        previous = day
    return longest


def achievement_profile(
    events: list[Any],
    release_trees: dict[str, dict[str, Any]],
    active_curricula: list[tuple[str, dict[str, Any]]],
    mastery_states: list[Any],
) -> dict[str, Any]:
    """Build level and badge progress from verified, replayable learning state."""
    verified = [event for event in events if event.verified]
    all_xp = calculate_xp(verified, release_trees)
    primary_config = reward_config(active_curricula[0][1]) if active_curricula else reward_config({})
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
        curriculum_xp = calculate_xp(curriculum_events, release_trees)["totalXp"]
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
            "streakDays": _longest_streak(curriculum_events),
        }
        for definition in reward_config(tree)["achievements"]:
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
