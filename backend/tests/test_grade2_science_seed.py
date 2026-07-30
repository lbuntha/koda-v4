from app.features.content.grading import grade
from app.features.content.release import build_release_payload
from app.features.content.schemas import CurriculumIn
from scripts.seed_grade2_science import SKILL_IDS, science_questions, science_tree


def test_grade2_science_builds_a_health_valid_release():
    tree = science_tree()
    questions = science_questions()
    CurriculumIn(tree=tree)
    payload = build_release_payload(tree=tree, questions=questions, assets=[])

    assert len(tree["units"]) == 4
    assert len(tree["skills"]) == 4
    assert len(payload["question_manifest"]) == 4
    assert {entry["skill_id"] for entry in payload["question_manifest"]} == set(SKILL_IDS)
    assert all(skill["minQuestions"] == 1 for skill in tree["skills"])


def test_every_grade2_science_activity_is_server_graded():
    questions = science_questions()
    entries = build_release_payload(tree=science_tree(), questions=questions, assets=[])["question_manifest"]
    by_id = {entry["question_id"]: entry for entry in entries}

    for question in questions:
        selection = {
            item["id"]: item["targetBin"]
            for item in question["config"]["flexibleItems"]
        }
        assert grade(by_id[question["id"]], selection) == "correct"
