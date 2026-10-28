"""Content packs: what is exported is what a fresh database ends up with.

Two real databases, no mocks — the point of a pack is that the target shows the
same books, pictures, recordings and trace collections as the source.
"""

import shutil

import pytest

from app import audio_store, content_pack
from app.repos import library as library_repo
from app.repos import trace as trace_repo
from app.settings import settings

PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 40


@pytest.fixture(autouse=True)
def library_audio_files(tmp_path, monkeypatch):
    monkeypatch.setattr(settings(), "library_audio_dir", str(tmp_path / "library-audio"))
    monkeypatch.setattr(settings(), "library_audio_bucket", None)
    monkeypatch.setattr(audio_store, "_encode_m4a", lambda data, _mime: b"test-m4a:" + data)


@pytest.fixture
async def target(db):
    handle = db.client[f"{db.name}_target"]
    yield handle
    await db.client.drop_database(handle.name)


async def _author(db):
    """A published book with a picture and a recording, a voice, and a published collection."""
    image_id = await library_repo.put_image(db, PNG, "image/png", "author")
    clip_id, _ = await audio_store.put(b"sentence-one", "audio/wav")
    word_id, _ = await audio_store.put(b"word-one", "audio/wav")
    passage = {
        "title": "Bot and the Seed",
        "language": "en",
        "band": "A",
        "ages": [5, 7],
        "picture": f"photo-{image_id}",
        "sentences": [{"id": "s1", "text": "Bot is small.", "audio": clip_id, "picture": f"photo-{image_id}"}],
        "wordAudio": {"small": word_id},
        "questions": [],
    }
    await library_repo.save_draft(db, "bot", passage, {}, "author")
    await library_repo.publish(db, "bot", passage, "author")
    await library_repo.save_draft(db, "unpublished", {**passage, "title": "Not yet"}, {}, "author")
    await library_repo.set_unit_voice(db, "ក", clip_id, "author")

    await trace_repo.save_item(db, "t-1", {"item": {"id": "t-1", "title": "A"}, "plan": {}, "tests": []}, "author")
    await trace_repo.save_collection(db, "c-1", {"title": "Letters", "itemIds": ["t-1"], "order": 1}, "author")
    await trace_repo.publish(db, "c-1", {"title": "Letters", "items": [{"item": {"id": "t-1"}, "plan": {}}]}, "author")
    await trace_repo.save_collection(db, "c-draft", {"title": "Draft only", "itemIds": []}, "author")
    return image_id, clip_id, word_id


async def test_a_fresh_database_gets_what_children_read(db, target, tmp_path):
    image_id, clip_id, word_id = await _author(db)
    pack = tmp_path / "pack"
    manifest = await content_pack.export_pack(db, pack)
    assert (manifest["books"], manifest["images"], manifest["audio"]) == (1, 1, 2)
    assert (manifest["traceCollections"], manifest["traceItems"], manifest["missing"]) == (1, 1, [])

    shutil.rmtree(tmp_path / "library-audio")  # the target has no recordings yet
    report = await content_pack.import_pack(target, pack)
    assert report["books"] == {"added": 1}
    assert report["images"] == {"added": 1}
    assert report["audio"] == {"added": 2}

    book = await target.library_books.find_one({"id": "bot"})
    assert book["rev"] == 1 and book["published"]["title"] == "Bot and the Seed"
    assert await target.library_books.count_documents({}) == 1, "a draft that was never published is not exported"
    assert bytes((await library_repo.get_image(target, image_id))["data"]) == PNG
    assert await audio_store.get(clip_id) == b"test-m4a:sentence-one"
    assert await audio_store.get(word_id) == b"test-m4a:word-one"
    assert await library_repo.unit_voices(target) == {"ក": clip_id}
    assert await target.library_revisions.count_documents({"bookId": "bot", "rev": 1}) == 1

    assert [c["id"] for c in await trace_repo.list_published(target)] == ["c-1"]
    assert (await trace_repo.get_item(target, "t-1")) is not None
    assert await target.trace_collections.count_documents({"id": "c-draft"}) == 0


async def test_importing_twice_changes_nothing(db, target, tmp_path):
    await _author(db)
    pack = tmp_path / "pack"
    await content_pack.export_pack(db, pack)
    await content_pack.import_pack(target, pack)
    again = await content_pack.import_pack(target, pack)
    assert again["books"] == {"kept": 1}
    assert again["traceCollections"] == {"kept": 1}
    assert again["images"] == {"kept": 1}


async def test_a_correction_made_on_the_server_survives_unless_update_is_asked_for(db, target, tmp_path):
    await _author(db)
    pack = tmp_path / "pack"
    await content_pack.export_pack(db, pack)
    await content_pack.import_pack(target, pack)

    await target.library_books.update_one({"id": "bot"}, {"$set": {"published.title": "Fixed on server"}})
    await content_pack.import_pack(target, pack)
    assert (await target.library_books.find_one({"id": "bot"}))["published"]["title"] == "Fixed on server"

    # The same revision is not "newer", so even --update leaves it.
    await content_pack.import_pack(target, pack, update=True)
    assert (await target.library_books.find_one({"id": "bot"}))["published"]["title"] == "Fixed on server"

    # Publish revision 2 at the source; now --update takes it.
    book = await library_repo.get(db, "bot")
    await library_repo.publish(db, "bot", {**book["published"], "title": "Bot, revised"}, "author")
    await content_pack.export_pack(db, pack)
    report = await content_pack.import_pack(target, pack, update=True)
    assert report["books"] == {"replaced": 1}
    assert (await target.library_books.find_one({"id": "bot"}))["published"]["title"] == "Bot, revised"


async def test_a_dry_run_writes_nothing(db, target, tmp_path):
    await _author(db)
    pack = tmp_path / "pack"
    await content_pack.export_pack(db, pack)
    report = await content_pack.import_pack(target, pack, dry_run=True)
    assert report["dryRun"] and report["books"] == {"added": 1}
    assert await target.library_books.count_documents({}) == 0
    assert await target.library_images.count_documents({}) == 0


async def test_a_damaged_pack_is_refused_before_anything_is_written(db, target, tmp_path):
    await _author(db)
    pack = tmp_path / "pack"
    await content_pack.export_pack(db, pack)
    next((pack / "library" / "images").iterdir()).write_bytes(b"tampered")
    with pytest.raises(content_pack.PackError, match="damaged"):
        await content_pack.import_pack(target, pack)
    assert await target.library_books.count_documents({}) == 0


async def test_a_folder_that_is_not_a_pack_is_refused(target, tmp_path):
    with pytest.raises(content_pack.PackError, match="manifest"):
        await content_pack.import_pack(target, tmp_path)
