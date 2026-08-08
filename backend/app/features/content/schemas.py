"""Request models for the content feature."""

from typing import Any, Literal
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
        for unit in self.tree["units"]:
            raw_presentation = unit.get("presentation")
            if raw_presentation is not None and not isinstance(raw_presentation, dict):
                raise ValueError(f"Unit {unit['id']} presentation must be an object")
            presentation = raw_presentation or {}
            icon = presentation.get("icon")
            if icon is not None and icon not in {"hash", "brain", "shapes", "puzzle", "sparkles", "book", "leaf", "paw", "weather"}:
                raise ValueError(f"Unit {unit['id']} presentation icon is invalid")
            accent = presentation.get("accent")
            if accent is not None and accent not in {"purple", "blue", "green", "amber", "pink"}:
                raise ValueError(f"Unit {unit['id']} presentation accent is invalid")
        invalid_skills = sorted(item["id"] for item in self.tree["skills"] if item.get("unitId") not in units_by_id)
        if invalid_skills:
            raise ValueError(f"Curriculum skills reference missing units: {', '.join(invalid_skills)}")
        rewards = self.tree.get("rewards") or {}
        quest = rewards.get("quest") or {}
        xp = rewards.get("xp") or {}
        activities = quest.get("activitiesPerSession")
        if activities is not None and (
            not isinstance(activities, int) or isinstance(activities, bool) or not 1 <= activities <= 5
        ):
            raise ValueError("Quest activities per session must be between 1 and 5")
        quest_label = quest.get("label")
        if quest_label is not None and (
            not isinstance(quest_label, str) or not quest_label.strip() or len(quest_label) > 80
        ):
            raise ValueError("Quest label must be between 1 and 80 characters")
        for field in ("correctAnswer", "firstTryBonus", "activityCompletion"):
            value = xp.get(field)
            if value is not None and (
                not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100
            ):
                raise ValueError(f"XP {field} must be between 0 and 100")
        level = rewards.get("level") or {}
        xp_per_level = level.get("xpPerLevel")
        if xp_per_level is not None and (
            not isinstance(xp_per_level, int)
            or isinstance(xp_per_level, bool)
            or not 1 <= xp_per_level <= 10_000
        ):
            raise ValueError("XP per level must be between 1 and 10,000")
        achievements = rewards.get("achievements") or []
        if not isinstance(achievements, list) or len(achievements) > 12:
            raise ValueError("Achievements must be a list of at most 12 items")
        achievement_ids: list[str] = []
        allowed_metrics = {
            "xpEarned", "lessonsCompleted", "firstTryCorrect",
            "proficientSkills", "masteredSkills", "streakDays",
        }
        allowed_icons = {"star", "medal", "award", "trophy", "gem", "flame"}
        allowed_accents = {"purple", "blue", "green", "amber", "pink"}
        for achievement in achievements:
            if not isinstance(achievement, dict):
                raise ValueError("Each achievement must be an object")
            achievement_id = achievement.get("id")
            if not isinstance(achievement_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", achievement_id):
                raise ValueError("Achievement id must use lowercase letters, numbers, and hyphens")
            achievement_ids.append(achievement_id)
            label = achievement.get("label")
            description = achievement.get("description")
            if not isinstance(label, str) or not label.strip() or len(label) > 80:
                raise ValueError(f"Achievement {achievement_id} label is invalid")
            if not isinstance(description, str) or not description.strip() or len(description) > 200:
                raise ValueError(f"Achievement {achievement_id} description is invalid")
            if achievement.get("metric") not in allowed_metrics:
                raise ValueError(f"Achievement {achievement_id} metric is invalid")
            target = achievement.get("target")
            if not isinstance(target, int) or isinstance(target, bool) or not 1 <= target <= 10_000:
                raise ValueError(f"Achievement {achievement_id} target must be between 1 and 10,000")
            if achievement.get("icon") not in allowed_icons:
                raise ValueError(f"Achievement {achievement_id} icon is invalid")
            if achievement.get("accent") not in allowed_accents:
                raise ValueError(f"Achievement {achievement_id} accent is invalid")
        if len(achievement_ids) != len(set(achievement_ids)):
            raise ValueError("Achievement ids must be unique")
        for skill in self.tree["skills"]:
            completion_xp = skill.get("completionXp")
            if completion_xp is not None and (
                not isinstance(completion_xp, int) or isinstance(completion_xp, bool) or not 0 <= completion_xp <= 100
            ):
                raise ValueError(f"Skill {skill['id']} completion XP must be between 0 and 100")
            presentation = skill.get("presentation") or {}
            for field, limit in (("title", 120), ("description", 300), ("thumbnailUrl", 500)):
                value = presentation.get(field)
                if value is not None and (not isinstance(value, str) or len(value.strip()) > limit):
                    raise ValueError(f"Skill {skill['id']} presentation {field} is invalid")
            thumbnail = presentation.get("thumbnailUrl")
            if thumbnail and not (
                thumbnail.startswith("/") or thumbnail.startswith("https://") or thumbnail.startswith("http://")
            ):
                raise ValueError(f"Skill {skill['id']} thumbnail must be an app path or HTTP URL")
            thumbnail_asset_id = presentation.get("thumbnailAssetId")
            if thumbnail_asset_id is not None and (
                not isinstance(thumbnail_asset_id, str)
                or not thumbnail_asset_id.strip()
                or len(thumbnail_asset_id) > 120
            ):
                raise ValueError(f"Skill {skill['id']} thumbnail asset id is invalid")
            if thumbnail and thumbnail_asset_id:
                raise ValueError(f"Skill {skill['id']} must use either a thumbnail URL or library asset")
            estimated_minutes = presentation.get("estimatedMinutes")
            if estimated_minutes is not None and (
                not isinstance(estimated_minutes, int)
                or isinstance(estimated_minutes, bool)
                or not 1 <= estimated_minutes <= 90
            ):
                raise ValueError(f"Skill {skill['id']} estimated minutes must be between 1 and 90")
            accent = presentation.get("accent")
            if accent is not None and accent not in {"purple", "blue", "green", "amber", "pink"}:
                raise ValueError(f"Skill {skill['id']} presentation accent is invalid")
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


class CurriculumRolloutIn(BaseModel):
    grade_id: str = Field(min_length=1, max_length=120)
    subject_id: str = Field(min_length=1, max_length=120)
    strategy: Literal["new_learners", "active_learners"] = "new_learners"

    @field_validator("grade_id", "subject_id")
    @classmethod
    def clean_rollout_ids(cls, value: str) -> str:
        return value.strip()


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
    deleted_system_asset_ids: list[str] = Field(
        default_factory=list, max_length=200, alias="deletedSystemAssetIds"
    )
    #: technique id -> asset id. Validated against `assets` so a saved reference can never
    #: dangle; a technique with no entry keeps its manifest's static artwork.
    technique_thumbnails: dict[str, str] = Field(
        default_factory=dict, max_length=100, alias="techniqueThumbnails"
    )
    mastery_gate_assets: dict[str, str] = Field(
        default_factory=dict, max_length=4, alias="masteryGateAssets"
    )
    revision: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_library(self):
        ids = [asset.id for asset in self.assets]
        if len(ids) != len(set(ids)):
            raise ValueError("SVG asset ids must be unique")
        unknown = sorted(set(self.technique_thumbnails.values()) - set(ids))
        if unknown:
            raise ValueError(
                f"Technique thumbnails reference assets that are not in the library: {', '.join(unknown)}"
            )
        unknown_levels = sorted(set(self.mastery_gate_assets) - {"beginner", "developing", "proficient", "master"})
        if unknown_levels:
            raise ValueError(f"Unknown mastery levels: {', '.join(unknown_levels)}")
        unknown_mastery_assets = sorted(set(self.mastery_gate_assets.values()) - set(ids))
        if unknown_mastery_assets:
            raise ValueError(
                f"Mastery gates reference assets that are not in the library: {', '.join(unknown_mastery_assets)}"
            )
        total_bytes = sum(len(asset.markup.encode("utf-8")) for asset in self.assets)
        total_bytes += sum(len(override.markup.encode("utf-8")) for override in self.overrides.values())
        if total_bytes > 12_000_000:
            raise ValueError("SVG library exceeds the 12 MB storage limit")
        return self
