"""The curriculum path: every assigned skill, in curriculum order, with its state.

This answers a different question from `recommendation.py`. The recommendation engine picks
a short session plan by pedagogical priority (fix gaps, protect retention, then advance).
This walks the curriculum **A→Z** — grade order, then subject, then unit, then skill — and
labels every skill, so a learner and an adult can see the whole road and where they are on
it. The next card is simply the first skill on that road that still needs work.

Scope is the assignment's, further narrowed to the assignment's own `grade_id`: a release may
carry several grades, and a Grade 1 learner must not be walked into Grade 5 skills because
the assignment was created with `scope={"kind": "all"}`.

Pure function, no I/O: the router supplies mastery and progression rows.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..content.placement import ordered_skills


PATH_REVISION = "path-1"

#: A skill is one of exactly these, and the order is the precedence used to classify it.
COMPLETED = "completed"      # mastered — the trophy is earned
OVERDUE = "overdue"          # learned, but its review date has passed
IN_PROGRESS = "in_progress"  # started, not yet mastered
NEW = "new"                  # unlocked and never attempted
PENDING = "pending"          # locked: an earlier skill has to come first

#: Statuses that still want the learner's attention, in the order the walk offers them.
ACTIONABLE = (OVERDUE, IN_PROGRESS, NEW)

LEVEL_ORDER = {"not_started": 0, "beginner": 1, "developing": 2, "proficient": 3, "master": 4}


def _is_due(state: dict[str, Any], now: datetime) -> bool:
    value = state.get("next_review_at")
    if value is None:
        return False
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= now


def grade_scope(tree: dict[str, Any], scope: dict[str, Any] | None, grade_id: str | None) -> dict[str, Any]:
    """Narrow an assignment scope to one grade.

    `{"kind": "all"}` means "everything in the release", which is only the same thing as
    "everything for this learner" in a single-grade release. Anything more specific the adult
    chose is left alone — they scoped it deliberately.
    """
    if not grade_id:
        return scope or {"kind": "all", "ids": []}
    if scope and scope.get("kind") not in (None, "all"):
        return scope
    return {"kind": "grades", "ids": [grade_id]}


def classify(
    skill: dict[str, Any],
    mastery: dict[str, Any] | None,
    unlocked: set[str],
    now: datetime,
) -> str:
    """One skill's state. `unlocked` is the set of skill ids that count as prerequisites met."""
    state = mastery or {}
    level = state.get("level", "not_started")

    if level == "master":
        return COMPLETED
    if LEVEL_ORDER.get(level, 0) > 0:
        return OVERDUE if _is_due(state, now) else IN_PROGRESS

    # Placement can clear a skill directly, without the learner having worked through the
    # ones before it. Reading such a skill as locked would contradict the checkpoint the
    # learner already passed (docs/progression-design.md §13.2 rule 2).
    skill_id = skill.get("id")
    if skill_id in unlocked:
        return NEW

    prerequisites = set(skill.get("prerequisiteSkillIds") or [])
    return NEW if prerequisites <= unlocked else PENDING


def build_path(
    *,
    assignment: dict[str, Any],
    mastery_states: list[dict[str, Any]],
    progression: dict[str, Any] | None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Every in-scope skill for one assignment, in curriculum order, grouped by unit."""
    now = now or datetime.now(timezone.utc)
    tree = assignment["tree"]
    curriculum_id = assignment["curriculum_id"]
    mastery = {
        item.get("skill_id"): item
        for item in mastery_states
        if item.get("curriculum_id") == curriculum_id
    }

    scope = grade_scope(tree, assignment.get("scope"), assignment.get("grade_id"))
    skills = ordered_skills(tree, scope)
    available = set(assignment.get("available_skill_ids") or [])

    # A prerequisite counts as met by placement/rapid-confirmation evidence, or by mastery
    # that has cleared the developing gate. One beginner-level touch is exposure, not proof.
    unlocked = set((progression or {}).get("eligible_skill_ids") or [])
    unlocked |= {
        skill_id for skill_id, row in mastery.items()
        if LEVEL_ORDER.get(row.get("level", "not_started"), 0) >= LEVEL_ORDER["developing"]
    }
    # A skill with no published questions cannot be played, so it cannot be finished either.
    # Left blocking, one unauthored skill would strand every skill behind it as `pending` —
    # an authoring gap turning into a dead end for the learner. It stays visible in the path
    # (flagged `playable: false`) but does not hold the road closed.
    unlocked |= {
        skill.get("id") for skill in skills
        if skill.get("id") and skill.get("id") not in available
    }

    units = {unit.get("id"): unit for unit in tree.get("units", [])}
    subjects = {subject.get("id"): subject for subject in tree.get("subjects", [])}
    grades = {grade.get("id"): grade for grade in tree.get("grades", [])}

    ordered_units: list[dict[str, Any]] = []
    by_unit: dict[str, dict[str, Any]] = {}
    counts = {status: 0 for status in (COMPLETED, OVERDUE, IN_PROGRESS, NEW, PENDING)}
    next_skill: dict[str, Any] | None = None

    for position, skill in enumerate(skills):
        skill_id = skill.get("id")
        if not skill_id:
            continue
        state = mastery.get(skill_id)
        status = classify(skill, state, unlocked, now)
        counts[status] += 1

        unit = units.get(skill.get("unitId"), {})
        subject = subjects.get(unit.get("subjectId"), {})
        grade = grades.get(subject.get("gradeId"), {})
        entry = {
            "skillId": skill_id,
            "skillLabel": (skill.get("presentation") or {}).get("title")
            or skill.get("label")
            or skill_id,
            "unitId": unit.get("id"),
            "unitLabel": unit.get("label"),
            "status": status,
            "level": (state or {}).get("level", "not_started"),
            "score": float((state or {}).get("score", 0) or 0),
            # Curriculum order, so a client can render the road without re-deriving it.
            "position": position,
            "playable": skill_id in available,
        }
        # Strict A→Z: the first skill still wanting work, whatever kind of work that is.
        if next_skill is None and status in ACTIONABLE and entry["playable"]:
            next_skill = entry

        unit_id = unit.get("id") or "__unplaced__"
        if unit_id not in by_unit:
            by_unit[unit_id] = {
                "unitId": unit.get("id"),
                "unitLabel": unit.get("label") or "Other skills",
                "unitIcon": (unit.get("presentation") or {}).get("icon"),
                "unitAccent": (unit.get("presentation") or {}).get("accent"),
                "subjectId": subject.get("id"),
                "subjectLabel": subject.get("label"),
                "gradeId": grade.get("id"),
                "gradeLabel": grade.get("label"),
                "skills": [],
            }
            ordered_units.append(by_unit[unit_id])
        by_unit[unit_id]["skills"].append(entry)

    total = sum(counts.values())
    return {
        "pathRevision": PATH_REVISION,
        "assignmentId": assignment["id"],
        "curriculumId": curriculum_id,
        "releaseId": assignment["release_id"],
        "gradeId": assignment.get("grade_id"),
        "units": ordered_units,
        "counts": {
            "completed": counts[COMPLETED],
            "overdue": counts[OVERDUE],
            "inProgress": counts[IN_PROGRESS],
            "new": counts[NEW],
            "pending": counts[PENDING],
            "total": total,
        },
        "complete": total > 0 and counts[COMPLETED] == total,
        "nextSkill": next_skill,
    }
