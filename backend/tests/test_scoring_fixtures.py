"""Cross-language parity test (backend side).

Asserts the backend proficiency engine reproduces the shared fixtures in
shared/scoring-fixtures.json. The frontend reference engine asserts the same file
in frontend/src/services/scoringEngine.fixtures.test.ts — together they prove the
two implementations agree for one config + one event set. Regenerate the fixtures
with `scripts/gen_scoring_fixtures.py` after any intentional engine change.
"""

import json
import os

import pytest

from app.features.progression.scoring import DEFAULT_SCORING_CONFIG, score_skill

_FIXTURE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "shared", "scoring-fixtures.json",
)

with open(_FIXTURE_PATH, encoding="utf-8") as f:
    _FIXTURES = json.load(f)


@pytest.mark.parametrize("case", _FIXTURES["cases"], ids=lambda c: c["name"])
def test_scoring_fixture(case):
    config = case.get("config", DEFAULT_SCORING_CONFIG)
    r = score_skill("stu-1", "skill-1", case["events"], config, _FIXTURES["nowMs"])
    e = case["expected"]

    assert r["level"] == e["level"]
    assert r["plays"] == e["plays"]
    assert r["attempts"] == e["attempts"]
    assert r["sessions"] == e["sessions"]
    assert r["distinctDays"] == e["distinctDays"]
    assert r["hardPlays"] == e["hardPlays"]
    assert r["difficultyTagged"] == e["difficultyTagged"]
    assert r["nextLevel"] == e["nextLevel"]
    assert r["isDue"] == e["isDue"]
    assert r["lastSuccessfulReviewAt"] == e["lastSuccessfulReviewAt"]
    assert r["lastReviewOutcome"] == e["lastReviewOutcome"]
    assert r["nextReviewAtMs"] == e["nextReviewAtMs"]
    assert abs(r["score"] - e["score6"]) < 1e-6
    assert abs(r["recentScore"] - e["recentScore6"]) < 1e-6


def test_fixture_set_is_nonempty_and_covers_every_level():
    levels = {c["expected"]["level"] for c in _FIXTURES["cases"]}
    assert {"not_started", "beginner", "developing", "proficient", "master"} <= levels
