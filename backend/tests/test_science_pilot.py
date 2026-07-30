from app.features.content.grading import grade
from app.features.content.release import build_release_payload
from app.features.content.schemas import CurriculumIn
from scripts.seed_grade1_science_pilot import pilot_question, pilot_tree, science_questions


def test_science_pilot_builds_a_valid_release():
    tree = pilot_tree()
    CurriculumIn(tree=tree)
    payload = build_release_payload(tree=tree, questions=science_questions(), assets=[])
    assert len(payload["question_manifest"]) == 4
    assert payload["question_manifest"][0]["skill_id"] == "seed-g1-science-skill-living-things"
    assert all(skill["minQuestions"] == 1 for skill in tree["skills"])


def test_science_classification_is_server_graded():
    entry = build_release_payload(tree=pilot_tree(), questions=science_questions(), assets=[])["question_manifest"][0]
    selection = {
        item["id"]: item["targetBin"]
        for item in pilot_question()["config"]["flexibleItems"]
    }
    assert grade(entry, selection) == "correct"
    assert grade(entry, {**selection, "science-rock": "science-living"}) == "incorrect"


def test_every_science_activity_is_server_graded():
    questions = science_questions()
    entries = build_release_payload(tree=pilot_tree(), questions=questions, assets=[])["question_manifest"]
    by_id = {entry["question_id"]: entry for entry in entries}
    for question in questions:
        selection = {
            item["id"]: item["targetBin"]
            for item in question["config"]["flexibleItems"]
        }
        assert grade(by_id[question["id"]], selection) == "correct"
