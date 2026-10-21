"""Multiple-choice questions: the answer is the option marked right, so it cannot disagree with the screen."""

import json
from pathlib import Path

import pytest

from app import rebus_choice, rebus_room
from app.rebus_verify import answer_key, matches, validate_puzzle
from app.repos import rebus as repo

SEED = json.loads((Path(__file__).parent.parent / "app" / "rebus_seed.json").read_text())

#: The same cases, in the same order, as `src/rebus/choice.test.ts`.
SOUND = [
    {"options": ["Paris", "Rome"], "correct": 0},
    {"options": ["Paris", "Rome", "Madrid"], "correct": 2},
    {"options": ["ភ្នំពេញ", "សៀមរាប", "កំពត", "បាត់ដំបង"], "correct": 1},
]
UNSOUND = [
    ({"options": ["Paris"], "correct": 0}, "choice-options"),
    ({"options": ["a", "b", "c", "d", "e"], "correct": 0}, "choice-options"),
    ({"options": ["Paris", " "], "correct": 0}, "choice-blank"),
    ({"options": ["Paris", "x" * 41], "correct": 0}, "choice-blank"),
    ({"options": ["Paris", "paris!"], "correct": 0}, "choice-duplicate"),
    ({"options": ["Paris", "Rome"], "correct": 2}, "choice-correct"),
    ({"options": ["Paris", "Rome"], "correct": -1}, "choice-correct"),
    (None, "choice-missing"),
    ({"correct": 0}, "choice-missing"),
]


@pytest.mark.parametrize("spec", SOUND)
def test_sound_answers_are_accepted(spec):
    assert rebus_choice.problem(spec) is None
    assert rebus_choice.answer(spec) == spec["options"][spec["correct"]]


@pytest.mark.parametrize(("spec", "code"), UNSOUND)
def test_answers_that_do_not_make_a_question_are_refused(spec, code):
    assert rebus_choice.problem(spec) == code


def question(options=("Paris", "Rome", "Madrid"), correct=0, **over):
    body = {
        "category": "countries",
        "ages": [7, 12],
        "difficulty": 1,
        "trick": "compound",
        "kind": "choice",
        "pieces": [{"kind": "word", "text": "In which city is the Eiffel Tower?"}],
        "choice": {"options": list(options), "correct": correct},
        "explanation": "Paris is the capital of France.",
    }
    return {**body, **over}


def test_a_choice_needs_a_question_and_its_answer_must_follow_the_marked_option():
    assert validate_puzzle({**question(), "answer": "Paris", "accepts": []}) == []
    assert "choice-out-of-step" in validate_puzzle({**question(), "answer": "Rome", "accepts": []})
    assert "no-picture" in validate_puzzle({**question(pieces=[]), "answer": "Paris", "accepts": []})
    # A short answer is fine for a choice ("A", "7"), and the question may even contain it.
    assert validate_puzzle({**question(options=("A", "B"), correct=1), "answer": "B", "accepts": []}) == []


def test_a_choice_is_exact_while_a_typed_answer_forgives_a_slipped_key():
    assert matches("Mississippi", [], "Mississipi") is True
    assert matches("Mississippi", [], "Mississipi", exact=True) is False
    assert matches("Mississippi", [], " mississippi ", exact=True) is True


def test_the_same_answer_under_another_question_is_another_puzzle():
    france = {**question(), "answer": "Paris"}
    other = {**question(pieces=[{"kind": "word", "text": "Where is the Eiffel Tower?"}]), "answer": "Paris"}
    assert answer_key(france) != answer_key(other)
    assert answer_key(france) == answer_key(dict(france))
    assert rebus_room.answer_key(france) != rebus_room.answer_key(other)


@pytest.fixture(autouse=True)
async def seeded(db):
    await repo.ensure_seed(db, SEED)


@pytest.fixture
async def admin(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"), platform_role="admin")
    tokens = (await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_an_author_marks_the_right_option_and_the_answer_follows(client, admin):
    made = await client.post("/rebus/studio/puzzles", json=question(options=(" Paris ", "Rome"), correct=0, answer="wrong"), headers=admin)
    assert made.status_code == 201, made.text
    body = made.json()
    assert body["answer"] == "Paris" and body["choice"]["options"] == ["Paris", "Rome"] and body["issues"] == []


async def test_wrong_answers_are_saved_as_a_draft_with_the_reason(client, admin):
    made = await client.post("/rebus/studio/puzzles", json=question(options=("Paris", "paris"), correct=0), headers=admin)
    assert made.status_code == 201 and "choice-duplicate" in made.json()["issues"]


async def test_changing_which_option_is_right_changes_the_answer(client, admin):
    made = (await client.post("/rebus/studio/puzzles", json=question(), headers=admin)).json()
    marked = {"choice": {"options": ["Paris", "Rome", "Madrid"], "correct": 1}}
    changed = await client.patch(f"/rebus/studio/puzzles/{made['id']}", json=marked, headers=admin)
    assert changed.status_code == 200, changed.text
    assert changed.json()["answer"] == "Rome" and changed.json()["issues"] == []


def test_every_multiple_choice_sample_that_ships_is_sound_and_in_step():
    samples = [p for p in SEED if p.get("kind") == "choice"]
    assert len(samples) >= 12
    known = frozenset({p["category"] for p in samples})
    assert [(p["id"], codes) for p in samples if (codes := validate_puzzle(p, known_categories=known))] == []
    assert all(p["choice"]["options"][p["choice"]["correct"]] == p["answer"] for p in samples)


async def test_a_seeded_question_gains_its_khmer_answers_without_losing_an_edit(db):
    first = next(p for p in SEED if p["id"] == "choice-capital-france")
    assert first["km"]["options"] and len(first["km"]["options"]) == len(first["choice"]["options"])

    # Seeded before it had a Khmer version: the version is added on the next start.
    await db.rebus_puzzles.update_one({"id": first["id"]}, {"$unset": {"km": ""}})
    await repo.ensure_seed(db, SEED)
    assert (await db.rebus_puzzles.find_one({"id": first["id"]}))["km"] == first["km"]

    # One an admin already gave Khmer words is left alone.
    await db.rebus_puzzles.update_one({"id": first["id"]}, {"$set": {"km": {"explanation": "edited"}}})
    await repo.ensure_seed(db, SEED)
    assert (await db.rebus_puzzles.find_one({"id": first["id"]}))["km"] == {"explanation": "edited"}


async def test_the_old_khmer_words_move_to_their_topics_and_the_khmer_only_twins_retire(db):
    dog = next(p for p in SEED if p["id"] == "khmer-dog")
    assert dog["category"] == "animals" and dog["km"]["answer"] == "ឆ្កែ" and "ឆ្កែ" in dog["accepts"]

    # As an earlier start left them: Khmer-only, in the Khmer category, live.
    await db.rebus_puzzles.update_one({"id": dog["id"]}, {"$set": {"category": "khmer", "answer": "ឆ្កែ", "status": "published"}, "$unset": {"km": ""}})
    await db.rebus_puzzles.update_one({"id": "choice-capital-cambodia"}, {"$set": {"status": "published"}})
    await db.rebus_puzzles.insert_one({"id": "choice-km-capital", "category": "khmer", "status": "published", "seeded": True})
    await db.rebus_categories.update_one({"_id": "khmer"}, {"$set": {"enabled": True}})

    await repo.ensure_seed(db, SEED)
    moved = await db.rebus_puzzles.find_one({"id": dog["id"]})
    assert moved["category"] == "animals" and moved["answer"] == "dog" and moved["km"]["answer"] == "ឆ្កែ" and moved["status"] == "published"
    assert (await db.rebus_puzzles.find_one({"id": "choice-km-capital"}))["status"] == "retired"
    assert (await db.rebus_puzzles.find_one({"id": "choice-capital-cambodia"}))["status"] == "published"
    assert (await db.rebus_categories.find_one({"_id": "khmer"}))["enabled"] is False
