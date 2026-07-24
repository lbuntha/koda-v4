"""Pure rapid-confirmation frontier movement for Phase 2."""

from __future__ import annotations

from typing import Any

from ..content.placement import ordered_skills


def advance_frontier(
    *,
    tree: dict[str, Any],
    scope: dict[str, Any] | None,
    frontier_skill_id: str | None,
    eligible_skill_ids: list[str],
    confirmed_skill_id: str,
) -> dict[str, Any]:
    """Advance exactly one ordered skill after rapid confirmation.

    This changes sequencing evidence only. It never creates or promotes a
    MasteryState; that remains the Phase 3 proficiency engine's responsibility.
    """
    skills = ordered_skills(tree, scope)
    ids = [skill.get("id") for skill in skills if skill.get("id")]
    if frontier_skill_id != confirmed_skill_id or confirmed_skill_id not in ids:
        return {"changed": False, "frontier_skill_id": frontier_skill_id, "eligible_skill_ids": eligible_skill_ids}
    eligible = set(eligible_skill_ids)
    eligible.add(confirmed_skill_id)
    current = ids.index(confirmed_skill_id)
    next_frontier = None
    for skill in skills[current + 1:]:
        prerequisites = set(skill.get("prerequisiteSkillIds") or [])
        if prerequisites <= eligible:
            next_frontier = skill.get("id")
            break
    return {
        "changed": True,
        "frontier_skill_id": next_frontier,
        "eligible_skill_ids": [skill_id for skill_id in ids if skill_id in eligible],
    }
