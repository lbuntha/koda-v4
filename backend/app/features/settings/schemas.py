import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from ..content.schemas import SvgAssetIn


ALLOWED_AI_MODELS = {"gpt-4o-mini", "gpt-4o"}


class ScoreWeightsIn(BaseModel):
    firstTry: float = Field(ge=0, le=1)
    accuracy: float = Field(ge=0, le=1)
    independence: float = Field(ge=0, le=1)
    speed: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def weights_sum_to_one(self):
        total = self.firstTry + self.accuracy + self.independence + self.speed
        if abs(total - 1) > 0.000001:
            raise ValueError("Scoring weights must sum to 1")
        return self


class DevelopingGateIn(BaseModel):
    minPlays: int = Field(ge=1, le=1000)


class ProficientGateIn(BaseModel):
    minPlays: int = Field(ge=1, le=1000)
    minSessions: int = Field(ge=1, le=1000)
    minHardPlays: int = Field(ge=0, le=1000)


class MasterGateIn(BaseModel):
    minPlays: int = Field(ge=1, le=1000)
    minDistinctDays: int = Field(ge=1, le=1000)
    minHardPlays: int = Field(ge=0, le=1000)
    minRecentScore: float = Field(ge=0, le=1)


class ScoreGatesIn(BaseModel):
    developing: DevelopingGateIn
    proficient: ProficientGateIn
    master: MasterGateIn


class ReviewIntervalsIn(BaseModel):
    not_started: None = None
    beginner: int = Field(ge=0, le=3650)
    developing: int = Field(ge=0, le=3650)
    proficient: int = Field(ge=0, le=3650)
    master: int = Field(ge=0, le=3650)


class PlacementConfigIn(BaseModel):
    per_skill: int = Field(ge=1, le=2)
    checkpoint_cap: int = Field(ge=1, le=50)
    pass_threshold: float = Field(ge=0, le=1)
    checkpoints_only: bool
    generator_revision: int = Field(ge=1)
    rapid_confirmation_plays: int = Field(ge=1, le=20)


class RecommendationConfigIn(BaseModel):
    skills_per_session: int = Field(default=3, ge=1, le=10)
    max_non_new: int = Field(default=2, ge=0, le=10)
    skip_cooldown_sessions: int = Field(default=1, ge=0, le=10)
    reinforce_threshold: float = Field(default=0.6, ge=0, le=1)


class StreakConfigIn(BaseModel):
    """What earns a learner a streak day.

    `counts` picks the evidence: `any` event (opening an activity is enough), a verified
    `attempt` (they answered something), or `lesson_complete` (they finished an activity).
    """

    counts: Literal["any", "attempt", "lesson_complete"] = "attempt"
    min_events_per_day: int = Field(default=1, ge=1, le=50)
    grace_days: int = Field(default=1, ge=0, le=7)


class NotificationsConfigIn(BaseModel):
    """Admin-level kill switches for the automated notification types."""

    auto_achievement_enabled: bool = True
    auto_streak_enabled: bool = True
    auto_weekly_digest_enabled: bool = True
    weekly_digest_day: Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"] = "sun"
    streak_milestones: list[int] = Field(default_factory=lambda: [3, 7, 14, 30, 60, 100])
    auto_review_enabled: bool = True
    auto_inactivity_enabled: bool = True
    inactivity_days: int = Field(default=7, ge=2, le=90)
    auto_pin_lockout_enabled: bool = True


class ScoringConfigIn(BaseModel):
    weights: ScoreWeightsIn
    developingScore: float = Field(ge=0, le=1)
    proficientScore: float = Field(ge=0, le=1)
    masterScore: float = Field(ge=0, le=1)
    successfulReviewScore: float = Field(ge=0, le=1)
    gates: ScoreGatesIn
    speedBaselineMs: int = Field(ge=100, le=3_600_000)
    reviewIntervalDays: ReviewIntervalsIn
    placement: PlacementConfigIn
    recommendation: RecommendationConfigIn = Field(default_factory=RecommendationConfigIn)
    streak: StreakConfigIn = Field(default_factory=StreakConfigIn)
    notifications: NotificationsConfigIn = Field(default_factory=NotificationsConfigIn)

    @model_validator(mode="after")
    def thresholds_are_ordered(self):
        if not self.developingScore <= self.proficientScore <= self.masterScore:
            raise ValueError("Mastery thresholds must be ordered developing ≤ proficient ≤ master")
        if not (
            self.gates.developing.minPlays
            <= self.gates.proficient.minPlays
            <= self.gates.master.minPlays
        ):
            raise ValueError("Play gates must be ordered developing ≤ proficient ≤ master")
        if self.recommendation.max_non_new > self.recommendation.skills_per_session:
            raise ValueError("Recommendation non-new cap cannot exceed skills per session")
        return self


class SettingsOut(BaseModel):
    sound_enabled: bool
    ai_model: str
    api_key_configured: bool
    api_key_hint: str | None = None
    # Effective mail transport (env default, or the admin override below if set).
    mail_transport: str
    mail_configured: bool
    mail_from: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_use_tls: bool | None = None
    smtp_password_hint: str | None = None
    scoring: ScoringConfigIn
    scoring_revision: int
    mastery_gate_assets: dict[str, dict] = Field(default_factory=dict)


class SettingsUpdate(BaseModel):
    sound_enabled: bool | None = None
    ai_model: str | None = None
    openai_api_key: str | None = Field(default=None, max_length=300)
    clear_api_key: bool = False
    mail_transport: Literal["console", "smtp"] | None = None
    mail_from: str | None = Field(default=None, max_length=200)
    smtp_host: str | None = Field(default=None, max_length=200)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, max_length=200)
    smtp_password: str | None = Field(default=None, max_length=300)
    clear_smtp_password: bool = False
    smtp_use_tls: bool | None = None
    scoring: ScoringConfigIn | None = None
    scoring_revision: int | None = Field(default=None, ge=1)


class ScoringPreviewIn(BaseModel):
    scoring: ScoringConfigIn
    scoring_revision: int = Field(ge=1)


_KEY_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_CODE_PATTERN = re.compile(r"^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$")


class GradeIn(BaseModel):
    key: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    age_range: str = Field(default="", max_length=60)
    order: int = Field(default=1, ge=0, le=1000)
    # None ⇒ auto-derive the student-page layout band from `order`.
    layout_band: Literal["kid", "student", "focus"] | None = None
    active: bool = True
    revision: int = Field(default=0, ge=0)

    @field_validator("key")
    @classmethod
    def valid_key(cls, value: str) -> str:
        value = value.strip().lower()
        if not _KEY_PATTERN.fullmatch(value):
            raise ValueError("Key must use lowercase letters, numbers, and hyphens")
        return value

    @field_validator("code")
    @classmethod
    def valid_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not _CODE_PATTERN.fullmatch(value):
            raise ValueError("Code must use letters, numbers, hyphens, dots, or underscores")
        return value

    @field_validator("name", "description", "age_range")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class SubjectIn(BaseModel):
    key: str = Field(min_length=2, max_length=100)
    grade_id: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    icon: str = Field(default="", max_length=60)
    # A snapshot makes the chosen library artwork available to learners, whose accounts do
    # not have access to the admin's editable SVG library. `icon` remains the stable asset id
    # for existing integrations and older rows.
    icon_asset: SvgAssetIn | None = None
    color: str = Field(default="#534AB7", pattern=r"^#[0-9A-Fa-f]{6}$")
    order: int = Field(default=1, ge=0, le=1000)
    active: bool = True
    revision: int = Field(default=0, ge=0)

    @field_validator("key", "grade_id")
    @classmethod
    def valid_key(cls, value: str) -> str:
        value = value.strip().lower()
        if not _KEY_PATTERN.fullmatch(value):
            raise ValueError("Key must use lowercase letters, numbers, and hyphens")
        return value

    @field_validator("code")
    @classmethod
    def valid_code(cls, value: str) -> str:
        value = value.strip().upper()
        if not _CODE_PATTERN.fullmatch(value):
            raise ValueError("Code must use letters, numbers, hyphens, dots, or underscores")
        return value

    @field_validator("name", "description", "icon")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class CurriculumOfferingIn(BaseModel):
    grade_id: str = Field(min_length=2, max_length=80)
    subject_id: str = Field(min_length=2, max_length=100)
    curriculum_id: str = Field(min_length=1, max_length=120)
    release_id: str = Field(min_length=1, max_length=120)
    active: bool = True
    successor_grade_id: str | None = Field(default=None, min_length=2, max_length=80)
    successor_subject_id: str | None = Field(default=None, min_length=2, max_length=100)
    promotion_completion_rule: Literal[
        "activities_completed", "proficient", "master"
    ] = "activities_completed"
    promotion_placement_required: bool = True
    revision: int = Field(default=0, ge=0)

    @field_validator(
        "grade_id", "subject_id", "curriculum_id", "release_id",
        "successor_grade_id", "successor_subject_id",
    )
    @classmethod
    def clean_ids(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None
