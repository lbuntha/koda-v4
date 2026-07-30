from app.features.content.offerings import infer_assignment_subject, release_includes, subject_ids_for_grade


TREE = {
    "primaryGradeId": "grade-1",
    "primarySubjectId": "grade-1-math",
    "grades": [{"id": "grade-1"}],
    "subjects": [
        {"id": "grade-1-math", "gradeId": "grade-1"},
        {"id": "grade-1-reading", "gradeId": "grade-1"},
    ],
    "units": [
        {"id": "math-unit", "subjectId": "grade-1-math"},
        {"id": "reading-unit", "subjectId": "grade-1-reading"},
    ],
    "skills": [
        {"id": "count", "unitId": "math-unit"},
        {"id": "letters", "unitId": "reading-unit"},
    ],
}


def test_release_match_requires_subject_to_belong_to_requested_grade():
    assert release_includes(TREE, "grade-1", "grade-1-math") is True
    assert release_includes(TREE, "grade-2", "grade-1-math") is False


def test_subjects_are_scoped_to_grade():
    assert subject_ids_for_grade(TREE, "grade-1") == ["grade-1-math", "grade-1-reading"]


def test_all_scope_uses_valid_primary_subject():
    assert infer_assignment_subject(TREE, "grade-1", {"kind": "all", "ids": []}) == "grade-1-math"


def test_unit_scope_identifies_its_subject():
    assert infer_assignment_subject(TREE, "grade-1", {"kind": "units", "ids": ["reading-unit"]}) == "grade-1-reading"


def test_skill_scope_identifies_its_subject():
    assert infer_assignment_subject(TREE, "grade-1", {"kind": "skills", "ids": ["letters"]}) == "grade-1-reading"


def test_cross_subject_scope_is_left_unresolved():
    assert infer_assignment_subject(
        TREE,
        "grade-1",
        {"kind": "skills", "ids": ["count", "letters"]},
    ) is None
