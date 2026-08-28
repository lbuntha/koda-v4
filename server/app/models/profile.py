"""The profile's recorded figures, on the wire.

Every field is stored, not computed. `source` is what tells a reader whether the
numbers beside it have been measured yet or are still the seeded samples.
"""

from pydantic import Field

from app.models.common import Model


class ProfileStatsOut(Model):
    #: "placeholder" until something writes a real figure, then "recorded".
    source: str
    updated_at: str | None = Field(default=None, alias="updatedAt")

    day_streak: int = Field(alias="dayStreak")
    longest_streak: int = Field(alias="longestStreak")
    total_xp: int = Field(alias="totalXp")
    level: int
    stars_earned: int = Field(alias="starsEarned")
    lessons_mastered: int = Field(alias="lessonsMastered")
    lessons_available: int = Field(alias="lessonsAvailable")
    daily_goal: int = Field(alias="dailyGoal")
    daily_solved: int = Field(alias="dailySolved")
    top_three_finishes: int = Field(alias="topThreeFinishes")
    league: str | None = None
    badges: list[str] = Field(default_factory=list)

    children_count: int = Field(alias="childrenCount")
    codes_waiting: int = Field(alias="codesWaiting")

    permissions_count: int = Field(alias="permissionsCount")


class ProfileStatsIn(Model):
    """A partial write. Absent fields are left as they are."""

    day_streak: int | None = Field(default=None, ge=0, alias="dayStreak")
    longest_streak: int | None = Field(default=None, ge=0, alias="longestStreak")
    total_xp: int | None = Field(default=None, ge=0, alias="totalXp")
    level: int | None = Field(default=None, ge=1)
    stars_earned: int | None = Field(default=None, ge=0, alias="starsEarned")
    lessons_mastered: int | None = Field(default=None, ge=0, alias="lessonsMastered")
    lessons_available: int | None = Field(default=None, ge=0, alias="lessonsAvailable")
    daily_goal: int | None = Field(default=None, ge=0, alias="dailyGoal")
    daily_solved: int | None = Field(default=None, ge=0, alias="dailySolved")
    top_three_finishes: int | None = Field(default=None, ge=0, alias="topThreeFinishes")
    league: str | None = Field(default=None, max_length=40)
    badges: list[str] | None = Field(default=None, max_length=50)

    children_count: int | None = Field(default=None, ge=0, alias="childrenCount")
    codes_waiting: int | None = Field(default=None, ge=0, alias="codesWaiting")

    permissions_count: int | None = Field(default=None, ge=0, alias="permissionsCount")
