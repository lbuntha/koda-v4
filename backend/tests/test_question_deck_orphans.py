"""Saving a question deck that references a deleted skill.

Found on a real database: one question of 110 pointed at a skill that had been deleted from a
curriculum. Because the endpoint validated the *whole* deck on every save, every subsequent
save failed with 400 — including saves unrelated to that question, and including the very deck
the server had just served. The studio could not be unstuck from inside the app, and reported
the 400 to the author as "MongoDB unavailable".

The rule now: a save may not *introduce* a dangling reference, but it may carry one it
inherited.
"""

from __future__ import annotations

import pytest_asyncio

from app.models.content import Curriculum, QuestionDeck
from app.models.user import Role, User
from app.core.security import hash_secret

from .conftest import auth

LIVE = "skill-live"
DELETED = "skill-deleted"


def question(question_id: str, skill_id: str | None) -> dict:
    return {
        "id": question_id, "title": question_id, "technique": "count_on", "skillId": skill_id,
    }


@pytest_asyncio.fixture
async def author(database) -> User:
    user = User(
        email="author@example.com", name="Author",
        password_hash=hash_secret("correct-horse-battery"), role=Role.admin.value,
    )
    await user.insert()
    await Curriculum(
        owner_id=str(user.id), curriculum_id="c1", revision=1,
        tree={"title": "Grade 1", "skills": [{"id": LIVE, "label": "Live skill"}]},
    ).insert()
    return user


async def save(api, user: User, questions: list[dict], revision: int):
    return await api.put(
        "/questions",
        json={"questions": questions, "revision": revision},
        headers=auth(str(user.id), Role.admin.value),
    )


async def test_a_deck_with_only_live_skills_saves(api, author):
    response = await save(api, author, [question("q1", LIVE)], 0)
    assert response.status_code == 200


async def test_a_new_question_may_not_point_at_a_missing_skill(api, author):
    """The guard still does its job for references this save introduces."""
    response = await save(api, author, [question("q1", DELETED)], 0)
    assert response.status_code == 400
    assert DELETED in response.json()["detail"]


async def test_an_inherited_orphan_does_not_block_saving(api, author):
    """The deadlock. The orphan is already stored; editing anything else must still work."""
    await QuestionDeck(
        owner_id=str(author.id), revision=1,
        questions=[question("q1", LIVE), question("orphan", DELETED)],
    ).insert()

    # An edit that has nothing to do with the orphan.
    response = await save(
        api, author, [question("q1", LIVE), question("orphan", DELETED), question("q2", LIVE)], 1,
    )
    assert response.status_code == 200
    stored = await QuestionDeck.find_one(QuestionDeck.owner_id == str(author.id))
    assert [q["id"] for q in stored.questions] == ["q1", "orphan", "q2"]
    # Carried through untouched rather than silently dropped — it is the author's content.
    assert stored.questions[1]["skillId"] == DELETED


async def test_removing_the_orphan_is_still_allowed(api, author):
    await QuestionDeck(
        owner_id=str(author.id), revision=1,
        questions=[question("q1", LIVE), question("orphan", DELETED)],
    ).insert()

    response = await save(api, author, [question("q1", LIVE)], 1)
    assert response.status_code == 200


async def test_a_second_new_orphan_is_still_rejected_even_beside_an_inherited_one(api, author):
    """Inheriting one dangling reference must not license adding more."""
    await QuestionDeck(
        owner_id=str(author.id), revision=1,
        questions=[question("orphan", DELETED)],
    ).insert()

    response = await save(
        api, author, [question("orphan", DELETED), question("q2", "skill-brand-new-missing")], 1,
    )
    assert response.status_code == 400
    assert "skill-brand-new-missing" in response.json()["detail"]
    assert DELETED not in response.json()["detail"]
