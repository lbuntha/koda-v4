"""Author a rewards block for curricula that have none.

A curriculum with no `rewards` earns its learners nothing. That is deliberate — the engine
refuses to mint XP nobody authored (see DEFAULT_REWARDS) — but the failure is silent: no
error, no warning, just a counter that never moves while a child keeps playing. Two of the
three curricula on this database were in that state, including the 30-skill Grade 1
Mathematics that is being actively authored.

The values are sized against the curriculum rather than picked to look nice:

    5 questions/skill x (4 correct + 2 first-try) + 12 completion = 42 XP per skill
    3 activities per session                                      = 126 XP per session
    xpPerLevel 120                                                -> one level per session

which gives ~10 levels across a 30-skill year. A level per completed quest is frequent enough
for a six-year-old to feel it, and still requires finishing all three activities to reach.

Achievement targets are derived from the curriculum's real size, so none of them can ask for
more skills than exist — `auditRewards` in the frontend now flags that case, and this script
must not create it.

    docker compose exec api python scripts/author_curriculum_rewards.py            # preview
    docker compose exec api python scripts/author_curriculum_rewards.py --apply    # write
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone  # noqa: E402

from app.core.db import init_db  # noqa: E402
from app.features.content.schemas import CurriculumIn  # noqa: E402
from app.models.audit import ContentAuditEvent  # noqa: E402
from app.models.content import Curriculum  # noqa: E402

XP = {"correctAnswer": 4, "firstTryBonus": 2, "activityCompletion": 12}
XP_PER_LEVEL = 120
ACTIVITIES_PER_SESSION = 3


def achievements_for(skill_count: int) -> list[dict]:
    """Badges scaled to what this curriculum can actually produce.

    Every skill-based target is a fraction of the real skill count, so a curriculum of 6
    skills and one of 60 both get a ladder that ends at something reachable.
    """
    third = max(1, round(skill_count / 3))
    half = max(1, round(skill_count / 2))
    return [
        {"id": "first-activity", "label": "First Steps",
         "description": "Finish your first activity.",
         "metric": "lessonsCompleted", "target": 1, "icon": "star", "accent": "purple"},
        {"id": "ten-activities", "label": "Getting Going",
         "description": f"Finish {third} activities.",
         "metric": "lessonsCompleted", "target": third, "icon": "award", "accent": "blue"},
        {"id": "every-skill", "label": "Every Skill Tried",
         "description": "Finish an activity in every skill.",
         "metric": "lessonsCompleted", "target": skill_count, "icon": "trophy", "accent": "pink"},
        {"id": "sharp-start", "label": "Sharp Start",
         "description": "Get 25 answers right on the first try.",
         "metric": "firstTryCorrect", "target": 25, "icon": "medal", "accent": "green"},
        {"id": "confident", "label": "Confident",
         "description": f"Reach Proficient in {third} skills.",
         "metric": "proficientSkills", "target": third, "icon": "medal", "accent": "amber"},
        {"id": "halfway", "label": "Halfway There",
         "description": f"Reach Proficient in {half} skills.",
         "metric": "proficientSkills", "target": half, "icon": "trophy", "accent": "purple"},
        {"id": "skill-master", "label": "Skill Master",
         "description": f"Master {third} skills.",
         "metric": "masteredSkills", "target": third, "icon": "trophy", "accent": "blue"},
        {"id": "gem-collector", "label": "Gem Collector",
         "description": "Earn 500 XP from practice.",
         "metric": "xpEarned", "target": 500, "icon": "gem", "accent": "blue"},
        {"id": "streak-star", "label": "Streak Star",
         "description": "Practise five days in a row.",
         "metric": "streakDays", "target": 5, "icon": "flame", "accent": "amber"},
    ]


def rewards_for(tree: dict) -> dict:
    subject = (tree.get("title") or "learning").replace(" Mathematics", " maths")
    return {
        "quest": {
            "label": f"Today’s {subject.split()[-1]} quest",
            "activitiesPerSession": ACTIVITIES_PER_SESSION,
        },
        "xp": dict(XP),
        "level": {"xpPerLevel": XP_PER_LEVEL},
        "achievements": achievements_for(len(tree.get("skills") or [])),
    }


async def main(apply: bool) -> None:
    await init_db()
    for doc in await Curriculum.find(Curriculum.archived_at == None).to_list():  # noqa: E711
        tree = doc.tree or {}
        title = tree.get("title") or doc.curriculum_id
        if tree.get("rewards"):
            print(f"skip  {title} — already has rewards")
            continue

        proposed = {**tree, "rewards": rewards_for(tree)}
        # The same validator the PUT endpoint runs, so this cannot write a tree the API
        # would refuse — including the reward bounds it enforces.
        try:
            CurriculumIn(tree=proposed, revision=doc.revision, published=doc.published)
        except Exception as error:
            print(f"REFUSED {title}: {error}")
            continue

        skills = len(tree.get("skills") or [])
        per_skill = 5 * XP["correctAnswer"] + 5 * XP["firstTryBonus"] + XP["activityCompletion"]
        print(
            f"{'write' if apply else 'would write'}  {title} — {skills} skills, "
            f"{per_skill} XP/skill, {per_skill * ACTIVITIES_PER_SESSION} XP/session, "
            f"~{per_skill * skills / XP_PER_LEVEL:.0f} levels"
        )
        if not apply:
            continue

        doc.tree = proposed
        doc.revision += 1
        doc.updated_at = datetime.now(timezone.utc)
        await doc.save()
        await ContentAuditEvent(
            actor_id="script", actor_role="admin", owner_id=doc.owner_id,
            resource_type="curriculum", curriculum_id=doc.curriculum_id,
            action="rewards_authored", revision=doc.revision,
            summary={"xp": XP, "xpPerLevel": XP_PER_LEVEL, "achievements": 9},
        ).insert()


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
