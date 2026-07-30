"""Resolve grade/subject curriculum offerings and legacy assignment subjects."""

from __future__ import annotations

from typing import Any

from ...models.assignment import CurriculumOffering
from ...models.academic import Subject
from ...models.content import CurriculumRelease
from ...models.user import Role, User


def subject_ids_for_grade(tree: dict[str, Any], grade_id: str) -> list[str]:
    return [
        str(item["id"])
        for item in tree.get("subjects", [])
        if item.get("id") and item.get("gradeId") == grade_id
    ]


def release_includes(tree: dict[str, Any], grade_id: str, subject_id: str) -> bool:
    return subject_id in subject_ids_for_grade(tree, grade_id)


def infer_assignment_subject(
    tree: dict[str, Any],
    grade_id: str,
    scope: dict[str, Any] | None = None,
) -> str | None:
    """Infer one subject conservatively; ambiguous legacy rows stay unresolved."""
    candidates = subject_ids_for_grade(tree, grade_id)
    if not candidates:
        return None

    scope = scope or {"kind": "all", "ids": []}
    scope_ids = set(scope.get("ids") or [])
    units = tree.get("units", [])
    skills = tree.get("skills", [])
    unit_subject = {str(unit.get("id")): unit.get("subjectId") for unit in units if unit.get("id")}

    scoped_subjects: set[str] = set()
    if scope.get("kind") == "units":
        scoped_subjects = {str(unit_subject[item]) for item in scope_ids if unit_subject.get(item)}
    elif scope.get("kind") == "skills":
        skill_units = {
            str(skill.get("unitId"))
            for skill in skills
            if skill.get("id") in scope_ids and skill.get("unitId")
        }
        scoped_subjects = {str(unit_subject[item]) for item in skill_units if unit_subject.get(item)}
    if len(scoped_subjects) == 1:
        subject_id = next(iter(scoped_subjects))
        return subject_id if subject_id in candidates else None
    if len(scoped_subjects) > 1:
        return None

    primary = tree.get("primarySubjectId")
    if primary in candidates:
        return str(primary)
    return candidates[0] if len(candidates) == 1 else None


async def resolve_release(grade_id: str, subject_id: str) -> CurriculumRelease | None:
    """Return the configured release, with a safe matching-release fallback.

    The fallback preserves existing installations that have published content
    but have not created offering rows yet. It is deliberately constrained to
    the requested grade and subject; it never uses a global "latest release".
    """
    offering = await CurriculumOffering.find_one(
        CurriculumOffering.grade_id == grade_id,
        CurriculumOffering.subject_id == subject_id,
        CurriculumOffering.active == True,
    )
    if offering:
        release = await CurriculumRelease.find_one(
            CurriculumRelease.release_id == offering.release_id,
            CurriculumRelease.curriculum_id == offering.curriculum_id,
        )
        if release and release_includes(release.tree, grade_id, subject_id):
            return release

    admin_ids = [
        str(item.id)
        for item in await User.find(User.role == Role.admin).to_list()
    ]
    if not admin_ids:
        return None
    releases = await CurriculumRelease.find(
        {
            "owner_id": {"$in": admin_ids},
            "tree.subjects": {
                "$elemMatch": {"id": subject_id, "gradeId": grade_id},
            }
        }
    ).sort("-published_at").to_list()
    return next((item for item in releases if release_includes(item.tree, grade_id, subject_id)), None)


async def canonical_subject_ids(grade_id: str, requested_ids: list[str]) -> tuple[list[str], list[str]]:
    """Map profile choices to canonical catalog keys for a grade.

    Exact keys are preferred. Code/name aliases retain compatibility with old
    clients that sent values such as ``math`` before keys became grade-specific.
    """
    rows = await Subject.find(Subject.grade_id == grade_id, Subject.active == True).to_list()
    by_key = {item.key.lower(): item.key for item in rows}
    by_alias: dict[str, str] = {}
    for item in rows:
        for alias in (item.code, item.name):
            normalized = "".join(character for character in alias.lower() if character.isalnum())
            if normalized:
                by_alias.setdefault(normalized, item.key)

    resolved: list[str] = []
    unknown: list[str] = []
    for raw in requested_ids:
        value = raw.strip()
        normalized = "".join(character for character in value.lower() if character.isalnum())
        subject_id = by_key.get(value.lower()) or by_alias.get(normalized)
        if not subject_id:
            unknown.append(value)
        elif subject_id not in resolved:
            resolved.append(subject_id)
    return resolved, unknown
