"""Give every student an active assignment on the newest release of a curriculum.

A student with no assignment gets no learning plan at all: `/learning/today` answers 404
("No placement-ready assignment is available") and the app shows an empty/no-placement
state. This is a development convenience for exactly that — it does not invent progress.

Placement itself is left to the normal flow: `placement_required` stays true, and the
learner's first visit to `/student/placement/quiz` creates the Placement and
ProgressionState on demand.

Existing active assignments are never touched, so re-running is safe.

    docker exec koda-v4-api-1 python -m scripts.seed_assignments --dry-run
    docker exec koda-v4-api-1 python -m scripts.seed_assignments --curriculum seed-grade1-phase1
"""

from __future__ import annotations

import argparse
import asyncio

from app.core.db import init_db
from app.models.assignment import Assignment
from app.models.content import CurriculumRelease
from app.features.content.offerings import infer_assignment_subject
from app.models.student import Student


async def main(curriculum_id: str, dry_run: bool) -> None:
    await init_db()

    release = (
        await CurriculumRelease.find(CurriculumRelease.curriculum_id == curriculum_id)
        .sort("-revision")
        .first_or_none()
    )
    if not release:
        raise SystemExit(f"No published release for curriculum {curriculum_id!r}")
    grade_id = next((g.get("id") for g in release.tree.get("grades", [])), None)
    if not grade_id:
        raise SystemExit(f"Release {release.release_id} has no grade to anchor an assignment")
    subject_id = infer_assignment_subject(release.tree, grade_id)
    if not subject_id:
        raise SystemExit(f"Release {release.release_id} has no unambiguous subject for {grade_id}")
    print(f"target release rev {release.revision} ({release.release_id}) grade={grade_id}\n")

    created = skipped = 0
    for student in await Student.find_all().to_list():
        existing = await Assignment.find_one(
            Assignment.student_id == str(student.id),
            Assignment.status == "active",
        )
        if existing:
            skipped += 1
            continue
        # The guardian owns the assignment, matching what POST /assignments records when a
        # parent assigns. Fall back to the release owner for a student with no guardian.
        owner_id = next(iter(student.guardian_parent_ids), None) or release.owner_id
        print(f"  assign {student.name} ({student.id}) owner={owner_id}")
        created += 1
        if dry_run:
            continue
        await Assignment(
            owner_id=owner_id,
            student_id=str(student.id),
            curriculum_id=curriculum_id,
            release_id=release.release_id,
            grade_id=grade_id,
            subject_id=subject_id,
            scope={"kind": "all", "ids": []},
            mode="scheduled",
            schedule=None,
            priority=100,
            placement_required=True,
        ).insert()

    verb = "would create" if dry_run else "created"
    print(f"\n{verb} {created} assignment(s); {skipped} student(s) already had one")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--curriculum", default="seed-grade1-phase1")
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    args = parser.parse_args()
    asyncio.run(main(args.curriculum, args.dry_run))
