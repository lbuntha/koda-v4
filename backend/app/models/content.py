"""Authored content owned per adult account: curriculum, question deck, and
SVG library. Whole documents mirror the frontend state and keep persistence
boundaries simple for editors and reusable components."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel
from ..core.scoring_config import default_scoring_config


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Curriculum(Document):
    curriculum_id: str | None = None
    owner_id: str
    tree: dict[str, Any]
    revision: int = 0
    published: bool = False
    archived_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "curriculum"
        indexes = [
            IndexModel("curriculum_id", unique=True),
            IndexModel([("owner_id", 1), ("updated_at", -1)]),
        ]


class CurriculumRelease(Document):
    """Immutable published snapshot of a curriculum (Phase 0).

    The editable `Curriculum`, `QuestionDeck`, and `SvgLibrary` above stay as
    drafts; publishing resolves and validates them into ONE frozen release that
    every assignment, placement, and learning event points back to. Manifests and
    hashes are produced by `features/content/release.build_release_payload`; this
    document only adds identity and persistence. Nothing here is edited after
    insert — a change is a new release, never a mutation.
    """

    release_id: str                       # immutable public identifier
    curriculum_id: str                    # stable identity across releases
    owner_id: str
    revision: int
    tree: dict[str, Any]                  # immutable tree snapshot
    question_manifest: list[dict[str, Any]]  # playable snapshots + private grading + hashes
    asset_manifest: list[dict[str, Any]]     # asset snapshots + hashes
    content_hashes: dict[str, str]        # {tree, questions, assets}
    published_by: str
    published_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "curriculum_releases"
        indexes = [
            IndexModel("release_id", unique=True),
            IndexModel([("curriculum_id", 1), ("revision", 1)], unique=True),
            IndexModel([("owner_id", 1), ("published_at", -1)]),
        ]


class QuestionDeck(Document):
    owner_id: str
    questions: list[dict[str, Any]] = Field(default_factory=list)
    revision: int = 0
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "question_decks"
        indexes = [IndexModel("owner_id", unique=True)]


class SvgLibrary(Document):
    """Custom SVG assets and built-in overrides owned by one adult account."""

    owner_id: str
    assets: list[dict[str, Any]] = Field(default_factory=list)
    #: Countable object type ("apple", "star") -> replacement markup + scale.
    overrides: dict[str, dict[str, Any]] = Field(default_factory=dict)
    #: Stable seeded asset ids the owner intentionally removed. Seeders must respect these.
    deleted_system_asset_ids: list[str] = Field(default_factory=list)
    #: Counting technique ("MOVE_AND_COUNT") -> an id in `assets`. Chooses the artwork the
    #: studio shows for that component, replacing the static file its manifest ships with.
    #: A reference rather than markup, so one library asset can front several techniques and
    #: editing the asset updates all of them.
    technique_thumbnails: dict[str, str] = Field(default_factory=dict)
    #: Mastery level (beginner/developing/proficient/master) -> an id in `assets`.
    #: Kept with the SVG library because changing presentation must not trigger a scoring
    #: revision or re-score every learner.
    mastery_gate_assets: dict[str, str] = Field(default_factory=dict)
    revision: int = 0
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "svg_libraries"
        indexes = [IndexModel("owner_id", unique=True)]


class SystemSettings(Document):
    key: str = "global"
    sound_enabled: bool = True
    ai_model: str = "gpt-4o-mini"
    openai_api_key_encrypted: str | None = None
    # Mail transport overrides — admin-configured, layered atop the env `Settings`
    # defaults by `mail.resolve_mailer()`. None means "use the env default" for
    # every field independently, so a partially-filled form still falls back sanely.
    mail_transport_override: str | None = None
    smtp_host_override: str | None = None
    smtp_port_override: int | None = None
    smtp_username_override: str | None = None
    smtp_password_encrypted: str | None = None
    smtp_use_tls_override: bool | None = None
    mail_from_override: str | None = None
    scoring: dict[str, Any] = Field(default_factory=default_scoring_config)
    scoring_revision: int = 1
    #: Learner-safe snapshots of the SVGs selected for mastery celebrations. These are
    #: presentation settings, kept outside `scoring` so artwork edits never trigger a re-score.
    mastery_gate_assets: dict[str, dict[str, Any]] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "system_settings"
        indexes = [IndexModel("key", unique=True)]
