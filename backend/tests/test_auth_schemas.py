import pytest
from pydantic import ValidationError

from app.features.auth.schemas import StudentAvatarIn


@pytest.mark.parametrize(
    "avatar",
    [
        "koda-kid:boy-sky",
        "🦊",
        "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
        "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E",
        '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>',
    ],
)
def test_student_avatar_accepts_signup_picker_values(avatar: str):
    assert StudentAvatarIn(avatar=avatar).avatar == avatar


def test_student_avatar_rejects_empty_value():
    with pytest.raises(ValidationError):
        StudentAvatarIn(avatar="")


@pytest.mark.parametrize("avatar", ["https://example.com/avatar.svg", '<svg onload="alert(1)"></svg>'])
def test_student_avatar_rejects_external_or_executable_artwork(avatar: str):
    with pytest.raises(ValidationError):
        StudentAvatarIn(avatar=avatar)
