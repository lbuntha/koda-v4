"""Whether this database has already been set up by this exact release.

Startup applies every index and seeds the menu, art, skills, plans, settings,
characters and roles — about four hundred small reads and writes. Against a
database on another continent each one is a ~220 ms round trip, so a cold
instance spent ~90 seconds before it could answer anything, and the first
request after an idle spell waited for all of it.

None of that work can change anything unless the code or its seed data has.
So it is fingerprinted: a hash of every file in the `app` package, which is
where the seed data lives too (`art_defaults.json`, `skill_defaults.json`).
A release that changes either runs it once; every later cold start of that
release reads one document and moves on.
"""

import hashlib
from datetime import UTC, datetime
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase

_PACKAGE = Path(__file__).resolve().parent
_DOC_ID = "startup"


def fingerprint(root: Path = _PACKAGE) -> str:
    """A hash of the package's source and data, independent of file timestamps."""
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts or path.suffix == ".pyc":
            continue
        digest.update(str(path.relative_to(root)).encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


async def is_current(db: AsyncIOMotorDatabase, print_: str) -> bool:
    """Whether startup already ran against this database for this fingerprint."""
    return await db.boot_state.find_one({"_id": _DOC_ID, "fingerprint": print_}, {"_id": 1}) is not None


async def mark_current(db: AsyncIOMotorDatabase, print_: str) -> None:
    """Recorded only after every step succeeded, so a failed startup retries next time."""
    await db.boot_state.update_one(
        {"_id": _DOC_ID},
        {"$set": {"fingerprint": print_, "at": datetime.now(UTC)}},
        upsert=True,
    )
