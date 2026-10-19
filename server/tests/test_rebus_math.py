"""Math questions: the answer is worked out from the numbers, so it cannot be wrong."""

import json
from pathlib import Path

import pytest

from app import rebus_math, rebus_room
from app.rebus_verify import answer_key, validate_puzzle
from app.repos import rebus as repo

SEED = json.loads((Path(__file__).parent.parent / "app" / "rebus_seed.json").read_text())

#: The same cases, in the same order, as `src/rebus/math.test.ts`.
SOUND = [
    ({"a": 7, "op": "×", "b": 8, "unknown": "result"}, "7 × 8 = ?", 56),
    ({"a": 7, "op": "×", "b": 8, "unknown": "b"}, "7 × ? = 56", 8),
    ({"a": 7, "op": "×", "b": 8, "unknown": "a"}, "? × 8 = 56", 7),
    ({"a": 12, "op": "−", "b": 5, "unknown": "a"}, "? − 5 = 7", 12),
    ({"a": 18, "op": "÷", "b": 3, "unknown": "result"}, "18 ÷ 3 = ?", 6),
    ({"a": 9, "op": "+", "b": 6, "unknown": "b"}, "9 + ? = 15", 6),
]
UNSOUND = [
    ({"a": 5, "op": "−", "b": 7, "unknown": "result"}, "bad-math-result"),
    ({"a": 7, "op": "÷", "b": 2, "unknown": "result"}, "bad-math-result"),
    ({"a": 7, "op": "÷", "b": 0, "unknown": "result"}, "bad-math-result"),
    ({"a": 9000, "op": "+", "b": 2000, "unknown": "result"}, "bad-math-result"),
    ({"a": 2.5, "op": "+", "b": 1, "unknown": "result"}, "bad-math-numbers"),
    ({"a": -1, "op": "+", "b": 1, "unknown": "result"}, "bad-math-numbers"),
    ({"a": 10000, "op": "+", "b": 1, "unknown": "result"}, "bad-math-numbers"),
    ({"a": 5, "op": "x", "b": 1, "unknown": "result"}, "bad-math-op"),
    ({"a": 5, "op": "+", "b": 1, "unknown": "c"}, "bad-math-op"),
    ({"a": 5, "op": "×", "b": 0, "unknown": "a"}, "bad-math-missing"),
    ({"a": 0, "op": "÷", "b": 5, "unknown": "b"}, "bad-math-missing"),
]


@pytest.mark.parametrize(("spec", "prompt", "answer"), SOUND)
def test_the_prompt_and_answer_come_from_the_numbers(spec, prompt, answer):
    assert rebus_math.problem(spec) is None
    assert rebus_math.prompt(spec) == prompt
    assert rebus_math.answer(spec) == answer


@pytest.mark.parametrize(("spec", "code"), UNSOUND)
def test_numbers_that_do_not_make_a_question_are_refused(spec, code):
    assert rebus_math.problem(spec) == code


def test_every_math_puzzle_that_ships_is_sound_and_in_step():
    math = [p for p in SEED if p["category"] == "math"]
    assert len(math) >= 90
    known = frozenset({"math"})
    assert [(p["id"], codes) for p in math if (codes := validate_puzzle(p, known_categories=known))] == []


def test_two_sums_with_one_answer_are_different_questions_but_the_same_sum_is_not():
    five_plus_eight = {"kind": "math", "math": {"a": 5, "op": "+", "b": 8, "unknown": "result"}, "answer": "13"}
    nine_plus_four = {"kind": "math", "math": {"a": 9, "op": "+", "b": 4, "unknown": "result"}, "answer": "13"}
    assert answer_key(five_plus_eight) != answer_key(nine_plus_four)
    assert answer_key(five_plus_eight) == answer_key(dict(five_plus_eight))
    # A room picks one puzzle per answer, except for math, where it is one per question.
    assert rebus_room.answer_key(five_plus_eight) != rebus_room.answer_key(nine_plus_four)
    assert rebus_room.answer_key({"answer": "Hot dog"}) == "hotdog"


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


def question(a=6, op="×", b=7, unknown="result", **over):
    spec = {"a": a, "op": op, "b": b, "unknown": unknown}
    body = {"category": "math", "ages": [7, 12], "difficulty": 2, "trick": "compound", "kind": "math", "math": spec}
    return {**body, **over}


async def test_an_author_gives_the_numbers_and_gets_the_question_and_answer(client, admin):
    made = await client.post("/rebus/studio/puzzles", json=question(a=61, b=3), headers=admin)
    assert made.status_code == 201, made.text
    body = made.json()
    assert body["pieces"] == [{"kind": "word", "text": "61 × 3 = ?"}] and body["answer"] == "183" and body["explanation"] == "61 × 3 = 183."
    assert body["issues"] == []


async def test_what_an_author_types_for_the_answer_is_ignored(client, admin):
    typed = question(a=61, b=3, answer="999", pieces=[{"kind": "word", "text": "nonsense"}])
    made = await client.post("/rebus/studio/puzzles", json=typed, headers=admin)
    assert made.json()["answer"] == "183" and made.json()["pieces"][0]["text"] == "61 × 3 = ?"


async def test_wrong_numbers_are_saved_as_a_draft_with_the_reason(client, admin):
    made = await client.post("/rebus/studio/puzzles", json=question(a=5, op="−", b=9), headers=admin)
    assert made.status_code == 201 and "bad-math-result" in made.json()["issues"]


async def test_the_same_sum_twice_is_a_duplicate_but_two_sums_with_one_answer_are_not(client, admin):
    first = await client.post("/rebus/studio/puzzles", json=question(a=71, b=3), headers=admin)
    assert first.json()["issues"] == []
    url = f"/rebus/studio/puzzles/{first.json()['id']}/status"
    approved = await client.post(url, json={"status": "approved"}, headers=admin)
    assert approved.status_code == 200, approved.text
    again = await client.post("/rebus/studio/puzzles", json=question(a=71, b=3), headers=admin)
    assert again.json()["issues"] == ["duplicate"]
    other = await client.post("/rebus/studio/puzzles", json=question(a=3, b=71), headers=admin)
    assert other.json()["answer"] == first.json()["answer"] and other.json()["issues"] == []


async def test_changing_the_numbers_changes_the_question_and_the_answer(client, admin):
    made = (await client.post("/rebus/studio/puzzles", json=question(a=62, b=3), headers=admin)).json()
    numbers = {"math": {"a": 62, "op": "+", "b": 3, "unknown": "b"}}
    changed = await client.patch(f"/rebus/studio/puzzles/{made['id']}", json=numbers, headers=admin)
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["pieces"][0]["text"] == "62 + ? = 65" and body["answer"] == "3" and body["issues"] == []


async def test_the_studio_list_can_be_narrowed_to_one_kind_of_question(client, admin):
    await client.post("/rebus/studio/puzzles", json=question(a=64, b=3), headers=admin)
    math = (await client.get("/rebus/studio/puzzles?kind=math&limit=100", headers=admin)).json()
    assert math["total"] >= 109 and all(p["kind"] == "math" for p in math["puzzles"])
    # Puzzles written before kinds existed have none, and are picture puzzles.
    picture = (await client.get("/rebus/studio/puzzles?kind=picture&limit=100", headers=admin)).json()
    assert picture["total"] > 0 and all(p.get("kind", "picture") == "picture" for p in picture["puzzles"])
    assert (await client.get("/rebus/studio/puzzles?kind=choice", headers=admin)).json()["total"] == 0
