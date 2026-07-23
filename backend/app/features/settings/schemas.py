import re

from pydantic import BaseModel, Field, field_validator, model_validator


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
        return self


class SettingsOut(BaseModel):
    sound_enabled: bool
    ai_model: str
    api_key_configured: bool
    api_key_hint: str | None = None
    scoring: ScoringConfigIn
    scoring_revision: int


class SettingsUpdate(BaseModel):
    sound_enabled: bool | None = None
    ai_model: str | None = None
    openai_api_key: str | None = Field(default=None, max_length=300)
    clear_api_key: bool = False
    scoring: ScoringConfigIn | None = None
    scoring_revision: int | None = Field(default=None, ge=1)


_KEY_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_CODE_PATTERN = re.compile(r"^[A-Z0-9]+(?:[-_.][A-Z0-9]+)*$")


class GradeIn(BaseModel):
    key: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    age_range: str = Field(default="", max_length=60)
    order: int = Field(default=1, ge=0, le=1000)
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
