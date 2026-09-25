"""The Khmer spelling rules, held to the same cases as the client (khmer-cases.json)."""

import json
from pathlib import Path

import pytest

from app.khmer_spelling import khmer_problem, normalize_khmer, spelling_units

CASES = json.loads((Path(__file__).parent / "fixtures" / "library" / "khmer-cases.json").read_text("utf-8"))


@pytest.mark.parametrize("case", CASES["normalize"], ids=lambda c: c["why"])
def test_normalize(case):
    assert normalize_khmer(case["in"]) == case["out"]
    assert normalize_khmer(case["out"]) == case["out"]


@pytest.mark.parametrize("case", CASES["units"], ids=lambda c: c["why"])
def test_units(case):
    assert spelling_units(case["word"]) == case["units"]
    assert "".join(spelling_units(case["word"])) == normalize_khmer(case["word"])


@pytest.mark.parametrize("case", CASES["problems"], ids=lambda c: c["why"])
def test_problems(case):
    assert khmer_problem(case["word"]) == case["problem"]
