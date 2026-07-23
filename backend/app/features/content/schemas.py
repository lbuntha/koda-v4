"""Request models for the content feature."""

from typing import Any
import re

from pydantic import BaseModel, Field, field_validator, model_validator


_UNSAFE_SVG = re.compile(
    r"<\s*(script|foreignobject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text/html",
    re.IGNORECASE,
)


def _validated_svg(markup: str) -> str:
    cleaned = markup.strip()
    if not cleaned.lower().startswith("<svg"):
        raise ValueError("SVG markup must start with <svg")
    if _UNSAFE_SVG.search(cleaned):
        raise ValueError("SVG markup contains executable or embedded content")
    return cleaned


class CurriculumIn(BaseModel):
    tree: dict[str, Any]
    revision: int = Field(default=0, ge=0)
    published: bool = False

    @model_validator(mode="after")
    def validate_tree(self):
        required = ("grades", "subjects", "units", "skills")
        if any(not isinstance(self.tree.get(key), list) for key in required):
            raise ValueError("Curriculum requires grades, subjects, units, and skills arrays")
        for key in required:
            ids = [item.get("id") for item in self.tree[key] if isinstance(item, dict)]
            if len(ids) != len(self.tree[key]) or any(not isinstance(value, str) or not value.strip() for value in ids):
                raise ValueError(f"Every curriculum {key} entry requires a valid id")
            if len(ids) != len(set(ids)):
                raise ValueError(f"Curriculum {key} ids must be unique")
        title = self.tree.get("title")
        if title is not None and (not isinstance(title, str) or not title.strip() or len(title.strip()) > 160):
            raise ValueError("Curriculum title must be between 1 and 160 characters")
        description = self.tree.get("description")
        if description is not None and (not isinstance(description, str) or len(description) > 2_000):
            raise ValueError("Curriculum description cannot exceed 2,000 characters")
        version = self.tree.get("version")
        if version is not None and (not isinstance(version, str) or not version.strip() or len(version.strip()) > 40):
            raise ValueError("Curriculum version must be between 1 and 40 characters")
        grade_ids = {item["id"] for item in self.tree["grades"]}
        subject_by_id = {item["id"]: item for item in self.tree["subjects"]}
        primary_grade_id = self.tree.get("primaryGradeId")
        primary_subject_id = self.tree.get("primarySubjectId")
        if primary_grade_id is not None and primary_grade_id not in grade_ids:
            raise ValueError("Primary grade must be included in the curriculum")
        if primary_subject_id is not None:
            primary_subject = subject_by_id.get(primary_subject_id)
            if not primary_subject:
                raise ValueError("Primary subject must be included in the curriculum")
            if primary_grade_id and primary_subject.get("gradeId") != primary_grade_id:
                raise ValueError("Primary subject must belong to the primary grade")
        subject_ids = set(subject_by_id)
        units_by_id = {item["id"]: item for item in self.tree["units"]}
        invalid_units = sorted(item["id"] for item in self.tree["units"] if item.get("subjectId") not in subject_ids)
        if invalid_units:
            raise ValueError(f"Curriculum units reference missing subjects: {', '.join(invalid_units)}")
        invalid_skills = sorted(item["id"] for item in self.tree["skills"] if item.get("unitId") not in units_by_id)
        if invalid_skills:
            raise ValueError(f"Curriculum skills reference missing units: {', '.join(invalid_skills)}")
        if len(str(self.tree).encode("utf-8")) > 2_000_000:
            raise ValueError("Curriculum exceeds the 2 MB storage limit")
        return self


class CurriculumCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)
    version: str = Field(default="1.0", min_length=1, max_length=40)
    primary_grade_id: str = Field(min_length=1, max_length=120)
    primary_subject_id: str = Field(min_length=1, max_length=120)


class CurriculumArchiveIn(BaseModel):
    archived: bool = True


class QuestionsIn(BaseModel):
    questions: list[dict[str, Any]] = Field(min_length=1, max_length=250)
    revision: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_questions(self):
        ids: list[str] = []
        for question in self.questions:
            question_id = question.get("id")
            if not isinstance(question_id, str) or not question_id.strip() or len(question_id) > 120:
                raise ValueError("Each question must have a valid id")
            if not isinstance(question.get("title"), str) or not question["title"].strip():
                raise ValueError("Each question must have a title")
            if not isinstance(question.get("technique"), str) or not question["technique"].strip():
                raise ValueError("Each question must have a technique")
            ids.append(question_id)
        if len(ids) != len(set(ids)):
            raise ValueError("Question ids must be unique")
        if len(str(self.questions).encode("utf-8")) > 12_000_000:
            raise ValueError("Question deck exceeds the 12 MB storage limit")
        return self


class SvgAssetIn(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=160)
    markup: str = Field(min_length=1, max_length=1_000_000)
    scale: float = Field(default=1.0, ge=0.1, le=10.0)

    _validate_markup = field_validator("markup")(_validated_svg)


class SvgOverrideIn(BaseModel):
    markup: str = Field(min_length=1, max_length=1_000_000)
    scale: float = Field(default=1.0, ge=0.1, le=10.0)

    _validate_markup = field_validator("markup")(_validated_svg)


class SvgLibraryIn(BaseModel):
    assets: list[SvgAssetIn] = Field(default_factory=list, max_length=500)
    overrides: dict[str, SvgOverrideIn] = Field(default_factory=dict, max_length=100)
    revision: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_library(self):
        ids = [asset.id for asset in self.assets]
        if len(ids) != len(set(ids)):
            raise ValueError("SVG asset ids must be unique")
        total_bytes = sum(len(asset.markup.encode("utf-8")) for asset in self.assets)
        total_bytes += sum(len(override.markup.encode("utf-8")) for override in self.overrides.values())
        if total_bytes > 12_000_000:
            raise ValueError("SVG library exceeds the 12 MB storage limit")
        return self
