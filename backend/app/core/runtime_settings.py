import copy
from typing import Any

from ..models.content import SystemSettings
from .config import settings
from .scoring_config import DEFAULT_SCORING_CONFIG
from .security import decrypt_secret
from pymongo.errors import DuplicateKeyError


def _with_defaults(stored: dict[str, Any] | None) -> dict[str, Any]:
    """Fill in settings sections the stored document predates.

    The settings document is written once and then only ever patched by an admin, so a key
    added to DEFAULT_SCORING_CONFIG afterwards never reaches an existing database. That is not
    hypothetical: `rewards` was added and every install except a brand new one carried on
    resolving XP to zero, which is exactly the failure the change was meant to remove.

    Stored values always win — this only supplies what is absent, one level into each section
    so a partially-filled section still gains the keys it lacks. In memory only: an admin's
    document is not rewritten behind their back.
    """
    merged = dict(stored or {})
    for section, default in DEFAULT_SCORING_CONFIG.items():
        current = merged.get(section)
        if current is None:
            merged[section] = copy.deepcopy(default)
        elif isinstance(current, dict) and isinstance(default, dict):
            merged[section] = {**copy.deepcopy(default), **current}
    return merged


async def get_system_settings() -> SystemSettings:
    doc = await SystemSettings.find_one(SystemSettings.key == "global")
    if doc:
        doc.scoring = _with_defaults(doc.scoring)
        return doc
    doc = SystemSettings()
    try:
        await doc.insert()
        return doc
    except DuplicateKeyError:
        # Two first requests may race to create the singleton.
        return await SystemSettings.find_one(SystemSettings.key == "global")


async def resolve_openai_api_key(doc: SystemSettings | None = None) -> str | None:
    current = doc or await get_system_settings()
    if current.openai_api_key_encrypted:
        decrypted = decrypt_secret(current.openai_api_key_encrypted)
        if decrypted:
            return decrypted
    return settings.openai_api_key
