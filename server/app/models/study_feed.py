"""What students of the same age finished this week.

Only small, approved facts leave a family: a parent-approved nickname, the
avatar, and which lesson or book was finished. No scores, no real names, and
nothing from a learner whose family has not turned sharing on.
"""

from typing import Literal

from pydantic import Field

from app.models.common import Model


class StudyItem(Model):
    id: str
    nickname: str
    avatar_seed: str | None = Field(default=None, alias="avatarSeed")
    kind: Literal["lesson", "book"]
    skill_id: str = Field(alias="skillId")
    lesson_id: str = Field(alias="lessonId")
    title: str | None = None
    at: str
    is_buddy: bool = Field(alias="isBuddy")
    cheers: int = 0
    cheered_by_me: bool = Field(default=False, alias="cheeredByMe")


class PopularItem(Model):
    kind: Literal["lesson", "book"]
    skill_id: str = Field(alias="skillId")
    lesson_id: str = Field(alias="lessonId")
    title: str | None = None
    learners: int = Field(ge=0)


class StudyFeedOut(Model):
    # [youngest, oldest] of the viewer's age group, or None when the age is unknown.
    band: list[int] | None = None
    sharing_enabled: bool = Field(alias="sharingEnabled")
    popular: list[PopularItem]
    items: list[StudyItem]


class CheerOut(Model):
    cheers: int
    cheered_by_me: bool = Field(alias="cheeredByMe")
