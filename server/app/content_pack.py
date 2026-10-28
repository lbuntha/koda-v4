"""Content packs: authored Library and Trace content, carried between databases.

Books, their pictures and recordings, and trace collections are made in the
Studios against a developer's own database. A production database starts empty,
and putting ~15 MB of images and audio in the repo to be seeded at boot would
slow every cold start (see `app.boot`). So a pack is a folder: export it from the
database the content was made in, import it into the one that should have it.

    python -m app.cli content-export <dir>
    python -m app.cli content-import <dir> [--update] [--dry-run]

Only what a child reads is exported — published books and published trace
collections, with their items — never drafts, revisions, reports or anything
about a learner.

Import is create-if-absent, like the Rebus seed: a book an operator has since
corrected on the server is never put back. `--update` replaces a book or
collection only when the pack carries a newer revision than the server has.
Every file is checked against the id it is named for before it is written, so a
damaged pack stops rather than half-loading.

Layout:

    manifest.json
    library/books/<id>.json         the book row: published revision (and draft)
    library/images/<sha256>.<ext>   a photo; its id is the hash of its bytes
    library/audio/<sha256>.m4a      a recording; its id is the hash of its bytes
    library/unit-voices.json        {unit: clip} for Khmer spelling units
    trace/collections/<id>.json     the collection row
    trace/items/<id>.json           each item row the collection uses
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from bson import Binary, json_util
from motor.motor_asyncio import AsyncIOMotorDatabase

from app import audio_store
from app.models.common import now
from app.repos import library as library_repo
from app.repos import trace as trace_repo
from app.repos.rebus import SYSTEM, first_admin_id
from app.routers.library import clip_ids_of, photo_ids_of

FORMAT = 1
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MIMES = {ext: mime for mime, ext in EXTENSIONS.items()}

# Row fields that describe where the row lived, not what it says.
_LOCAL = ("_id", "createdAt", "updatedAt", "updatedBy", "deletedAt", "ownerId")


class PackError(Exception):
    """A pack that cannot be trusted, named so the operator can fix it."""


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json_util.dumps(value, indent=1, ensure_ascii=False) + "\n", "utf-8")


def _read_json(path: Path) -> Any:
    return json_util.loads(path.read_text("utf-8"))


def _stripped(row: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in row.items() if k not in _LOCAL}


# --------------------------------------------------------------------- export


async def export_pack(db: AsyncIOMotorDatabase, out: Path) -> dict[str, Any]:
    """Write every published book and trace collection, with what they need, to `out`."""
    out.mkdir(parents=True, exist_ok=True)
    missing: list[str] = []
    books = await library_repo.list_published(db)

    photos: set[str] = set()
    clips: set[str] = set()
    for book in books:
        _write_json(out / "library" / "books" / f"{book['id']}.json", _stripped(book))
        photos |= photo_ids_of(book["published"])
        clips |= clip_ids_of(book["published"])

    voices = await library_repo.unit_voices(db)
    if voices:
        _write_json(out / "library" / "unit-voices.json", voices)
        clips |= set(voices.values())

    for photo_id in sorted(photos):
        row = await library_repo.get_image(db, photo_id)
        if row is None or row.get("mime") not in EXTENSIONS:
            missing.append(f"image {photo_id}")
            continue
        target = out / "library" / "images" / f"{photo_id}.{EXTENSIONS[row['mime']]}"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(bytes(row["data"]))

    for clip_id in sorted(clips):
        data = await audio_store.get(clip_id)
        if data is None:
            missing.append(f"audio {clip_id}")
            continue
        target = out / "library" / "audio" / f"{clip_id}.m4a"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    collections = await db.trace_collections.find({"deletedAt": None, "published": {"$ne": None}}).to_list(length=2000)
    item_ids: set[str] = set()
    for row in collections:
        _write_json(out / "trace" / "collections" / f"{row['id']}.json", _stripped(row))
        item_ids |= set((row.get("draft") or {}).get("itemIds") or [])
    items = await trace_repo.get_items(db, sorted(item_ids))
    for item_id in sorted(item_ids):
        if item_id not in items:
            missing.append(f"trace item {item_id}")
            continue
        _write_json(out / "trace" / "items" / f"{item_id}.json", _stripped(items[item_id]))

    manifest = {
        "format": FORMAT,
        "books": len(books),
        "images": len(photos),
        "audio": len(clips),
        "traceCollections": len(collections),
        "traceItems": len(item_ids),
        "missing": missing,
    }
    _write_json(out / "manifest.json", manifest)
    return manifest


# --------------------------------------------------------------------- import


def _files(folder: Path, suffix: str) -> list[Path]:
    return sorted(folder.glob(f"*{suffix}")) if folder.is_dir() else []


def _verified(path: Path, data: bytes) -> str:
    """The id a content-addressed file is named for, once its bytes agree with it."""
    if hashlib.sha256(data).hexdigest() != path.stem:
        raise PackError(f"{path} does not match its own hash; the pack is damaged")
    return path.stem


async def import_pack(db: AsyncIOMotorDatabase, src: Path, *, update: bool = False, dry_run: bool = False) -> dict[str, Any]:
    """Load `src` into `db`. Returns what was added, replaced and left alone."""
    manifest_path = src / "manifest.json"
    if not manifest_path.is_file():
        raise PackError(f"{src} has no manifest.json; it is not a content pack")
    manifest = _read_json(manifest_path)
    if manifest.get("format") != FORMAT:
        raise PackError(f"pack format {manifest.get('format')} is not one this server reads (expects {FORMAT})")
    if manifest.get("missing"):
        raise PackError(f"the pack was exported with missing files: {', '.join(manifest['missing'][:5])}")

    owner = await first_admin_id(db) or SYSTEM
    stamp = now()
    report: dict[str, Any] = {"dryRun": dry_run}

    def tally(kind: str, outcome: str) -> None:
        report.setdefault(kind, {}).setdefault(outcome, 0)
        report[kind][outcome] += 1

    # Everything is verified before anything is written, so a damaged file
    # cannot leave a book whose pictures never arrived.
    images = [(p, p.read_bytes()) for p in _files(src / "library" / "images", "") if p.suffix[1:] in MIMES]
    audio = [(p, p.read_bytes()) for p in _files(src / "library" / "audio", ".m4a")]
    for path, data in images + audio:
        _verified(path, data)

    # Pictures and recordings are content-addressed, so "already there" means identical.
    for path, data in images:
        image_id = path.stem
        if await db.library_images.find_one({"id": image_id}, {"_id": 1}):
            tally("images", "kept")
            continue
        tally("images", "added")
        if not dry_run:
            await db.library_images.insert_one(
                {
                    "id": image_id,
                    "mime": MIMES[path.suffix[1:]],
                    "data": Binary(data),
                    "bytes": len(data),
                    "createdAt": stamp,
                    "createdBy": owner,
                }
            )
    for path, data in audio:
        if await audio_store.get(path.stem) is not None:
            tally("audio", "kept")
            continue
        tally("audio", "added")
        if not dry_run:
            await audio_store.put_raw(path.stem, data)

    voices_path = src / "library" / "unit-voices.json"
    if voices_path.is_file():
        for unit, clip in _read_json(voices_path).items():
            if await db.library_unit_voices.find_one({"unit": unit}, {"_id": 1}):
                tally("unitVoices", "kept")
                continue
            tally("unitVoices", "added")
            if not dry_run:
                await library_repo.set_unit_voice(db, unit, clip, owner)

    for path in _files(src / "library" / "books", ".json"):
        book = _read_json(path)
        have = await db.library_books.find_one({"id": book["id"]})
        rev = int(book.get("rev") or 0)
        if have and not (update and rev > int(have.get("rev") or 0)):
            tally("books", "kept")
            continue
        tally("books", "replaced" if have else "added")
        if dry_run:
            continue
        row = {**book, "draft": book.get("draft") or book["published"], "updatedAt": stamp, "updatedBy": owner, "deletedAt": None}
        row.setdefault("createdAt", stamp)
        await db.library_books.replace_one({"id": book["id"]}, row, upsert=True)
        await db.library_revisions.update_one(
            {"bookId": book["id"], "rev": rev},
            {
                "$setOnInsert": {
                    "bookId": book["id"],
                    "rev": rev,
                    "passage": book["published"],
                    "publishedAt": book.get("publishedAt") or stamp,
                    "publishedBy": owner,
                }
            },
            upsert=True,
        )

    for path in _files(src / "trace" / "items", ".json"):
        item = _read_json(path)
        if await db.trace_items.find_one({"id": item["id"]}, {"_id": 1}):
            tally("traceItems", "kept")
            continue
        tally("traceItems", "added")
        if not dry_run:
            await db.trace_items.insert_one(
                {**item, "createdAt": stamp, "updatedAt": stamp, "updatedBy": owner, "ownerId": owner, "deletedAt": None}
            )

    for path in _files(src / "trace" / "collections", ".json"):
        collection = _read_json(path)
        have = await db.trace_collections.find_one({"id": collection["id"]})
        rev = int(collection.get("rev") or 0)
        if have and not (update and rev > int(have.get("rev") or 0)):
            tally("traceCollections", "kept")
            continue
        tally("traceCollections", "replaced" if have else "added")
        if dry_run:
            continue
        row = {**collection, "createdAt": stamp, "updatedAt": stamp, "updatedBy": owner, "ownerId": owner, "deletedAt": None}
        await db.trace_collections.replace_one({"id": collection["id"]}, row, upsert=True)
        await db.trace_revisions.update_one(
            {"collectionId": collection["id"], "rev": rev},
            {
                "$setOnInsert": {
                    "collectionId": collection["id"],
                    "rev": rev,
                    "bundle": collection["published"],
                    "publishedAt": stamp,
                    "publishedBy": owner,
                }
            },
            upsert=True,
        )

    return report


def render(report: dict[str, Any]) -> str:
    """The report as lines a person can read."""
    lines = ["dry run: nothing was written" if report.get("dryRun") else "imported"]
    for kind, outcomes in report.items():
        if kind != "dryRun":
            lines.append(f"  {kind}: " + ", ".join(f"{n} {what}" for what, n in sorted(outcomes.items())))
    return "\n".join(lines)
