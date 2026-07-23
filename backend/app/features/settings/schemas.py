import re

from pydantic import BaseModel, Field, field_validator


ALLOWED_AI_MODELS = {"gpt-4o-mini", "gpt-4o"}


class SettingsOut(BaseModel):
    sound_enabled: bool
    ai_model: str
    api_key_configured: bool
    api_key_hint: str | None = None


class SettingsUpdate(BaseModel):
    sound_enabled: bool
    ai_model: str
    openai_api_key: str | None = Field(default=None, max_length=300)
    clear_api_key: bool = False


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
