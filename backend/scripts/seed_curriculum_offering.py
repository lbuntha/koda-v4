"""Create or update one explicit grade/subject curriculum offering.

This command never edits learners, assignments, progress, or curriculum content.

    python -m scripts.seed_curriculum_offering \
      --grade grade-1 --subject grade-1-math \
      --curriculum seed-grade1-phase1 --release RELEASE_ID --apply
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

from app.core.db import close_db, init_db
from app.features.content.offerings import release_includes
from app.models.academic import Grade, Subject
from app.models.assignment import CurriculumOffering
from app.models.content import CurriculumRelease


async def main(*, grade_id: str, subject_id: str, curriculum_id: str, release_id: str, apply: bool) -> None:
    await init_db()
    try:
        grade = await Grade.find_one(Grade.key == grade_id)
        subject = await Subject.find_one(Subject.key == subject_id, Subject.grade_id == grade_id)
        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == release_id)
        if not grade:
            raise SystemExit(f"Grade {grade_id!r} does not exist")
        if not subject:
            raise SystemExit(f"Subject {subject_id!r} does not belong to {grade_id!r}")
        if not release or release.curriculum_id != curriculum_id:
            raise SystemExit("Release does not belong to the requested curriculum")
        if not release_includes(release.tree, grade_id, subject_id):
            raise SystemExit("Release does not include the requested grade and subject")

        item = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == grade_id,
            CurriculumOffering.subject_id == subject_id,
        )
        action = "update" if item else "create"
        print(f"{'WOULD ' if not apply else ''}{action.upper()} {grade_id}/{subject_id} -> {release_id}")
        if not apply:
            return
        actor_id = release.published_by or release.owner_id
        if item:
            item.curriculum_id = curriculum_id
            item.release_id = release_id
            item.active = True
            item.revision += 1
            item.updated_by = actor_id
            item.updated_at = datetime.now(timezone.utc)
            await item.save()
        else:
            await CurriculumOffering(
                grade_id=grade_id,
                subject_id=subject_id,
                curriculum_id=curriculum_id,
                release_id=release_id,
                created_by=actor_id,
                updated_by=actor_id,
            ).insert()
    finally:
        await close_db()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grade", required=True)
    parser.add_argument("--subject", required=True)
    parser.add_argument("--curriculum", required=True)
    parser.add_argument("--release", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(
        grade_id=args.grade,
        subject_id=args.subject,
        curriculum_id=args.curriculum,
        release_id=args.release,
        apply=args.apply,
    ))
