"""Pure Phase 2 recommendation engine.

The engine accepts plain dictionaries and performs no I/O. Persistence and
question hydration live in the router, keeping ranking deterministic and easy to
replay from a RecommendationRun snapshot.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..content.placement import ordered_skills


ENGINE_REVISION = "recommendation-1"
LEVEL_ORDER = {"not_started": 0, "beginner": 1, "developing": 2, "proficient": 3, "master": 4}
BUCKET_ORDER = {"reinforce": 0, "review": 1, "new": 2, "stretch": 3}


def _due(state: dict[str, Any], now: datetime) -> bool:
    value = state.get("next_review_at")
    if value is None:
        return False
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= now


def _interleave(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Round-robin assignment/subject lanes after priority ordering."""
    lanes: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for candidate in sorted(
        candidates,
        key=lambda item: (item["priority"], item["bucket_rank"], item["skill_order"], item["skill_id"]),
    ):
        lanes.setdefault((candidate["assignment_id"], candidate.get("subject_id") or ""), []).append(candidate)
    lane_keys = sorted(
        lanes,
        key=lambda key: (lanes[key][0]["priority"], key[0], key[1]),
    )
    output: list[dict[str, Any]] = []
    while any(lanes.values()):
        for key in lane_keys:
            if lanes[key]:
                output.append(lanes[key].pop(0))
    return output


def _public_item(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        key: candidate[key]
        for key in (
            "assignment_id", "release_id", "curriculum_id", "skill_id", "skill_label",
            "unit_id", "subject_id", "kind", "reason", "optional", "question_count",
        )
    }


def recommend(
    *,
    assignments: list[dict[str, Any]],
    mastery_states: list[dict[str, Any]],
    progressions: list[dict[str, Any]],
    skipped_keys: set[tuple[str, str]],
    config: dict[str, Any],
    now: datetime | None = None,
    completed_keys: set[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    """Rank a deterministic, assignment-balanced queue for one student."""
    now = now or datetime.now(timezone.utc)
    mastery = {
        (item.get("curriculum_id"), item.get("skill_id")): item
        for item in mastery_states
    }
    progression = {item.get("assignment_id"): item for item in progressions}
    reinforce_threshold = float(config.get("reinforce_threshold", 0.6))
    candidates: list[dict[str, Any]] = []

    for assignment in sorted(assignments, key=lambda item: (item.get("priority", 100), item["id"])):
        tree = assignment["tree"]
        skills = ordered_skills(tree, assignment.get("scope"))
        available = set(assignment.get("available_skill_ids") or [])
        skills = [skill for skill in skills if skill.get("id") in available]
        if not skills:
            continue
        state = progression.get(assignment["id"]) or {}
        eligible = set(state.get("eligible_skill_ids") or [])
        for key, score in mastery.items():
            if key[0] == assignment["curriculum_id"] and score.get("level", "not_started") != "not_started":
                eligible.add(key[1])

        frontier_id = state.get("frontier_skill_id")
        frontier_index = next((index for index, skill in enumerate(skills) if skill.get("id") == frontier_id), 0)
        if frontier_id is None and state.get("eligible_skill_ids"):
            frontier_index = max(0, len(skills) - 1)

        units = {item.get("id"): item for item in tree.get("units", [])}
        for index, skill in enumerate(skills):
            skill_id = skill["id"]
            score = mastery.get((assignment["curriculum_id"], skill_id), {})
            level = score.get("level", "not_started")
            kind: str | None = None
            reason = ""
            if _due(score, now) and (float(score.get("score", 0)) < reinforce_threshold or score.get("last_review_outcome") == "unsuccessful"):
                kind = "reinforce"
                reason = "Needs reinforcement before moving on"
            elif _due(score, now) and LEVEL_ORDER.get(level, 0) >= LEVEL_ORDER["developing"]:
                kind = "review"
                reason = "Due for review"
            elif level == "not_started" and skill_id not in eligible and index >= frontier_index:
                prerequisites = set(skill.get("prerequisiteSkillIds") or [])
                if prerequisites <= eligible:
                    kind = "new"
                    reason = "Next skill at your learning frontier"

            unit = units.get(skill.get("unitId"), {})
            candidate = {
                "assignment_id": assignment["id"],
                "release_id": assignment["release_id"],
                "curriculum_id": assignment["curriculum_id"],
                "skill_id": skill_id,
                "skill_label": skill.get("label") or skill.get("name") or skill_id,
                "unit_id": skill.get("unitId"),
                "subject_id": unit.get("subjectId"),
                "kind": kind or "stretch",
                "reason": reason or "Optional practice to keep moving",
                "optional": True,
                "question_count": int(assignment.get("question_counts", {}).get(skill_id, 0)),
                "priority": assignment.get("priority", 100),
                "skill_order": index,
                "bucket_rank": BUCKET_ORDER[kind or "stretch"],
                "excluded": None,
            }
            key = (assignment["id"], skill_id)
            if key in (completed_keys or set()):
                candidate["excluded"] = "completed_session"
            elif key in skipped_keys:
                candidate["excluded"] = "skip_cooldown"
            candidates.append(candidate)

    active = [candidate for candidate in candidates if not candidate["excluded"]]
    session_size = max(1, min(10, int(config.get("skills_per_session", 3))))
    max_non_new = max(0, min(session_size, int(config.get("max_non_new", 2))))
    new_items = _interleave([item for item in active if item["kind"] == "new"])
    non_new = _interleave([item for item in active if item["kind"] in {"reinforce", "review"}])
    stretches = _interleave([item for item in active if item["kind"] == "stretch"])

    non_new_limit = min(max_non_new, session_size - 1) if new_items else min(max_non_new, session_size)
    served = non_new[:non_new_limit]
    served_keys = {(item["assignment_id"], item["skill_id"]) for item in served}
    for item in new_items:
        if len(served) >= session_size:
            break
        key = (item["assignment_id"], item["skill_id"])
        if key not in served_keys:
            served.append(item)
            served_keys.add(key)
    # Stretch is a dead-end fallback, never padding beside a valid plan item.
    if not served and stretches:
        item = sorted(stretches, key=lambda candidate: (candidate["priority"], -candidate["skill_order"], candidate["skill_id"]))[0]
        served.append(item)

    return {
        "engine_revision": ENGINE_REVISION,
        "candidates": candidates,
        "served_items": [_public_item(item) for item in served],
    }
