import pytest
from pydantic import ValidationError

from app.features.content.schemas import CurriculumIn


def tree(presentation: object) -> dict:
    return {
        "grades": [{"id": "g1", "label": "Grade 1", "order": 1}],
        "subjects": [{"id": "math", "gradeId": "g1", "label": "Math", "order": 1}],
        "units": [{
            "id": "counting",
            "subjectId": "math",
            "label": "Counting",
            "order": 1,
            "presentation": presentation,
        }],
        "skills": [{
            "id": "count-10",
            "unitId": "counting",
            "label": "Count to 10",
            "order": 1,
            "minQuestions": 1,
        }],
    }


def test_unit_presentation_accepts_supported_icon_and_accent():
    value = CurriculumIn(tree=tree({"icon": "hash", "accent": "green"}))
    assert value.tree["units"][0]["presentation"] == {"icon": "hash", "accent": "green"}


@pytest.mark.parametrize("icon", ["leaf", "paw", "weather"])
def test_unit_presentation_accepts_science_icons(icon: str):
    value = CurriculumIn(tree=tree({"icon": icon, "accent": "green"}))
    assert value.tree["units"][0]["presentation"]["icon"] == icon


@pytest.mark.parametrize("presentation", [
    {"icon": "rocket", "accent": "green"},
    {"icon": "hash", "accent": "orange"},
    "hash",
    [],
])
def test_unit_presentation_rejects_unsupported_values(presentation: object):
    with pytest.raises(ValidationError):
        CurriculumIn(tree=tree(presentation))
