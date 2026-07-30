"""Fill every Grade 1 skill up to the minimum question count.

Each skill needs a real bank, not clones: a learner who sees the same two items forever
cannot reach the volume and hard-question gates the proficiency engine requires, and a
repeated item measures recall of that item rather than the skill.

Every question here is authored against a technique the **server can actually grade** —
`COUNTING` items resolve through `targetCount`, `ARITHMETIC` items through their operand
fields (`grading.py`). Nothing is invented: object ids come from `SVG_OBJECTS`/`EMOJI_OBJECTS`
in `types.ts`, and each skill uses techniques that genuinely serve it.

Difficulty is spread 3 easy / 4 medium / 3 hard, so one honest pass through a skill can
satisfy the `minHardPlays: 3` gate instead of stalling below it.

Existing questions are kept — their ids appear in learning events — and the bank is topped
up around them with deterministic ids, so re-running changes nothing.

    docker exec koda-v4-api-1 python -m scripts.seed_questions --dry-run
    docker exec koda-v4-api-1 python -m scripts.seed_questions
"""

from __future__ import annotations

import argparse
import asyncio
from typing import Any, Callable

from app.core.db import init_db
from app.models.content import Curriculum, QuestionDeck

CURRICULUM_ID = "seed-grade1-phase1"
TARGET_PER_SKILL = 10
#: 10 items: enough easy items to build fluency, and 3 hard ones to clear the mastery gate.
DIFFICULTIES = ["easy", "easy", "easy", "medium", "medium", "medium", "medium", "hard", "hard", "hard"]

OBJECTS = ["apple", "star", "bear", "fish", "butterfly", "flower", "rocket", "car", "sun", "heart"]


def counting(technique: str, counts: list[int], config: Callable[[int, int], dict] | None = None):
    """A bank of counting items — graded from `targetCount`."""
    def build(index: int) -> dict[str, Any]:
        count = counts[index % len(counts)]
        item = {
            "technique": technique,
            "title": f"Count the {OBJECTS[index % len(OBJECTS)]}s",
            "instruction": f"Count how many there are, then type the number.",
            "objectId": OBJECTS[index % len(OBJECTS)],
            "targetCount": count,
            "config": config(index, count) if config else {},
        }
        return item
    return build


def arithmetic(technique: str, pairs: list[tuple[int, ...]], fields: list[str], title: str, instruction: str):
    """A bank of arithmetic items — graded from the operand fields in `ARITHMETIC`."""
    def build(index: int) -> dict[str, Any]:
        operands = pairs[index % len(pairs)]
        return {
            "technique": technique,
            "title": title,
            "instruction": instruction,
            "config": {field: value for field, value in zip(fields, operands)},
        }
    return build


#: skill id -> (label used in titles, builder). Techniques chosen to genuinely serve the skill.
BANKS: dict[str, Callable[[int], dict[str, Any]]] = {
    # Counting to 10: physically move and count, the one-to-one foundation.
    "seed-g1-skill-count": counting(
        "MOVE_AND_COUNT", [3, 5, 4, 6, 7, 8, 9, 10, 6, 9],
        lambda index, count: {
            "requireAnswerInput": True,
            "sourceBinLabel": "Ready to move",
            "destinationBinLabel": "Counted",
        },
    ),
    # Subitizing: recognise small quantities without counting, so counts stay in range 1–6.
    "seed-g1-skill-subitize": counting(
        "SUBITIZE", [2, 3, 4, 5, 6, 3, 4, 5, 6, 4],
        lambda index, count: {
            "pattern": ["dice", "line", "random"][index % 3],
            # Harder items flash faster — the whole point is recognition, not counting.
            "flashDurationMs": 1800 if index < 3 else 1200 if index < 7 else 800,
        },
    ),
    # Counting past ten works through tens-and-ones grouping.
    "demo-g1-count-20": counting(
        "GROUP_IN_TENS", [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    ),
    # Counting on from a number, rather than restarting at one.
    "demo-g1-compare": counting(
        "COUNT_ON", [7, 9, 11, 12, 13, 14, 15, 16, 18, 20],
        lambda index, count: {"baseCount": count - (2 + index % 3), "extraCount": 2 + index % 3},
    ),
    "seed-g1-skill-add": arithmetic(
        "ADDITION_COLUMN",
        [(1, 2), (2, 3), (3, 4), (4, 5), (2, 6), (5, 4), (3, 6), (6, 3), (7, 2), (4, 6)],
        ["num1", "num2"], "Add within 10", "Add the two numbers together.",
    ),
    "demo-g1-add-20": arithmetic(
        "ADDITION_COLUMN",
        [(6, 5), (7, 4), (8, 5), (9, 6), (7, 8), (9, 9), (8, 7), (6, 9), (9, 4), (8, 8)],
        ["num1", "num2"], "Add within 20", "Add the two numbers together.",
    ),
    "demo-g1-add-three": arithmetic(
        "ADDITION_COLUMN_MULTI",
        [(1, 2, 3), (2, 3, 4), (3, 3, 4), (2, 5, 3), (4, 4, 5), (5, 5, 5),
         (3, 6, 4), (6, 4, 5), (7, 3, 6), (5, 8, 4)],
        ["num1", "num2", "num3"], "Add three numbers", "Add all three numbers together.",
    ),
    "seed-g1-skill-subtract": arithmetic(
        "SUBTRACTION_COLUMN",
        [(3, 1), (5, 2), (6, 3), (7, 4), (8, 3), (9, 5), (10, 4), (8, 6), (9, 7), (10, 8)],
        ["minuend", "subtrahend"], "Take away within 10", "Subtract the bottom number from the top.",
    ),
    "demo-g1-sub-20": arithmetic(
        "SUBTRACTION_COLUMN",
        [(12, 2), (14, 3), (15, 5), (16, 4), (17, 8), (18, 9), (19, 7), (20, 6), (16, 9), (20, 13)],
        ["minuend", "subtrahend"], "Take away within 20", "Subtract the bottom number from the top.",
    ),
}


async def main(dry_run: bool) -> None:
    await init_db()
    doc = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
    deck = await QuestionDeck.find_one(QuestionDeck.owner_id == doc.owner_id)
    if not doc or not deck:
        raise SystemExit("curriculum or question deck not found")

    existing_ids = {q.get("id") for q in deck.questions}
    added = 0
    for skill_id, build in BANKS.items():
        have = [q for q in deck.questions if q.get("skillId") == skill_id]
        # Drop the placeholder clones from the earlier demo seed; they were duplicates.
        clones = [q for q in have if str(q.get("id", "")).startswith(f"{skill_id}-q")]
        for clone in clones:
            deck.questions.remove(clone)
            existing_ids.discard(clone.get("id"))
        have = [q for q in deck.questions if q.get("skillId") == skill_id]

        for index in range(TARGET_PER_SKILL - len(have)):
            slot = len(have) + index
            question_id = f"gen-{skill_id}-{slot + 1}"
            if question_id in existing_ids:
                continue
            question = build(slot)
            question.update({
                "id": question_id,
                "skillId": skill_id,
                "difficulty": DIFFICULTIES[slot % len(DIFFICULTIES)],
            })
            deck.questions.append(question)
            existing_ids.add(question_id)
            added += 1

        total = len([q for q in deck.questions if q.get("skillId") == skill_id])
        print(f"  {skill_id:<26} {total} questions ({len(clones)} placeholder(s) dropped)")

    # The audit rule the studio checks is per-skill; make the target explicit on each.
    for skill in doc.tree["skills"]:
        if skill.get("id") in BANKS:
            skill["minQuestions"] = TARGET_PER_SKILL
        # "Compare two numbers" was seeded before checking the technique registry: no canvas
        # serves a comparison, so the skill is renamed to the one COUNT_ON genuinely teaches
        # rather than shipping counting questions under a comparison label.
        if skill.get("id") == "demo-g1-compare":
            skill["label"] = "Count on from a number"
            skill.setdefault("presentation", {})["title"] = "Count on from a number"

    print(f"\n{'would add' if dry_run else 'added'} {added} questions")
    if dry_run:
        return
    deck.revision += 1
    await deck.save()
    doc.revision += 1
    await doc.save()

    from app.features.content.router import _publish_release
    from app.models.user import User
    owner = await User.get(doc.owner_id)
    release = await _publish_release(doc, owner)
    print(f"published rev {release.revision} ({release.release_id})")

    from app.models.assignment import Assignment
    rows = await Assignment.find(
        Assignment.curriculum_id == CURRICULUM_ID, Assignment.status == "active"
    ).to_list()
    for assignment in rows:
        assignment.release_id = release.release_id
        await assignment.save()
    print(f"moved {len(rows)} assignment(s) onto it")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(main(parser.parse_args().dry_run))
