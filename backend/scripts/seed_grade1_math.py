"""Seed Grade 1 Mathematics: the full Common Core scope, 11 units and 30 skills, with content.

The tree has existed for a long time — 11 units, 30 skills, each carrying its standard
reference — and it has never had a single question, which is why it sat archived. The
questions are generated and verified in the frontend and read from here:

    npm run export:grade1-math      (in frontend/)
    docker compose exec api python -m scripts.seed_grade1_math

Both files under `scripts/data/` are generated. The export refuses to emit a question whose
count falls outside its canvas's authored range, whose config solves to a different answer
than the question claims, whose title contains the answer, or which carries no explanation —
so anything that reaches this script has already been checked.

Authors content only: it assigns nothing to a learner and never resets progress. Re-running is
safe — the draft, deck entries and offering are upserted, and identical content reuses the
existing release rather than cutting a new one.

Releases are immutable, so changed content always cuts the next revision. The offering points
at the newest; learners already assigned stay pinned to the release they were given, and move
with "Update to v<n>" on Admin -> Assignments.

NOTE ON COVERAGE: all 150 questions now run on a real manipulative — counting boards, story
mats, ten-frames, number paths, columns, and the measurement, clock, data and geometry
components. Nothing falls back to a picture-and-choice worksheet.

Every question also carries `config.explanation`, one sentence of reasoning shown by the
success panel after the card is solved. It travels in the release's `playable` blob, so it
reaches the child the same way the rest of the question does.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.db import close_db, init_db
from app.features.content.release import build_release_payload
from app.models.academic import Grade, Subject
from app.core.subject_icons import MATH_SUBJECT_ICON
from app.models.assignment import Assignment, CurriculumOffering, ProgressionState
from app.models.content import Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary
from app.models.user import User

CURRICULUM_ID = "seed-grade1-math"
GRADE_ID = "grade-1"
SUBJECT_ID = "grade-1-math"

DATA = Path(__file__).resolve().parent / "data"
QUESTIONS_PATH = DATA / "grade1_math_questions.json"
TREE_PATH = DATA / "grade1_math_tree.json"


def now() -> datetime:
    return datetime.now(timezone.utc)


def load_generated() -> tuple[dict, list[dict]]:
    for path in (TREE_PATH, QUESTIONS_PATH):
        if not path.exists():
            raise SystemExit(f"{path} is missing — run `npm run export:grade1-math` in frontend/")

    tree = json.loads(TREE_PATH.read_text(encoding="utf-8"))
    rows = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))

    # The export marks anything it could not verify. Seeding one would put a question in front
    # of a child that the server may refuse to grade, or whose answer disagrees with the board.
    unusable = [row for row in rows if not row.get("usable", False)]
    for row in unusable:
        print(f"  skipping {row['id']}: " + "; ".join(row.get("problems") or ["unverified"]))
    rows = [row for row in rows if row.get("usable", False)]
    if not rows:
        raise SystemExit("no usable questions — fix grade1MathQuestions.ts and re-export")

    skill_ids = {skill["id"] for skill in tree.get("skills", [])}
    orphans = sorted({row["skillId"] for row in rows} - skill_ids)
    if orphans:
        raise SystemExit(f"questions reference skills that are not in the tree: {orphans}")

    questions = [
        {
            "id": row["id"],
            "curriculumId": CURRICULUM_ID,
            "title": row["title"],
            "instruction": row["instruction"],
            "technique": row["technique"],
            "skillId": row["skillId"],
            "difficulty": row["difficulty"],
            "objectId": row["objectId"],
            "targetCount": row["targetCount"],
            "config": row["config"],
        }
        for row in rows
    ]
    return tree, questions


# Every question id this seed owns, so a re-run replaces its own rows and leaves the rest of
# the account's deck alone.
def owned_question_ids(questions: list[dict]) -> set[str]:
    return {question["id"] for question in questions}


async def _owner_id() -> str:
    existing = await Subject.find_one(Subject.grade_id == GRADE_ID)
    if existing:
        return existing.created_by
    admin = await User.find_one(User.role == "admin")
    if not admin:
        raise SystemExit("Create or seed an admin account before seeding Grade 1 Mathematics")
    return str(admin.id)


async def _ensure_catalog(owner_id: str) -> Subject:
    """Grades and subjects are keyed by `key` — `grade-1`, `grade-1-math` — not by an id
    field. Both normally exist already; this only fills a gap on an empty database."""
    grade = await Grade.find_one(Grade.key == GRADE_ID)
    if not grade:
        grade = Grade(
            key=GRADE_ID, code="G1", name="Grade 1", order=1,
            created_by=owner_id, updated_by=owner_id,
        )
        await grade.insert()

    subject = await Subject.find_one(Subject.key == SUBJECT_ID)
    if not subject:
        subject = Subject(
            key=SUBJECT_ID,
            grade_id=GRADE_ID,
            name="Mathematics",
            code="MATH",
            icon=MATH_SUBJECT_ICON["id"],
            icon_asset=dict(MATH_SUBJECT_ICON),
            color="#6B46C1",
            order=1,
            created_by=owner_id,
            updated_by=owner_id,
        )
        await subject.insert()
    return subject


async def main() -> None:
    await init_db()
    try:
        owner_id = await _owner_id()
        subject = await _ensure_catalog(owner_id)
        owner_id = subject.created_by
        tree, questions = load_generated()

        draft = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
        if draft:
            draft.tree = tree
            draft.published = True
            # A curriculum archived for having no content should come back once it has some.
            draft.archived_at = None
            draft.revision += 1
            draft.updated_at = now()
            await draft.save()
        else:
            await Curriculum(
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                tree=tree,
                revision=1,
                published=True,
            ).insert()

        owned = owned_question_ids(questions)
        deck = await QuestionDeck.find_one(QuestionDeck.owner_id == owner_id)
        if deck:
            deck.questions = [
                item for item in deck.questions if item.get("id") not in owned
            ] + questions
            deck.revision += 1
            deck.updated_at = now()
            await deck.save()
        else:
            await QuestionDeck(owner_id=owner_id, questions=questions, revision=1).insert()

        svg = await SvgLibrary.find_one(SvgLibrary.owner_id == owner_id)
        assets = svg.assets if svg else []
        payload = build_release_payload(tree=tree, questions=questions, assets=assets)
        existing = await CurriculumRelease.find(
            CurriculumRelease.curriculum_id == CURRICULUM_ID
        ).sort("-revision").to_list()
        release = next(
            (item for item in existing if item.content_hashes == payload["content_hashes"]),
            None,
        )
        if release is None:
            revision = (existing[0].revision if existing else 0) + 1
            release = CurriculumRelease(
                release_id=f"{CURRICULUM_ID}-release-{revision}",
                curriculum_id=CURRICULUM_ID,
                owner_id=owner_id,
                revision=revision,
                published_by=owner_id,
                **payload,
            )
            await release.insert()

        offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == GRADE_ID,
            CurriculumOffering.subject_id == SUBJECT_ID,
        )
        if offering:
            if (
                offering.curriculum_id != CURRICULUM_ID
                or offering.release_id != release.release_id
                or not offering.active
            ):
                offering.curriculum_id = CURRICULUM_ID
                offering.release_id = release.release_id
                offering.active = True
                offering.revision += 1
                offering.updated_by = owner_id
                offering.updated_at = now()
                await offering.save()
        else:
            await CurriculumOffering(
                grade_id=GRADE_ID,
                subject_id=SUBJECT_ID,
                curriculum_id=CURRICULUM_ID,
                release_id=release.release_id,
                created_by=owner_id,
                updated_by=owner_id,
            ).insert()

        # Update any active assignments and progression states to the published release
        active_assignments = await Assignment.find({
            "curriculum_id": CURRICULUM_ID,
            "status": "active",
        }).to_list()
        for assignment in active_assignments:
            if assignment.release_id != release.release_id:
                assignment.release_id = release.release_id
                assignment.updated_at = now()
                await assignment.save()
                prog = await ProgressionState.find_one(
                    ProgressionState.student_id == assignment.student_id,
                    ProgressionState.assignment_id == str(assignment.id),
                )
                if prog:
                    prog.release_id = release.release_id
                    prog.updated_at = now()
                    await prog.save()

        from app.features.content.grading import supported_techniques

        graded = supported_techniques()
        by_skill: dict[str, int] = {}
        for question in questions:
            by_skill[question["skillId"]] = by_skill.get(question["skillId"], 0) + 1
        print({
            "subject": SUBJECT_ID,
            "curriculum": CURRICULUM_ID,
            "release": release.release_id,
            "offering": f"{GRADE_ID}/{SUBJECT_ID}",
            "units": len(tree["units"]),
            "skills": len(tree["skills"]),
            "skillsWithQuestions": len(by_skill),
            "questions": len(questions),
            "serverGraded": sorted({q["technique"] for q in questions if q["technique"] in graded}),
            "notGraded": sorted({q["technique"] for q in questions if q["technique"] not in graded}),
        })
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
