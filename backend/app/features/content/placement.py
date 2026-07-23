"""Deterministic placement generation and scoring from an immutable release."""

from __future__ import annotations

import hashlib
from typing import Any

from .grading import ARITHMETIC, COUNTING, GradingError, grade


GENERATOR_REVISION = 1
DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}


class PlacementError(ValueError):
    pass


def _ordered_skills(tree: dict[str, Any], scope: dict[str, Any] | None = None) -> list[dict]:
    grade_order = {item.get("id"): item.get("order", 0) for item in tree.get("grades", [])}
    subjects = {
        item.get("id"): (grade_order.get(item.get("gradeId"), 0), item.get("order", 0))
        for item in tree.get("subjects", [])
    }
    units = {
        item.get("id"): (*subjects.get(item.get("subjectId"), (0, 0)), item.get("order", 0))
        for item in tree.get("units", [])
    }
    skills = sorted(
        tree.get("skills", []),
        key=lambda item: (*units.get(item.get("unitId"), (0, 0, 0)), item.get("order", 0)),
    )
    scope = scope or {"kind": "all", "ids": []}
    kind = scope.get("kind", "all")
    ids = set(scope.get("ids") or [])
    if kind == "all" or not ids:
        return skills
    if kind == "skills":
        return [skill for skill in skills if skill.get("id") in ids]
    if kind == "units":
        return [skill for skill in skills if skill.get("unitId") in ids]
    if kind == "grades":
        subject_ids = {
            item.get("id") for item in tree.get("subjects", [])
            if item.get("gradeId") in ids
        }
        unit_ids = {
            item.get("id") for item in tree.get("units", [])
            if item.get("subjectId") in subject_ids
        }
        return [skill for skill in skills if skill.get("unitId") in unit_ids]
    raise PlacementError(f"Unknown assignment scope kind {kind!r}")


def _checkpoint_skills(skills: list[dict], checkpoints_only: bool) -> list[dict]:
    if not checkpoints_only:
        return skills
    flagged = [skill for skill in skills if skill.get("placementCheckpoint") is True]
    if flagged:
        return flagged
    seen_units: set[str] = set()
    fallback = []
    for skill in skills:
        if skill.get("unitId") not in seen_units:
            seen_units.add(skill.get("unitId"))
            fallback.append(skill)
    return fallback


def select_delivery_skill_ids(
    tree: dict[str, Any],
    scope: dict[str, Any] | None,
    frontier_skill_id: str | None,
    eligible_skill_ids: list[str] | None,
    available_skill_ids: set[str],
) -> list[str]:
    """Choose the first post-placement skill that can actually be played.

    Phase 1 deliberately delivers one skill worksheet at the placement frontier.
    The recommendation queue that mixes new/review work is Phase 2. If placement
    passed every checkpoint (no frontier), keep the learner at the last in-scope
    skill for a short confirmation rather than silently jumping to unrelated
    global content.
    """
    ordered_ids = [skill.get("id") for skill in _ordered_skills(tree, scope) if skill.get("id")]
    playable = [skill_id for skill_id in ordered_ids if skill_id in available_skill_ids]
    if not playable:
        return []

    if frontier_skill_id in ordered_ids:
        frontier_index = ordered_ids.index(frontier_skill_id)
        at_or_after = [skill_id for skill_id in ordered_ids[frontier_index:] if skill_id in available_skill_ids]
        return at_or_after[:1] if at_or_after else playable[-1:]

    if eligible_skill_ids:
        return playable[-1:]
    return playable[:1]


def build_placement(release: dict, scope: dict[str, Any] | None, config: dict[str, Any], seed: str) -> dict:
    tree = release.get("tree") or {}
    skills = _ordered_skills(tree, scope)
    checkpoints = _checkpoint_skills(skills, bool(config.get("checkpoints_only", True)))
    cap = int(config.get("checkpoint_cap", 8))
    if len(checkpoints) > cap:
        indexes = [round(index * (len(checkpoints) - 1) / (cap - 1)) for index in range(cap)] if cap > 1 else [0]
        checkpoints = [checkpoints[index] for index in indexes]
    checkpoint_ids = {skill.get("id") for skill in checkpoints}
    questions_by_skill: dict[str, list[dict]] = {}
    for entry in release.get("question_manifest", []):
        skill_id = entry.get("skill_id")
        if skill_id not in checkpoint_ids:
            continue
        technique = (entry.get("playable") or {}).get("technique")
        if technique not in COUNTING and technique not in ARITHMETIC:
            continue
        try:
            grade(entry, 0)
        except GradingError as exc:
            if "incorrect" not in str(exc):
                continue
        questions_by_skill.setdefault(skill_id, []).append(entry)

    per_skill = max(1, min(2, int(config.get("per_skill", 2))))
    manifest = []
    for skill in checkpoints:
        skill_id = skill.get("id")
        candidates = sorted(
            questions_by_skill.get(skill_id, []),
            key=lambda entry: (DIFFICULTY_ORDER.get(entry.get("difficulty", "medium"), 1), entry.get("question_id", "")),
        )
        if len(candidates) > per_skill:
            offset = int(hashlib.sha256(f"{seed}:{skill_id}".encode()).hexdigest()[:8], 16) % len(candidates)
            candidates = [candidates[(offset + index) % len(candidates)] for index in range(per_skill)]
        for entry in candidates:
            manifest.append({
                "index": len(manifest),
                "question_id": entry.get("question_id"),
                "skill_id": skill_id,
                "difficulty": entry.get("difficulty", "medium"),
                "content_hash": entry.get("content_hash"),
            })
    return {
        "generator_revision": int(config.get("generator_revision", GENERATOR_REVISION)),
        "seed": seed,
        "item_manifest": manifest,
        "skill_order": [skill.get("id") for skill in skills],
    }


def compute_placement(responses: list[dict], release: dict, item_manifest: list[dict], pass_threshold: float) -> dict:
    entries = {entry.get("question_id"): entry for entry in release.get("question_manifest", [])}
    allowed = {item.get("question_id"): item for item in item_manifest}
    seen: set[str] = set()
    scores: dict[str, list[float]] = {}
    normalized = []
    for response in responses:
        question_id = response.get("questionId") or response.get("question_id")
        if question_id in seen or question_id not in allowed or question_id not in entries:
            raise PlacementError("Responses must contain each served question at most once")
        seen.add(question_id)
        outcome = grade(entries[question_id], response.get("selection"))
        value = 1.0 if outcome == "correct" else 0.5 if outcome == "partial" else 0.0
        skill_id = allowed[question_id].get("skill_id")
        scores.setdefault(skill_id, []).append(value)
        normalized.append({"question_id": question_id, "selection": response.get("selection"), "outcome": outcome})
    score_by_skill = {skill_id: round(sum(values) / len(values), 4) for skill_id, values in scores.items()}
    ordered = []
    for item in item_manifest:
        skill_id = item.get("skill_id")
        if skill_id not in ordered:
            ordered.append(skill_id)
    passed = {skill_id for skill_id, score in score_by_skill.items() if score >= pass_threshold}
    frontier = next((skill_id for skill_id in ordered if skill_id not in passed), None)
    eligible = [skill_id for skill_id in ordered if skill_id in passed and (frontier is None or ordered.index(skill_id) < ordered.index(frontier))]
    return {
        "responses": normalized,
        "score_by_skill": score_by_skill,
        "frontier_skill_id": frontier,
        "eligible_skill_ids": eligible,
    }
