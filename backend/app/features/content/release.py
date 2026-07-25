"""Immutable curriculum-release core (Phase 0, items 1-3).

Publishing turns editable *drafts* (the `curriculum` tree, the owner's
`question_decks`, and `svg_libraries`) into ONE immutable `CurriculumRelease`:
a frozen snapshot every later decision can point back to. This module is the
pure, database-free heart of that process so it can be unit-tested in isolation
— no Beanie, no Motor, no I/O.

What it guarantees about a release:

  * **Reproducibility** — every part (tree, each question, each asset) carries a
    canonical content hash, so a replay can prove it scored the exact bytes that
    were served.
  * **Answer keys stay private** — a question is split into a `playable` snapshot
    (what the client receives) and a `grading` blob (the answer key), which never
    leaves the server. Clients submit *selections*; the server decides
    correctness. See `split_question`.
  * **Structural integrity** — foreign keys resolve, `prerequisiteSkillIds`
    reference real skills in the same curriculum and form a directed acyclic
    graph (no cycles), and `placementCheckpoint` flags are well-formed.

Grading itself (turning a submitted selection into correct/incorrect) is
technique-specific and lives behind the adapter contract in `grading.py`; this
module only isolates the key material a grader will need.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

# Config fields that are answer keys / solutions — they must be stripped from the
# playable snapshot a client receives and kept in the private grading blob. This
# is the closed set the studio's question schemas can produce today; adding a new
# answer-bearing field is a one-line change here, the single place it's decided.
GRADING_KEY_FIELDS: frozenset[str] = frozenset(
    {
        "patternAnswer",
        "patternAnswers",
        "sudokuSolution",
        "flexibleCorrectAnswer",
    }
)


class ReleaseValidationError(ValueError):
    """Raised when draft content cannot be published into a release."""


# ── Content hashing ────────────────────────────────────────────────────────────

def content_hash(obj: Any) -> str:
    """Stable `sha256:<hex>` over any JSON-able value.

    Canonical form: sorted keys, no insignificant whitespace, UTF-8. Two values
    that are equal as JSON hash identically regardless of key order, which is
    what lets a replay verify "same content" rather than "same bytes on the wire".
    """
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ── Question split: playable vs. private grading key ────────────────────────────

def split_question(question: dict) -> tuple[dict, dict]:
    """Split one question into `(playable, grading)`.

    `playable` is the client-facing snapshot with every answer-key field removed.
    `grading` holds only those removed fields plus the id/technique a server-side
    grader needs. `grading` never goes to a client.

    The full (unsplit) question is what we hash for the manifest, so the release
    still proves what was authored even though the client only ever sees `playable`.
    """
    config = question.get("config")
    playable = dict(question)
    grading_config: dict[str, Any] = {}

    if isinstance(config, dict):
        playable_config = {}
        for key, value in config.items():
            if key in GRADING_KEY_FIELDS:
                grading_config[key] = value
            else:
                playable_config[key] = value
        playable["config"] = playable_config

    grading = {
        "questionId": question.get("id"),
        "technique": question.get("technique"),
        "keys": grading_config,
    }
    return playable, grading


def build_question_manifest(questions: list[dict], skill_ids: set[str]) -> list[dict]:
    """Build the release's question manifest — one entry per in-curriculum question.

    Only questions whose `skillId` is part of this curriculum are released. Each
    entry keeps the playable snapshot, the private grading blob, a standard
    top-level `difficulty`, and a content hash of the whole (unsplit) question.
    """
    manifest: list[dict] = []
    for question in questions:
        skill_id = question.get("skillId")
        if skill_id not in skill_ids:
            continue
        playable, grading = split_question(question)
        manifest.append(
            {
                "question_id": question.get("id"),
                "skill_id": skill_id,
                "difficulty": normalize_difficulty(question),
                "playable": playable,
                "grading": grading,
                "content_hash": content_hash(question),
            }
        )
    return manifest


def normalize_difficulty(question: dict) -> str:
    """Resolve a question's standard difficulty, defaulting to 'medium'.

    A top-level `difficulty` wins; otherwise a `config.difficulty`; otherwise
    'medium'. Only the three standard bands are accepted — anything else is
    treated as unset so a typo can't create a phantom fourth band.
    """
    for candidate in (question.get("difficulty"), (question.get("config") or {}).get("difficulty")):
        if candidate in ("easy", "medium", "hard"):
            return candidate
    return "medium"


# ── Structural validation ───────────────────────────────────────────────────────

def _skill_index(tree: dict) -> dict[str, dict]:
    return {s.get("id"): s for s in tree.get("skills", []) if isinstance(s, dict) and s.get("id")}


def validate_prerequisites(tree: dict) -> None:
    """Every `prerequisiteSkillIds` ref must resolve to a skill in THIS curriculum,
    and the resulting graph must be acyclic. A cycle would make some skill forever
    ineligible (it can never be reached), so we reject it at publish time.
    """
    skills = _skill_index(tree)

    # 1. references resolve
    for skill_id, skill in skills.items():
        prereqs = skill.get("prerequisiteSkillIds") or []
        if not isinstance(prereqs, list):
            raise ReleaseValidationError(f"skill {skill_id!r}: prerequisiteSkillIds must be a list")
        for prereq in prereqs:
            if prereq == skill_id:
                raise ReleaseValidationError(f"skill {skill_id!r} lists itself as a prerequisite")
            if prereq not in skills:
                raise ReleaseValidationError(
                    f"skill {skill_id!r} requires missing prerequisite {prereq!r}"
                )

    # 2. no cycles (iterative DFS with a three-color marking)
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {skill_id: WHITE for skill_id in skills}

    def visit(start: str) -> None:
        stack: list[tuple[str, bool]] = [(start, False)]
        while stack:
            node, leaving = stack.pop()
            if leaving:
                color[node] = BLACK
                continue
            if color[node] == GRAY:
                continue
            color[node] = GRAY
            stack.append((node, True))
            for prereq in skills[node].get("prerequisiteSkillIds") or []:
                if color[prereq] == GRAY:
                    raise ReleaseValidationError(
                        f"prerequisite cycle detected involving skill {prereq!r}"
                    )
                if color[prereq] == WHITE:
                    stack.append((prereq, False))

    for skill_id in skills:
        if color[skill_id] == WHITE:
            visit(skill_id)


def validate_checkpoints(tree: dict) -> None:
    """`placementCheckpoint`, when present, must be a boolean."""
    for skill in tree.get("skills", []):
        if not isinstance(skill, dict):
            continue
        flag = skill.get("placementCheckpoint")
        if flag is not None and not isinstance(flag, bool):
            raise ReleaseValidationError(
                f"skill {skill.get('id')!r}: placementCheckpoint must be true/false"
            )


def validate_reward_metadata(tree: dict) -> None:
    rewards = tree.get("rewards") or {}
    quest = rewards.get("quest") or {}
    xp = rewards.get("xp") or {}
    activities = quest.get("activitiesPerSession", 3)
    if not isinstance(activities, int) or isinstance(activities, bool) or not 1 <= activities <= 5:
        raise ReleaseValidationError("quest activitiesPerSession must be between 1 and 5")
    for field, default in (
        ("correctAnswer", 0),
        ("firstTryBonus", 0),
        ("activityCompletion", 0),
    ):
        value = xp.get(field, default)
        if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100:
            raise ReleaseValidationError(f"XP {field} must be between 0 and 100")
    level = rewards.get("level") or {}
    xp_per_level = level.get("xpPerLevel")
    if xp_per_level is not None and (
        not isinstance(xp_per_level, int)
        or isinstance(xp_per_level, bool)
        or not 1 <= xp_per_level <= 10_000
    ):
        raise ReleaseValidationError("XP per level must be between 1 and 10,000")
    achievements = rewards.get("achievements") or []
    if not isinstance(achievements, list) or len(achievements) > 12:
        raise ReleaseValidationError("Achievements must contain at most 12 items")
    allowed_metrics = {
        "xpEarned", "lessonsCompleted", "firstTryCorrect",
        "proficientSkills", "masteredSkills", "streakDays",
    }
    allowed_icons = {"star", "medal", "award", "trophy", "gem", "flame"}
    allowed_accents = {"purple", "blue", "green", "amber", "pink"}
    ids = []
    for achievement in achievements:
        if not isinstance(achievement, dict):
            raise ReleaseValidationError("Each achievement must be an object")
        achievement_id = achievement.get("id")
        ids.append(achievement_id)
        if (
            not isinstance(achievement_id, str)
            or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", achievement_id)
        ):
            raise ReleaseValidationError("Achievement id is invalid")
        if achievement.get("metric") not in allowed_metrics:
            raise ReleaseValidationError(f"achievement {achievement_id!r}: metric is invalid")
        if achievement.get("icon") not in allowed_icons:
            raise ReleaseValidationError(f"achievement {achievement_id!r}: icon is invalid")
        if achievement.get("accent") not in allowed_accents:
            raise ReleaseValidationError(f"achievement {achievement_id!r}: accent is invalid")
        target = achievement.get("target")
        if not isinstance(target, int) or isinstance(target, bool) or not 1 <= target <= 10_000:
            raise ReleaseValidationError(f"achievement {achievement_id!r}: target is invalid")
        for field, limit in (("label", 80), ("description", 200)):
            value = achievement.get(field)
            if not isinstance(value, str) or not value.strip() or len(value) > limit:
                raise ReleaseValidationError(f"achievement {achievement_id!r}: {field} is invalid")
    if len(ids) != len(set(ids)):
        raise ReleaseValidationError("Achievement ids must be unique")
    for skill in tree.get("skills", []):
        value = skill.get("completionXp")
        if value is not None and (
            not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100
        ):
            raise ReleaseValidationError(
                f"skill {skill.get('id')!r}: completionXp must be between 0 and 100"
            )


def validate_release_structure(tree: dict) -> None:
    """Run every structural check a release must pass. `CurriculumIn` already
    validates the base tree (FK integrity, unique ids) on the draft; this adds the
    release-only rules (prerequisite DAG, checkpoint flags).
    """
    validate_prerequisites(tree)
    validate_checkpoints(tree)
    validate_reward_metadata(tree)


# ── Assembly ────────────────────────────────────────────────────────────────────

def build_release_payload(
    *,
    tree: dict,
    questions: list[dict],
    assets: list[dict] | None = None,
) -> dict:
    """Assemble (and validate) the immutable parts of a release.

    Returns the manifests and content hashes; the caller stamps identity
    (`release_id`, `curriculum_id`, `revision`) and persistence fields onto the
    `CurriculumRelease` document. Raises `ReleaseValidationError` on any problem,
    so a bad draft never becomes a release.
    """
    validate_release_structure(tree)

    skill_ids = set(_skill_index(tree))
    question_manifest = build_question_manifest(questions, skill_ids)
    available_asset_ids = {
        asset.get("id")
        for asset in (assets or [])
        if isinstance(asset.get("id"), str)
    }
    for skill in tree.get("skills", []):
        thumbnail_asset_id = (skill.get("presentation") or {}).get("thumbnailAssetId")
        if thumbnail_asset_id and thumbnail_asset_id not in available_asset_ids:
            raise ReleaseValidationError(
                f"skill {skill.get('id')!r}: thumbnail asset {thumbnail_asset_id!r} is missing"
            )
    asset_manifest = [
        {"asset_id": a.get("id"), "snapshot": a, "content_hash": content_hash(a)}
        for a in (assets or [])
    ]

    return {
        "tree": tree,
        "question_manifest": question_manifest,
        "asset_manifest": asset_manifest,
        "content_hashes": {
            "tree": content_hash(tree),
            "questions": content_hash([m["content_hash"] for m in question_manifest]),
            "assets": content_hash([m["content_hash"] for m in asset_manifest]),
        },
    }
