"""Children's finished paintings (Koda Trace colouring), as PNG files.

Like Library audio, the bytes stay out of MongoDB: development writes them to a
folder, production to the Google Cloud Storage bucket the Library's audio uses,
under their own `trace-paintings/` prefix. MongoDB keeps one row per painting
(see `repos/paintings.py`) naming the file by its hash.

A painting is a child's work, so its file is never served without a check: the
route reads the row first and refuses another family's painting.
"""

from __future__ import annotations

import asyncio
import hashlib
import tempfile
from pathlib import Path

from app.settings import settings

CONTENT_TYPE = "image/png"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def object_name(image_id: str) -> str:
    return f"trace-paintings/{image_id[:2]}/{image_id}.png"


def _local_path(image_id: str) -> Path:
    root = Path(settings().trace_paintings_dir).expanduser().resolve()
    return root / image_id[:2] / f"{image_id}.png"


def _bucket():
    from google.cloud import storage

    return storage.Client().bucket(settings().library_audio_bucket)


async def put(data: bytes) -> str:
    """Keep one PNG; its id is its hash, so the same picture is kept once."""
    image_id = hashlib.sha256(data).hexdigest()
    if settings().library_audio_bucket:
        def upload() -> None:
            blob = _bucket().blob(object_name(image_id))
            if not blob.exists():
                blob.upload_from_string(data, content_type=CONTENT_TYPE)

        await asyncio.to_thread(upload)
        return image_id
    path = _local_path(image_id)

    def store_local() -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            return
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{image_id}-", suffix=".tmp", delete=False) as temp:
            temp.write(data)
            temporary = Path(temp.name)
        temporary.replace(path)

    await asyncio.to_thread(store_local)
    return image_id


async def get(image_id: str) -> bytes | None:
    if settings().library_audio_bucket:
        def download() -> bytes | None:
            blob = _bucket().blob(object_name(image_id))
            return blob.download_as_bytes() if blob.exists() else None

        return await asyncio.to_thread(download)
    path = _local_path(image_id)
    return await asyncio.to_thread(path.read_bytes) if path.is_file() else None


async def delete(image_id: str) -> None:
    """Remove a file no painting row names any more."""
    if settings().library_audio_bucket:
        def remove() -> None:
            blob = _bucket().blob(object_name(image_id))
            if blob.exists():
                blob.delete()

        await asyncio.to_thread(remove)
        return
    path = _local_path(image_id)
    await asyncio.to_thread(lambda: path.unlink(missing_ok=True))
