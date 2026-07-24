"""Pure comparison helpers for the read-only scoring configuration simulator."""

from __future__ import annotations

from collections import Counter
from typing import Any

from ..progression.scoring import MASTERY_ORDER


def _level_index(level: str) -> int:
    try:
        return MASTERY_ORDER.index(level)
    except ValueError:
        return 0


def compare_mastery_states(
    current_states: list[dict[str, Any]],
    proposed_states: list[dict[str, Any]],
    *,
    student_names: dict[str, str] | None = None,
    now_ms: int,
    sample_limit: int = 100,
) -> dict[str, Any]:
    """Summarize projected level/review changes without mutating a projection."""
    names = student_names or {}

    def key(state: dict[str, Any]) -> tuple[str, str | None, str]:
        return (
            str(state.get("student_id") or ""),
            state.get("curriculum_id"),
            str(state.get("skill_id") or ""),
        )

    current = {key(state): state for state in current_states}
    proposed = {key(state): state for state in proposed_states}
    keys = sorted(set(current) | set(proposed), key=lambda item: tuple(value or "" for value in item))
    transitions: Counter[str] = Counter()
    affected_students: set[str] = set()
    promoted = demoted = review_due_changed = 0
    changes: list[dict[str, Any]] = []
    impacted_keys: set[tuple[str, str | None, str]] = set()

    for item_key in keys:
        before = current.get(item_key, {})
        after = proposed.get(item_key, {})
        before_level = str(before.get("level") or "not_started")
        after_level = str(after.get("level") or "not_started")
        before_due = bool(before.get("next_review_at_ms") and before["next_review_at_ms"] <= now_ms)
        after_due = bool(after.get("next_review_at_ms") and after["next_review_at_ms"] <= now_ms)
        level_changed = before_level != after_level
        due_changed = before_due != after_due
        if not level_changed and not due_changed:
            continue
        impacted_keys.add(item_key)
        student_id, curriculum_id, skill_id = item_key
        affected_students.add(student_id)
        if level_changed:
            transitions[f"{before_level}->{after_level}"] += 1
            if _level_index(after_level) > _level_index(before_level):
                promoted += 1
            else:
                demoted += 1
        if due_changed:
            review_due_changed += 1
        if len(changes) < sample_limit:
            changes.append({
                "studentId": student_id,
                "studentName": names.get(student_id, student_id),
                "curriculumId": curriculum_id,
                "skillId": skill_id,
                "beforeLevel": before_level,
                "afterLevel": after_level,
                "beforeScore": float(before.get("score") or 0),
                "afterScore": float(after.get("score") or 0),
                "beforeDue": before_due,
                "afterDue": after_due,
            })

    return {
        "studentsScanned": len({item[0] for item in keys}),
        "skillsScanned": len(keys),
        "affectedStudents": len(affected_students),
        "changedSkills": sum(transitions.values()),
        "promotedSkills": promoted,
        "demotedSkills": demoted,
        "reviewDueChanged": review_due_changed,
        "unchangedSkills": len(keys) - len(impacted_keys),
        "transitions": [
            {"from": pair.split("->", 1)[0], "to": pair.split("->", 1)[1], "count": count}
            for pair, count in sorted(transitions.items())
        ],
        "sampleChanges": changes,
        "sampleTruncated": len(impacted_keys) > len(changes),
    }


def delivery_impact(current: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    current_recommendation = current.get("recommendation") or {}
    proposed_recommendation = proposed.get("recommendation") or {}
    current_placement = current.get("placement") or {}
    proposed_placement = proposed.get("placement") or {}

    def plan(config: dict[str, Any]) -> dict[str, int]:
        total = int(config.get("skills_per_session", 3))
        non_new = min(total, int(config.get("max_non_new", 2)))
        return {"skills": total, "newSlots": total - non_new, "reviewSlots": non_new}

    return {
        "sessionPlan": {
            "current": plan(current_recommendation),
            "proposed": plan(proposed_recommendation),
        },
        "skipCooldownSessions": {
            "current": int(current_recommendation.get("skip_cooldown_sessions", 1)),
            "proposed": int(proposed_recommendation.get("skip_cooldown_sessions", 1)),
        },
        "placementMaximumItems": {
            "current": int(current_placement.get("per_skill", 1)) * int(current_placement.get("checkpoint_cap", 0)),
            "proposed": int(proposed_placement.get("per_skill", 1)) * int(proposed_placement.get("checkpoint_cap", 0)),
        },
        "placementPassThreshold": {
            "current": float(current_placement.get("pass_threshold", 0)),
            "proposed": float(proposed_placement.get("pass_threshold", 0)),
        },
    }
