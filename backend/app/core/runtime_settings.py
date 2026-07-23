from ..models.content import SystemSettings
from .config import settings
from .security import decrypt_secret
from pymongo.errors import DuplicateKeyError


async def get_system_settings() -> SystemSettings:
    doc = await SystemSettings.find_one(SystemSettings.key == "global")
    if doc:
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
