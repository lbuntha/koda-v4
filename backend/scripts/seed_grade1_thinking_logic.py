"""Seed a Grade 1 "Thinking & Logic" subject: two full sorting ladders.

Unit 1 is Liquid Bottle Sort, unit 2 is Goods Shelf Sort. Every curated level of each
becomes one skill, ordered easiest to hardest, plus an immutable release and an active
Grade 1 offering, so the subject is selectable for a child and playable straight through.

Both games teach the same thing from different directions, which is why they share a
subject: hold a goal in mind, work out the order the moves have to happen in, and keep
somewhere free to work. Liquid Sort restricts *where* a colour may be poured; Goods Sort
lets anything go anywhere but makes space the scarce thing. A child who can finish both
ladders has genuinely learned to sort, not memorised one board's trick.

Each game is one board per play, so each level is one skill with one question. Order
comes from the learner's frontier rather than a prerequisite chain — see the note in
`_sort_skills` for why a chain made the ladder unreachable.

The levels are read from `scripts/data/liquid_sort_levels.json` and
`scripts/data/goods_sort_levels.json`, generated from the canvases' own level tables
(`npm run export:liquid-sort-levels` / `export:goods-sort-levels` in frontend/), so a
level edit can never leave the seed describing a puzzle that no longer exists.

Run it as a module so `app` resolves from the working directory:

    docker compose exec api python -m scripts.seed_grade1_thinking_logic

Releases are immutable, so changed content cuts a new revision automatically (the
revision is derived, never hardcoded — Curriculum Studio publishes into the same
sequence). Re-running with unchanged content reuses the existing release. The offering
always points at the newest, but learners already assigned stay pinned to the release
they were given — move them with "Update to v<n>" on Admin -> Assignments.

Mirrors `seed_grade1_science_pilot.py` / `seed_grade3_science.py`: it authors
content only. It assigns nothing to a learner and never resets progress, and
re-running is safe (the draft, deck entries, and offering are upserted).

NOTE ON GRADING: every board is verified server-side. `grade_liquid_sort` checks the
submitted bottles against the level's `liquidSortLayers` — each colour alone in one
bottle, and the board still holding exactly the liquid the level started with.
`grade_goods_sort` does the same for shelves against `goodsSortCounts`. Both keys are
stripped from the playable snapshot by GRADING_KEY_FIELDS, so neither ever reaches a
client.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.db import close_db, init_db
from app.features.content.release import build_release_payload
from app.models.academic import Grade, Subject
from app.models.assignment import CurriculumOffering
from app.models.content import Curriculum, CurriculumRelease, QuestionDeck
from app.models.user import User

CURRICULUM_ID = "seed-grade1-thinking-logic"
GRADE_ID = "grade-1"
SUBJECT_ID = "grade-1-thinking-logic"

# ── Liquid sort: the whole curated ladder ───────────────────────────────────────
#
# Levels come from `scripts/data/liquid_sort_levels.json`, generated out of the
# canvas's own level table (`npm run export:liquid-sort-levels` in frontend/), so
# a level edit never leaves the seed describing a puzzle that no longer exists.
LEVELS_PATH = Path(__file__).resolve().parent / "data" / "liquid_sort_levels.json"
GOODS_LEVELS_PATH = Path(__file__).resolve().parent / "data" / "goods_sort_levels.json"

# Each game's levels live in one unit, so a learner sees a ladder to play through rather
# than five units they have to switch between.
UNIT_SORT = "seed-g1-logic-unit-liquid-sort"
UNIT_GOODS = "seed-g1-logic-unit-goods-sort"

# The Grade 1 ceiling for a goods board, in items and in compartments. See load_goods_levels.
GRADE1_MAX_ITEMS = 40
GRADE1_MAX_SHELVES = 12

# Tier no longer groups the content; it still scales reward, pacing, and card colour.
# The five values are the whole of `Skill.presentation.accent` (curriculum/types.ts) —
# "cyan" was in here and is not one of them, so beginner cards fell back to a default.
TIER_ACCENT = {
    "beginner": "green",
    "apprentice": "blue",
    "advanced": "purple",
    "master": "amber",
    "grandmaster": "pink",
}
TIER_DIFFICULTY = {
    "beginner": "easy",
    "apprentice": "easy",
    "advanced": "medium",
    "master": "hard",
    "grandmaster": "hard",
}
# Longer ladders are worth more; a grandmaster board is not a level-1 board.
TIER_XP = {"beginner": 20, "apprentice": 25, "advanced": 30, "master": 35, "grandmaster": 40}
TIER_MINUTES = {"beginner": 3, "apprentice": 5, "advanced": 6, "master": 8, "grandmaster": 10}

# The first two levels were seeded under these ids before the full ladder existed.
# Keeping them means an existing learner's history and mastery still line up.
LEGACY_SKILL_IDS = {
    "level_1": "seed-g1-logic-skill-first-pour",
    "level_2": "seed-g1-logic-skill-dual-swap",
}


def skill_id_for(level_id: str) -> str:
    return LEGACY_SKILL_IDS.get(level_id, f"seed-g1-logic-skill-sort-{level_id.replace('_', '-')}")


TIER_RANK = {"beginner": 0, "apprentice": 1, "advanced": 2, "master": 3, "grandmaster": 4}


def load_levels() -> list[dict]:
    if not LEVELS_PATH.exists():
        raise SystemExit(
            f"{LEVELS_PATH} is missing — run `npm run export:liquid-sort-levels` in frontend/"
        )
    levels = json.loads(LEVELS_PATH.read_text(encoding="utf-8"))
    for level in levels:
        if not level.get("layers"):
            raise SystemExit(f"{level.get('id')!r} has no layers — regenerate the export")
        if level["difficultyTier"] not in TIER_DIFFICULTY:
            raise SystemExit(f"{level['id']!r} has unknown tier {level['difficultyTier']!r}")

    # The export plays every level out with the solver and marks the ones that cannot be
    # finished. Authoring a skill for one of those gives a learner a board they can never
    # complete, which then sits unfinished on their path — so they are left out entirely.
    unsolvable = [level for level in levels if level.get("solvable") is False]
    for level in unsolvable:
        print(
            f"  skipping {level['id']} ({level['name']}): unsolvable — "
            + ", ".join(level.get("unbalancedColours") or ["colour counts do not fill a bottle"])
        )
    levels = [level for level in levels if level.get("solvable") is not False]
    if not levels:
        raise SystemExit("no solvable levels to seed — fix liquidSortLevels.ts and re-export")
    # Difficulty has to climb, and the level id does not track it: levels 11+ were authored
    # in later batches, so level_10 is grandmaster while level_11 is apprentice. Ordering by
    # id inside a tier was not enough either — it put a 5-bottle board after a 6-bottle one.
    # So the ladder is ordered by what actually makes a board harder: tier, then how many
    # bottles are in play, then colours, then hidden layers, with the id only breaking ties.
    ordered = sorted(levels, key=lambda level: (
        TIER_RANK[level["difficultyTier"]],
        level["bottles"],
        level["colours"],
        level["hiddenLayers"],
        _level_number(level),
    ))
    # Cheap guarantee that the ramp never steps back — the previous check only compared XP,
    # which is per tier and so blind to a regression inside one.
    for earlier, later in zip(ordered, ordered[1:]):
        if later["bottles"] < earlier["bottles"]:
            raise SystemExit(
                f"ladder goes backwards: {later['id']} ({later['bottles']} bottles) follows "
                f"{earlier['id']} ({earlier['bottles']} bottles)"
            )
    return ordered


def _level_number(level: dict) -> int:
    return int(str(level["id"]).rsplit("_", 1)[-1])


# Every id this seed owns. The two sudoku ids stay listed so re-running removes the
# sudoku questions an earlier revision of this seed left in the deck.
RETIRED_SUDOKU_QUESTION_IDS = {"seed-g1-logic-q-fruit-sudoku", "seed-g1-logic-q-number-sudoku"}
QUESTION_IDS = RETIRED_SUDOKU_QUESTION_IDS | {
    skill_id_for(f"level_{n}").replace("skill", "q", 1) for n in range(1, 41)
} | {
    f"seed-g1-logic-q-goods-level-{n}" for n in range(1, 41)
}

def now() -> datetime:
    return datetime.now(timezone.utc)


def _liquid_sort_question(
    *,
    skill_id: str,
    title: str,
    instruction: str,
    level_id: str,
    difficulty_tier: str,
    bottles: int,
    layers: dict[str, int],
    difficulty: str,
) -> dict:
    return {
        "id": skill_id.replace("skill", "q", 1),
        "curriculumId": CURRICULUM_ID,
        "title": title,
        "instruction": instruction,
        "technique": "LIQUID_SORT",
        "skillId": skill_id,
        "difficulty": difficulty,
        "objectId": "star",
        "targetCount": bottles,
        "config": {
            "levelId": level_id,
            "difficultyTier": difficulty_tier,
            # Colour -> number of layers the level starts with. Split into the release's
            # private grading blob (GRADING_KEY_FIELDS) and used by grade_liquid_sort to
            # confirm a submitted board still holds the level's liquid. Must match the
            # level in frontend/src/components/canvases/liquidSortLevels.ts.
            "liquidSortLayers": layers,
        },
    }


def _level_title(level: dict) -> str:
    """Drop the source level number: the ladder is ordered by difficulty, so keeping it
    would show "Level 11" sitting before "Level 6". Position is carried by `order`."""
    _, _, name = level["name"].partition(": ")
    return name or level["name"]


def _level_instruction(level: dict) -> str:
    base = "Pour the colours between bottles until each bottle holds just one colour."
    if level["hiddenLayers"]:
        return base + " Some layers stay hidden until you pour the one above them."
    return base


def logic_questions(levels: list[dict]) -> list[dict]:
    return [
        _liquid_sort_question(
            skill_id=skill_id_for(level["id"]),
            title=_level_title(level),
            instruction=_level_instruction(level),
            level_id=level["id"],
            difficulty_tier=level["difficultyTier"],
            bottles=level["bottles"],
            layers=level["layers"],
            difficulty=TIER_DIFFICULTY[level["difficultyTier"]],
        )
        for level in levels
    ]


def _sort_skills(levels: list[dict]) -> list[dict]:
    """One skill per level, all in a single unit, ordered level 1 → 20.

    Deliberately no `prerequisiteSkillIds`. The recommendation engine only counts a
    prerequisite as met once the earlier skill reaches *developing* — score >= 0.6 with
    at least 6 plays (progression/scoring.py). Each level here is a single puzzle, so a
    chain would mean replaying one board six times before the next level could ever be
    offered; in practice nothing qualified as `new` and the engine fell through to its
    stretch fallback, which serves the *last* skill — handing a Grade 1 learner the
    10-bottle grandmaster board straight after level 1.

    Ordering is carried by the frontier instead: it advances past any skill that has
    mastery, so finishing level N makes level N+1 the next `new` item.
    """
    skills = []
    for index, level in enumerate(levels, start=1):
        tier = level["difficultyTier"]
        skills.append({
            "id": skill_id_for(level["id"]),
            "unitId": UNIT_SORT,
            "label": f"Sort {level['colours']} colours across {level['bottles']} bottles",
            # `order` and `placementCheckpoint` are stamped by `_interleave_ladders`, which
            # is the only place that can see both ladders and so the only place that knows
            # a skill's position in the subject.
            "_tier": tier,
            "_rung": index,
            "minQuestions": 1,
            "prerequisiteSkillIds": [],
            "completionXp": TIER_XP[tier],
            "presentation": {
                "title": _level_title(level),
                "description": level["description"],
                "estimatedMinutes": TIER_MINUTES[tier],
                "thumbnailUrl": "/assets/components/liquid-sort.svg",
                "accent": TIER_ACCENT[tier],
            },
        })
    return skills


def logic_tree(levels: list[dict], goods_levels: list[dict]) -> dict:
    skills = _interleave_ladders(_sort_skills(levels), _goods_skills(goods_levels))
    units = [
        (
            UNIT_SORT,
            "Liquid Bottle Sort",
            "Every level, from the first pour to the vault — play them in order.",
            "sparkles",
            "blue",
        ),
        (
            UNIT_GOODS,
            "Goods Shelf Sort",
            "Thirty shelves, from a two-item counter to the whole store — play them in order.",
            "puzzle",
            "amber",
        ),
    ]
    return {
        "title": "Grade 1 Thinking & Logic",
        "description": (
            "Plan a sequence of moves until every bottle holds a single colour and every "
            "shelf holds a single kind of goods."
        ),
        "version": "starter-1.0",
        "primaryGradeId": GRADE_ID,
        "primarySubjectId": SUBJECT_ID,
        "grades": [{"id": GRADE_ID, "label": "Grade 1", "order": 1}],
        "subjects": [{"id": SUBJECT_ID, "gradeId": GRADE_ID, "label": "Thinking & Logic", "order": 3}],
        "units": [
            {
                "id": unit_id,
                "subjectId": SUBJECT_ID,
                "label": label,
                "description": description,
                "presentation": {"icon": icon, "accent": accent},
                "order": index,
            }
            for index, (unit_id, label, description, icon, accent) in enumerate(units, start=1)
        ],
        "skills": skills,
        "rewards": {
            "quest": {"label": "Sorting quest", "activitiesPerSession": 2},
            "xp": {"correctAnswer": 5, "firstTryBonus": 2, "activityCompletion": 20},
            "level": {"xpPerLevel": 120},
            "achievements": [],
        },
    }


# ── Goods Shelf Sort: the second ladder ─────────────────────────────────────────

def load_goods_levels() -> list[dict]:
    """Read the exported ladder, in the order the canvas authored it.

    Unlike the liquid levels this is not re-sorted here. Goods boards are built from an
    ordered spec table whose array order *is* the ladder, and the frontend test asserts
    that difficulty never steps backwards inside a tier — re-deriving an order from the
    exported numbers would only be a second, weaker opinion about the same thing.
    """
    if not GOODS_LEVELS_PATH.exists():
        raise SystemExit(
            f"{GOODS_LEVELS_PATH} is missing — run `npm run export:goods-sort-levels` in frontend/"
        )
    levels = json.loads(GOODS_LEVELS_PATH.read_text(encoding="utf-8"))
    for level in levels:
        if not level.get("counts"):
            raise SystemExit(f"{level.get('id')!r} has no goods — regenerate the export")
        if level["difficultyTier"] not in TIER_DIFFICULTY:
            raise SystemExit(f"{level['id']!r} has unknown tier {level['difficultyTier']!r}")

    # The export plays every board out with the solver and marks the ones it cannot
    # finish. Authoring a skill for one of those gives a learner a board they can never
    # complete, which then sits unfinished on their path — so they are left out entirely.
    for level in [item for item in levels if item.get("solvable") is False]:
        print(
            f"  skipping {level['id']} ({level['name']}): unsolvable — "
            + ", ".join(level.get("unbalancedGoods") or ["the solver could not finish it"])
        )
    levels = [level for level in levels if level.get("solvable") is not False]

    # Grade 1 only gets the boards that sit inside the Liquid Sort ladder's envelope.
    #
    # Measured, not guessed. Liquid tops out at 10 bottles, 32 units of liquid and ~36
    # pours — that is the hardest thing a Grade 1 learner is asked for anywhere in this
    # subject. The goods ladder runs a long way past it: its last board is 20 compartments
    # and 72 items, more than twice the objects, on a 4x5 grid where each one draws about
    # 20px. Interleaving the two ladders by tier only aligns them if the tiers mean
    # comparable things, and above 40 items they stop meaning comparable things.
    #
    # The excluded boards are not deleted. They keep their ids and stay playable in the
    # studio and the preview, so a Grade 2/3 subject can seed them unchanged by raising
    # these two numbers.
    playable = [
        level for level in levels
        if level["items"] <= GRADE1_MAX_ITEMS and level["shelves"] <= GRADE1_MAX_SHELVES
    ]
    for level in levels:
        if level not in playable:
            print(
                f"  holding back {level['id']} ({level['name']}): "
                f"{level['items']} items across {level['shelves']} compartments — "
                f"beyond Grade 1 (max {GRADE1_MAX_ITEMS}/{GRADE1_MAX_SHELVES})"
            )
    if not playable:
        raise SystemExit("no Grade 1 goods levels to seed — fix goodsSortLevels.ts and re-export")
    return playable


def goods_skill_id_for(level_id: str) -> str:
    return f"seed-g1-logic-skill-goods-{level_id.replace('_', '-')}"


def _goods_instruction(level: dict) -> str:
    """What to do, in the plainest words — not what to do *well*.

    The strategy line (`teaches`, e.g. "An empty compartment is worth more than a
    nearly-full one — spend it late") was being used as the question instruction. It is an
    adult sentence, and it is not an instruction: a six-year-old opening the activity needs
    to be told the goal, not coached on it. The strategy line still reaches them, on the
    canvas's own coach line while they play, which is where advice belongs.

    Mirrors `_level_instruction` for the liquid ladder deliberately — one subject, one
    voice.
    """
    base = "Move the goods between compartments until each compartment holds just one kind."
    if level["compartmentCapacity"] >= 4:
        return base + " Here a full set is four."
    return base


def _goods_minutes(level: dict) -> int:
    """Size the estimate from the board, not from its tier.

    A flat per-tier number said 10 minutes for every grandmaster board, whether it needed
    26 moves or 36. `moveFloor` is the fewest moves that can finish it; 20 seconds a move
    is a beginner's pace with thinking, hesitation and a few undos in it.
    """
    return max(2, min(12, round(level["moveFloor"] * 20 / 60)))


def _goods_title(level: dict) -> str:
    """Drop the source level number: position is carried by `order`, and the number in
    the name would only contradict it the moment a level is inserted or retired."""
    _, _, name = level["name"].partition(": ")
    return name or level["name"]


def goods_questions(levels: list[dict]) -> list[dict]:
    return [
        {
            "id": goods_skill_id_for(level["id"]).replace("skill", "q", 1),
            "curriculumId": CURRICULUM_ID,
            "title": _goods_title(level),
            "instruction": _goods_instruction(level),
            "technique": "GOODS_SORT",
            "skillId": goods_skill_id_for(level["id"]),
            "difficulty": TIER_DIFFICULTY[level["difficultyTier"]],
            "objectId": "star",
            "targetCount": level["kinds"],
            "config": {
                "levelId": level["id"],
                "difficultyTier": level["difficultyTier"],
                # Goods type -> how many the board holds. Split into the release's private
                # grading blob (GRADING_KEY_FIELDS) and used by grade_goods_sort to confirm
                # a submitted shelf still holds the level's goods. Must match the level in
                # frontend/src/components/canvases/goodsSortLevels.ts.
                "goodsSortCounts": level["counts"],
            },
        }
        for level in levels
    ]


def _goods_skills(levels: list[dict]) -> list[dict]:
    """One skill per goods level, all in one unit, in ladder order.

    Deliberately no `prerequisiteSkillIds`, for the same reason as `_sort_skills`.
    `order` and `placementCheckpoint` are stamped by `_interleave_ladders`.
    """
    skills = []
    for index, level in enumerate(levels, start=1):
        tier = level["difficultyTier"]
        kinds = level["kinds"]
        skills.append({
            "id": goods_skill_id_for(level["id"]),
            "unitId": UNIT_GOODS,
            "label": f"Group {kinds} kinds of goods into {kinds} compartments",
            "_tier": tier,
            "_rung": index,
            "minQuestions": 1,
            "prerequisiteSkillIds": [],
            "completionXp": TIER_XP[tier],
            "presentation": {
                "title": _goods_title(level),
                "description": level["description"],
                "estimatedMinutes": _goods_minutes(level),
                "thumbnailUrl": "/assets/components/goods-sort.svg",
                "accent": TIER_ACCENT[tier],
            },
        })
    return skills


def _interleave_ladders(*ladders: list[dict]) -> list[dict]:
    """Weave the ladders together by difficulty tier, and stamp `order`.

    Appending one ladder after the other is the obvious thing and it is wrong: it made a
    Grade 1 learner finish the ten-bottle grandmaster liquid board — the hardest thing in
    the subject — before being shown the two-kind goods shelf that is its gentlest. The
    frontier walks `order`, so `order` has to express difficulty across the whole subject,
    not within one game.

    Inside a tier the two games alternate, spread evenly so the longer ladder does not
    bunch up at the end. Alternating is also the point pedagogically: the games teach the
    same planning from different directions — Liquid Sort restricts *where* a colour may
    go, Goods Sort lets anything go anywhere but makes space the scarce thing — and a
    learner who can do both has learned to sort rather than memorised one game's trick.

    Each ladder's opening board is a placement checkpoint, so a quiz can see both games.
    Both sit at the very start, where passing one can only mark the other's opener
    eligible — the "checkpoint per tier" version let placement skip most of the subject.
    """
    ordered: list[dict] = []
    for tier in sorted(TIER_RANK, key=TIER_RANK.get):
        in_tier = [[skill for skill in ladder if skill["_tier"] == tier] for ladder in ladders]
        longest = max((len(group) for group in in_tier), default=0)
        # Position each ladder's rungs evenly across the tier, so 5 goods levels interleave
        # with 3 liquid ones as G L G L G rather than G L G L G-G-G.
        spread = sorted(
            (
                ((position + 0.5) / len(group), index, skill)
                for index, group in enumerate(in_tier)
                for position, skill in enumerate(group)
            ),
            key=lambda item: (item[0], item[1]),
        )
        ordered.extend(skill for _, _, skill in spread)
        del longest

    opened: set[str] = set()
    for index, skill in enumerate(ordered, start=1):
        skill["order"] = index
        skill["placementCheckpoint"] = skill["unitId"] not in opened
        opened.add(skill["unitId"])
        skill.pop("_tier", None)
        skill.pop("_rung", None)
    return ordered


# ── Catalog + persistence ───────────────────────────────────────────────────────

async def _owner_id() -> str:
    existing = await Subject.find_one(Subject.grade_id == GRADE_ID)
    if existing:
        return existing.created_by
    admin = await User.find_one(User.role == "admin")
    if not admin:
        raise SystemExit("Create or seed an admin account before seeding Thinking & Logic")
    return str(admin.id)


async def _ensure_catalog(owner_id: str) -> Subject:
    grade = await Grade.find_one(Grade.key == GRADE_ID)
    if not grade:
        raise SystemExit(f"Grade {GRADE_ID!r} is missing — seed the Grade 1 curriculum first")

    subject = await Subject.find_one(Subject.key == SUBJECT_ID)
    if not subject:
        subject = Subject(
            key=SUBJECT_ID,
            grade_id=GRADE_ID,
            code="LOGIC",
            name="Thinking & Logic",
            description=(
                "Sequencing and planning: pour the bottles until every colour stands "
                "alone, and sort the shelves until every kind of goods has its own."
            ),
            icon="Brain",
            color="#7C3AED",
            order=3,
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
        levels = load_levels()
        goods_levels = load_goods_levels()
        tree = logic_tree(levels, goods_levels)
        questions = logic_questions(levels) + goods_questions(goods_levels)

        draft = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
        if draft:
            draft.tree = tree
            draft.published = True
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

        deck = await QuestionDeck.find_one(QuestionDeck.owner_id == owner_id)
        if deck:
            deck.questions = [item for item in deck.questions if item.get("id") not in QUESTION_IDS] + questions
            deck.revision += 1
            deck.updated_at = now()
            await deck.save()
        else:
            await QuestionDeck(owner_id=owner_id, questions=questions, revision=1).insert()

        # Releases are immutable and their revision is unique per curriculum, so neither
        # the id nor the revision can be hardcoded here: Curriculum Studio publishes into
        # the same sequence (it had already taken revisions 7 and 8). Identical content
        # reuses the existing release, and changed content always cuts the next revision.
        payload = build_release_payload(tree=tree, questions=questions, assets=[])
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
        release_id = release.release_id

        offering = await CurriculumOffering.find_one(
            CurriculumOffering.grade_id == GRADE_ID,
            CurriculumOffering.subject_id == SUBJECT_ID,
        )
        if offering:
            if (
                offering.curriculum_id != CURRICULUM_ID
                or offering.release_id != release_id
                or not offering.active
            ):
                offering.curriculum_id = CURRICULUM_ID
                offering.release_id = release_id
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
                release_id=release_id,
                created_by=owner_id,
                updated_by=owner_id,
            ).insert()

        from app.features.content.grading import supported_techniques

        graded = supported_techniques()
        print({
            "subject": SUBJECT_ID,
            "curriculum": CURRICULUM_ID,
            "release": release_id,
            "offering": f"{GRADE_ID}/{SUBJECT_ID}",
            "units": len(tree["units"]),
            "skills": len(tree["skills"]),
            "questions": len(questions),
            "serverGraded": sorted({q["technique"] for q in questions if q["technique"] in graded}),
            "notGraded": sorted({q["technique"] for q in questions if q["technique"] not in graded}),
        })
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
