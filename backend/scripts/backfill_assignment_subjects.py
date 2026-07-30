"""Safely add ``subject_id`` to assignments created before multi-subject support.

The command is report-only unless ``--apply`` is supplied. Ambiguous assignments
are never guessed; they are listed for an administrator to review.

    python -m scripts.backfill_assignment_subjects
    python -m scripts.backfill_assignment_subjects --apply
"""

from __future__ import annotations

import argparse
import asyncio

from app.core.db import close_db, init_db
from app.features.content.offerings import infer_assignment_subject
from app.models.assignment import Assignment
from app.models.content import CurriculumRelease


LEGACY_UNIQUE_KEYS = [
    ("student_id", 1),
    ("release_id", 1),
    ("scope", 1),
]


async def migrate_unique_index() -> None:
    """Install the subject-aware constraint, then remove only the known legacy one."""
    collection = Assignment.get_motor_collection()
    await collection.create_index(
        [("student_id", 1), ("release_id", 1), ("subject_id", 1), ("scope", 1)],
        unique=True,
        partialFilterExpression={"status": "active"},
        name="student_release_subject_scope_active_unique",
    )
    indexes = await collection.index_information()
    for name, definition in indexes.items():
        if name == "student_release_subject_scope_active_unique":
            continue
        if definition.get("unique") and definition.get("key") == LEGACY_UNIQUE_KEYS:
            await collection.drop_index(name)
            print(f"DROPPED legacy index={name}")


async def main(apply: bool) -> None:
    await init_db()
    try:
        rows = await Assignment.find(
            {"$or": [{"subject_id": None}, {"subject_id": {"$exists": False}}]}
        ).sort("created_at").to_list()
        updated = unresolved = 0
        release_cache: dict[str, CurriculumRelease | None] = {}
        for assignment in rows:
            if assignment.release_id not in release_cache:
                release_cache[assignment.release_id] = await CurriculumRelease.find_one(
                    CurriculumRelease.release_id == assignment.release_id
                )
            release = release_cache[assignment.release_id]
            subject_id = (
                infer_assignment_subject(release.tree, assignment.grade_id, assignment.scope)
                if release
                else None
            )
            if not subject_id:
                unresolved += 1
                reason = "release missing" if not release else "release/scope is ambiguous"
                print(f"UNRESOLVED assignment={assignment.id} reason={reason}")
                continue
            action = "UPDATE" if apply else "WOULD UPDATE"
            print(f"{action} assignment={assignment.id} subject={subject_id}")
            updated += 1
            if apply:
                assignment.subject_id = subject_id
                await assignment.save()

        verb = "updated" if apply else "would update"
        print(f"\n{verb} {updated} assignment(s); {unresolved} unresolved")
        if apply:
            await migrate_unique_index()
            print("ENSURED subject-aware active-assignment index")
    finally:
        await close_db()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write inferred subjects")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
