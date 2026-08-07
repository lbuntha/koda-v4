"""Shared component-thumbnail catalog used by publishing and analytics fallback."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def technique_thumbnail_catalog() -> dict[str, str]:
    """Load the repository-owned catalog in local development or its Docker copy."""
    here = Path(__file__).resolve()
    candidates = (
        here.parents[3] / "shared" / "technique-thumbnails.json",
        here.parents[2] / "shared" / "technique-thumbnails.json",
    )
    for path in candidates:
        if path.is_file():
            payload = json.loads(path.read_text(encoding="utf-8"))
            return {
                str(technique): str(url)
                for technique, url in payload.items()
                if isinstance(technique, str) and isinstance(url, str) and url
            }
    raise RuntimeError("shared/technique-thumbnails.json is missing")


def default_thumbnail_for_technique(technique: str | None) -> str | None:
    if not technique:
        return None
    return technique_thumbnail_catalog().get(technique)
