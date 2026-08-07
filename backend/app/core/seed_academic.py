"""Idempotently migrate legacy embedded grade/subject metadata to catalogs."""

import re
from datetime import datetime, timezone

from ..models.academic import Grade, Subject
from ..models.content import Curriculum, SvgLibrary
from .subject_icons import SUBJECT_ICON_ASSETS, default_subject_icon


def _code(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^A-Z0-9]+", "-", value.upper()).strip("-")
    return cleaned[:30] or fallback


async def ensure_academic_catalogs() -> None:
    curricula = await Curriculum.find_all().to_list()
    for curriculum in curricula:
        actor = curriculum.owner_id
        for raw in curriculum.tree.get("grades", []):
            key = raw.get("id")
            if not key or await Grade.find_one(Grade.key == key):
                continue
            await Grade(
                key=key,
                code=_code(raw.get("code") or raw.get("label") or key, key.upper()[:30]),
                name=raw.get("label") or key,
                description=raw.get("description") or "",
                age_range=raw.get("ageRange") or "",
                order=raw.get("order", 1),
                active=True,
                created_by=actor,
                updated_by=actor,
            ).insert()

        for raw in curriculum.tree.get("subjects", []):
            key, grade_id = raw.get("id"), raw.get("gradeId")
            if not key or not grade_id or await Subject.find_one(Subject.key == key):
                continue
            if not await Grade.find_one(Grade.key == grade_id):
                continue
            await Subject(
                key=key,
                grade_id=grade_id,
                code=_code(raw.get("code") or raw.get("label") or key, key.upper()[:30]),
                name=raw.get("label") or key,
                description=raw.get("description") or "",
                order=raw.get("order", 1),
                active=True,
                created_by=actor,
                updated_by=actor,
            ).insert()

        # After the catalog records exist, retain only relations and local
        # ordering in Curriculum. Names/descriptions now resolve from catalogs.
        compact_grades = [
            {"id": item.get("id"), "order": item.get("order", 1)}
            for item in curriculum.tree.get("grades", [])
            if item.get("id")
        ]
        compact_subjects = [
            {"id": item.get("id"), "gradeId": item.get("gradeId"), "order": item.get("order", 1)}
            for item in curriculum.tree.get("subjects", [])
            if item.get("id") and item.get("gradeId")
        ]
        if compact_grades != curriculum.tree.get("grades", []) or compact_subjects != curriculum.tree.get("subjects", []):
            curriculum.tree = {**curriculum.tree, "grades": compact_grades, "subjects": compact_subjects}
            await curriculum.save()

    # Upgrade only legacy/default subject icons. A subject with a saved SVG snapshot is an
    # intentional admin choice and must never be replaced during application startup.
    subjects = await Subject.find_all().to_list()
    for subject in subjects:
        asset = default_subject_icon(subject.key, subject.code, subject.name)
        if not asset:
            continue

        legacy_icon = not subject.icon_asset and subject.icon in {"", "Calculator", "Brain"}
        if legacy_icon:
            subject.icon = asset["id"]
            subject.icon_asset = dict(asset)
            subject.revision += 1
            subject.updated_at = datetime.now(timezone.utc)
            await subject.save()

    # Keep both first-party icons available in Settings -> SVG Library for every catalog
    # owner. This lets a subject seeded later attach its icon immediately. Deleting a system
    # asset is respected, while an existing frozen subject snapshot continues to render.
    for owner_id in {subject.created_by for subject in subjects}:
        library = await SvgLibrary.find_one(SvgLibrary.owner_id == owner_id)
        if not library:
            library = SvgLibrary(owner_id=owner_id, assets=[dict(asset) for asset in SUBJECT_ICON_ASSETS])
            await library.insert()
            continue
        existing_ids = {item.get("id") for item in library.assets}
        missing_assets = [
            dict(asset) for asset in SUBJECT_ICON_ASSETS
            if asset["id"] not in existing_ids and asset["id"] not in library.deleted_system_asset_ids
        ]
        if missing_assets:
            library.assets = [*library.assets, *missing_assets]
            library.revision += 1
            library.updated_at = datetime.now(timezone.utc)
            await library.save()
