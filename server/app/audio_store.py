"""Durable Library audio objects.

Audio bytes do not belong in MongoDB: they make routine database backups large
and slow. Development writes content-addressed `.m4a` files to a normal folder;
production writes the same object names to Google Cloud Storage. MongoDB keeps
only the 64-character clip id referenced by a book sentence.
"""

from __future__ import annotations

import asyncio
import hashlib
import subprocess
import tempfile
from pathlib import Path

from app.settings import settings

CONTENT_TYPE = "audio/mp4"


def _encode_m4a(data: bytes, mime: str) -> bytes:
    suffix = {
        "audio/wav": ".wav",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mp4": ".m4a",
        "audio/mpeg": ".mp3",
    }.get(mime, ".audio")
    with tempfile.TemporaryDirectory(prefix="koda-audio-") as tmp:
        source = Path(tmp) / f"source{suffix}"
        target = Path(tmp) / "clip.m4a"
        source.write_bytes(data)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(source), "-vn", "-c:a", "aac", "-b:a", "48k", "-ac", "1", str(target)],
                check=True,
                capture_output=True,
                timeout=30,
            )
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise ValueError("The recording could not be converted to M4A.") from exc
        return target.read_bytes()


def object_name(clip_id: str) -> str:
    """Shard large libraries while preserving a direct id → object mapping."""
    return f"library-audio/{clip_id[:2]}/{clip_id[2:4]}/{clip_id}.m4a"


def _local_path(clip_id: str) -> Path:
    root = Path(settings().library_audio_dir).expanduser().resolve()
    return root / clip_id[:2] / clip_id[2:4] / f"{clip_id}.m4a"


def _gcs_bucket():
    from google.cloud import storage

    return storage.Client().bucket(settings().library_audio_bucket)


async def put(data: bytes, mime: str) -> tuple[str, int]:
    encoded = await asyncio.to_thread(_encode_m4a, data, mime)
    clip_id = hashlib.sha256(encoded).hexdigest()
    bucket_name = settings().library_audio_bucket
    if bucket_name:
        def upload() -> None:
            blob = _gcs_bucket().blob(object_name(clip_id))
            if not blob.exists():
                blob.upload_from_string(encoded, content_type=CONTENT_TYPE)

        await asyncio.to_thread(upload)
    else:
        path = _local_path(clip_id)
        def store_local() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                return
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{clip_id}-", suffix=".tmp", delete=False) as temp:
                temp.write(encoded)
                temporary = Path(temp.name)
            temporary.replace(path)

        await asyncio.to_thread(store_local)
    return clip_id, len(encoded)


async def get(clip_id: str) -> bytes | None:
    if settings().library_audio_bucket:
        def download() -> bytes | None:
            blob = _gcs_bucket().blob(object_name(clip_id))
            return blob.download_as_bytes() if blob.exists() else None

        return await asyncio.to_thread(download)
    path = _local_path(clip_id)
    return await asyncio.to_thread(path.read_bytes) if path.is_file() else None


async def sizes(clip_ids: set[str]) -> dict[str, int]:
    if settings().library_audio_bucket:
        def inspect() -> dict[str, int]:
            bucket = _gcs_bucket()
            result: dict[str, int] = {}
            for clip_id in clip_ids:
                blob = bucket.get_blob(object_name(clip_id))
                if blob is not None:
                    result[clip_id] = int(blob.size or 0)
            return result

        return await asyncio.to_thread(inspect)
    result: dict[str, int] = {}
    for clip_id in clip_ids:
        path = _local_path(clip_id)
        if path.is_file():
            result[clip_id] = path.stat().st_size
    return result


async def missing(clip_ids: set[str]) -> set[str]:
    found = await sizes(clip_ids)
    return clip_ids - set(found)
