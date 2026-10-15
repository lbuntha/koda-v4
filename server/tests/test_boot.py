"""Startup prepares a database once per release, not once per cold start."""

from app import boot, main
from app import db as database


async def _noop() -> None:
    return None


def test_the_fingerprint_follows_the_files_and_nothing_else(tmp_path):
    (tmp_path / "a.py").write_text("x = 1\n")
    (tmp_path / "seed.json").write_text("[]")
    first = boot.fingerprint(tmp_path)
    assert boot.fingerprint(tmp_path) == first, "the same files must give the same print"

    # Compiled leftovers are not the release.
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "__pycache__" / "a.cpython-312.pyc").write_bytes(b"\x00")
    assert boot.fingerprint(tmp_path) == first

    # A change to seed data is a change to the release, not only a code change.
    (tmp_path / "seed.json").write_text('[{"id": "new"}]')
    assert boot.fingerprint(tmp_path) != first


def test_the_real_package_has_a_fingerprint():
    assert len(boot.fingerprint()) == 64


async def test_startup_prepares_once_per_release(db, monkeypatch):
    monkeypatch.setattr(database, "connect", lambda *args, **kwargs: db)
    # The fixture owns the handle; shutting the app down must not close it under the test.
    monkeypatch.setattr(database, "close", _noop)
    runs = []
    real_prepare = main._prepare

    async def counted(handle):
        runs.append(1)
        await real_prepare(handle)

    monkeypatch.setattr(main, "_prepare", counted)
    app = main.create_app()

    async with main.lifespan(app):
        pass
    assert len(runs) == 1, "a database this release has never seen is prepared"
    assert await db.menu_items.count_documents({}) > 0, "and the defaults are really there"

    async with main.lifespan(app):
        pass
    assert len(runs) == 1, "a second cold start of the same release skips the work"

    monkeypatch.setattr(boot, "fingerprint", lambda: "a-new-release")
    async with main.lifespan(app):
        pass
    assert len(runs) == 2, "a new release prepares again"


async def test_a_failed_startup_is_retried(db, monkeypatch):
    monkeypatch.setattr(database, "connect", lambda *args, **kwargs: db)
    # The fixture owns the handle; shutting the app down must not close it under the test.
    monkeypatch.setattr(database, "close", _noop)

    async def broken(handle):
        raise RuntimeError("the database went away mid-seed")

    monkeypatch.setattr(main, "_prepare", broken)
    try:
        async with main.lifespan(main.create_app()):
            pass
    except RuntimeError:
        pass
    assert not await boot.is_current(db, boot.fingerprint()), "half-done work must not be marked done"
