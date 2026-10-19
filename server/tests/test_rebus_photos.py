"""Rebus Rush: a puzzle can show a photo an author uploaded, next to drawings, and anyone playing can see it."""

import base64
import hashlib
import json
import struct
import zlib
from pathlib import Path

import pytest

from app.repos import rebus as repo

SEED = json.loads((Path(__file__).parent.parent / "app" / "rebus_seed.json").read_text())


def png(colour: int = 200) -> bytes:
    """A real, tiny PNG (4 x 4), so the server's check that a file is what it says passes."""

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    rows = b"".join(b"\x00" + bytes([colour, 90, 90]) * 4 for _ in range(4))
    header = chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
    return b"\x89PNG\r\n\x1a\n" + header + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


@pytest.fixture(autouse=True)
async def seeded(db):
    await repo.ensure_seed(db, SEED)


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def admin(client, db):
    from app.repos import users
    from app.security import passwords

    await users.create(db, "ops@example.com", passwords.hash_password("correct horse battery"), platform_role="admin")
    tokens = (await client.post("/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"})).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def upload(client, headers, data: bytes, mime: str = "image/png"):
    return await client.post("/rebus/studio/images", json={"mime": mime, "data": base64.b64encode(data).decode()}, headers=headers)


def puzzle_with(photo_key: str, **over):
    body = {
        "category": "food",
        "ages": [6, 12],
        "difficulty": 1,
        "trick": "compound",
        "pieces": [
            {"kind": "photo", "id": photo_key, "name": "mango", "scale": "big"},
            {"kind": "op", "op": "+"},
            {"kind": "icon", "id": "rebus-pie", "name": "pie"},
        ],
        "answer": "Mango pie",
        "accepts": [],
        "explanation": "mango + pie = mango pie.",
    }
    return {**body, **over}


async def test_only_a_studio_author_can_upload_and_the_file_must_be_a_real_photo(client, admin, owner):
    assert (await upload(client, owner, png())).status_code == 403
    assert (await upload(client, admin, b"this is not an image")).status_code == 415
    assert (await upload(client, admin, png(), "text/html")).status_code == 415
    ok = await upload(client, admin, png())
    assert ok.status_code == 200
    assert ok.json()["id"] == hashlib.sha256(png()).hexdigest()


async def test_a_puzzle_can_mix_a_photo_with_drawings_and_is_ready_only_when_the_photo_exists(client, admin):
    key = "photo-" + (await upload(client, admin, png())).json()["id"]
    made = await client.post("/rebus/studio/puzzles", json=puzzle_with(key), headers=admin)
    assert made.status_code in (200, 201), made.text
    assert made.json()["issues"] == []
    assert [p["kind"] for p in made.json()["pieces"]] == ["photo", "op", "icon"]

    ghost = await client.post("/rebus/studio/puzzles", json=puzzle_with("photo-" + "ab" * 32, answer="Ghost pie"), headers=admin)
    assert ghost.status_code in (200, 201), ghost.text
    assert ghost.json()["issues"] == ["unknown-photo"]


async def test_a_photo_must_be_written_as_a_photo_key(client, admin):
    bad = await client.post("/rebus/studio/puzzles", json=puzzle_with("../../etc/passwd"), headers=admin)
    assert bad.status_code == 422


async def test_anyone_can_see_a_photo_a_puzzle_shows_and_nothing_else(client, admin, owner):
    shown = (await upload(client, admin, png(10))).json()["id"]
    unused = (await upload(client, admin, png(20))).json()["id"]
    await client.post("/rebus/studio/puzzles", json=puzzle_with("photo-" + shown), headers=admin)

    # No account at all: a guest in a group room.
    seen = await client.get(f"/rebus/images/{shown}")
    assert seen.status_code == 200 and seen.content == png(10)
    assert seen.headers["content-type"] == "image/png" and "immutable" in seen.headers["cache-control"]
    # An uploaded photo that no puzzle shows is not served, and neither is anything that is not a photo id.
    assert (await client.get(f"/rebus/images/{unused}")).status_code == 404
    assert (await client.get("/rebus/images/not-an-id")).status_code == 404
    assert (await client.get("/rebus/images/" + "0" * 64)).status_code == 404
