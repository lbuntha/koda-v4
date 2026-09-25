"""Koda Library: the publish gate, and who may read, write and publish.

The verdict tests mirror `src/library/data/verifyPassage.test.ts` on the same
fixtures — the starter stories, byte-for-byte copies kept in step by a vitest
test — so the server and the editor cannot quietly disagree about a book.
"""

import base64
import copy
import hashlib
import json
from pathlib import Path

import pytest

from app import audio_store
from app.library_verify import tiles_of, verify_passage, why_unspellable
from app.repos import users
from app.security import passwords
from app.settings import settings

FIXTURES = Path(__file__).parent / "fixtures" / "library"
MARKET = json.loads((FIXTURES / "starter-market.json").read_text("utf-8"))
RAINY = json.loads((FIXTURES / "starter-rainy-day.json").read_text("utf-8"))
MARKET_KM = json.loads((FIXTURES / "starter-market-km.json").read_text("utf-8"))


@pytest.fixture(autouse=True)
def library_audio_files(tmp_path, monkeypatch):
    """Integration tests exercise file mapping without depending on FFmpeg."""
    monkeypatch.setattr(settings(), "library_audio_dir", str(tmp_path / "library-audio"))
    monkeypatch.setattr(settings(), "library_audio_bucket", None)
    monkeypatch.setattr(audio_store, "_encode_m4a", lambda data, _mime: b"test-m4a:" + data)


def q(p, qid):
    return next(x for x in p["questions"] if x["id"] == qid)


def failing(p, confirmed=True):
    return verify_passage(p, confirmed_split=confirmed).failing_rules()


# ----------------------------------------------------------------- the rules


@pytest.mark.parametrize("p", [MARKET, RAINY, MARKET_KM], ids=lambda p: p["id"])
def test_the_starter_stories_pass_content_checks_but_need_more_questions(p):
    v = verify_passage(p, confirmed_split=True)
    assert v.failures == []
    assert not v.counts_match_band
    assert not v.publishable


def test_counts_at_85_percent_are_publishable_counts():
    p = copy.deepcopy(MARKET)
    p["questions"] = (
        [{"id": f"q{i}", "kind": "comprehension", "prompt": "x", "options": ["a", "b", "c"], "answer": 0,
          "evidence": "s1"} for i in range(9)]
        + [{"id": f"w{i}", "kind": "vocab", "prompt": "x", "word": "x", "options": ["a", "b", "c"], "answer": 0} for i in range(9)]
        + [{"id": f"s{i}", "kind": "spell", "sentence": "s1", "word": "market"} for i in range(9)]
    )
    assert verify_passage(p, confirmed_split=True).counts_match_band
    p["questions"].pop()
    assert not verify_passage(p, confirmed_split=True).counts_match_band


def test_khmer_tiles_match_the_client():
    assert tiles_of("ស្វាយ", "km") == ["ស", "្វ", "ា", "យ"]
    assert tiles_of("ស្ត្រី", "km") == ["ស", "្ត", "្រ", "ី"]
    assert tiles_of("ខ\u17c2\u17d2មរ", "km") == ["ខ", "្ម", "ែ", "រ"]  # typed in drawn order
    assert why_unspellable("ក\u17b6\u17b7", "km") == "two_vowels"
    assert why_unspellable("ក្", "km") == "dangling_coeng"
    assert why_unspellable("ាក", "km") == "starts_with_mark"
    assert why_unspellable("strawberries", "en") == "too_many_tiles"


def test_each_rule_fails_on_its_own_breakage():
    p = copy.deepcopy(MARKET)
    q(p, "q1")["evidence"] = "s1"
    assert failing(p) == [1]

    p = copy.deepcopy(MARKET)
    q(p, "q2")["options"] = ["The zebra", "The mango", "The lion"]
    assert failing(p) == [2]

    p = copy.deepcopy(MARKET)
    q(p, "q2")["options"] = ["The market", "The mango is here", "The sun"]
    assert failing(p) == [3]

    p = copy.deepcopy(MARKET)
    q(p, "q2")["prompt"] = "  "
    assert failing(p) == [4]

    p = copy.deepcopy(MARKET)
    q(p, "sp1")["word"] = "zebra"
    assert failing(p) == [5]

    p = copy.deepcopy(MARKET)
    q(p, "sp2")["word"] = "market"
    q(p, "sp2")["sentence"] = "s1"
    assert failing(p) == [6]

    assert failing(MARKET_KM, confirmed=False) == [8]
    assert failing(MARKET, confirmed=False) == []


def test_a_khmer_distractor_sharing_a_word_in_the_middle_is_seen():
    """Khmer writes without spaces, so the word split hands back a whole clause as
    one token and a four-letter stem only ever sees its opening. A distractor
    built the way a good one is — the story's words rearranged, the shared word in
    the middle — read as story-free, and the server refused to publish a question
    whose author had done nothing wrong. Must agree with the client's verifier.
    """
    p = copy.deepcopy(MARKET_KM)
    target = next(x for x in p["questions"] if x["kind"] == "comprehension")
    shared = next(w for s in p["sentences"] for w in s["words"] if len(w) >= 2)
    right = target["options"][target["answer"]]
    target["options"] = [
        right if i == target["answer"] else f"ភ្លេច{shared}{'ៗ' * (i + 1)}"
        for i in range(len(target["options"]))
    ]
    assert 2 not in failing(p)


def test_a_malformed_book_is_refused_not_crashed_on():
    p = copy.deepcopy(MARKET)
    q(p, "q1")["answer"] = 7
    p["sentences"][0]["words"][1] = "went"
    v = verify_passage(p, confirmed_split=True)
    assert 0 in v.failing_rules()
    assert not v.publishable


def test_counts_are_exact():
    p = copy.deepcopy(MARKET)
    p["questions"] = [x for x in p["questions"] if x["id"] != "sp3"]
    v = verify_passage(p, confirmed_split=True)
    assert v.failures == []
    assert not v.counts_match_band
    assert not v.publishable


# ------------------------------------------------------------------- the API


async def _login(client, db, email: str, *, platform_role: str | None = None) -> dict[str, str]:
    await users.create(db, email, passwords.hash_password("123456"), platform_role=platform_role)
    tokens = (await client.post("/auth/login", json={"email": email, "password": "123456"})).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


def _draft(p, **extra):
    return {"passage": {k: v for k, v in p.items() if k not in ("id", "rev")}, **extra}


async def test_an_author_saves_but_short_legacy_content_needs_more_questions(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")

    saved = await client.put("/library/drafts/farm-day", json=_draft(MARKET), headers=dev)
    assert saved.status_code == 200, saved.text
    assert saved.json()["status"] == "draft"

    # Not on the shelf until it is published.
    assert (await client.get("/library/books", headers=dev)).json()["books"] == []

    published = await client.post("/library/drafts/farm-day/publish", headers=dev)
    assert published.status_code == 422 and published.json()["error"]["code"] == "not_publishable"
    assert (await client.get("/library/books", headers=dev)).json()["books"] == []


async def test_word_highlight_times_must_match_the_approved_split(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    book = copy.deepcopy(MARKET)
    sentence = book["sentences"][0]
    sentence["audio"] = "a" * 64
    sentence["audioCues"] = [
        {"startMs": i * 100, "endMs": (i + 1) * 100}
        for i in range(len(sentence["words"]))
    ]
    kept = await client.put("/library/drafts/timed", json=_draft(book), headers=dev)
    assert kept.status_code == 200, kept.text
    assert kept.json()["draft"]["sentences"][0]["audioCues"] == sentence["audioCues"]

    sentence["audioCues"].pop()
    refused = await client.put("/library/drafts/bad-times", json=_draft(book), headers=dev)
    assert refused.status_code == 400
    assert "approved word split" in refused.text


async def test_the_server_refuses_a_book_that_fails_its_checks(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    broken = copy.deepcopy(MARKET)
    q(broken, "q2")["options"] = ["The market", "The mango is here", "The sun"]
    await client.put("/library/drafts/broken", json=_draft(broken), headers=dev)

    refused = await client.post("/library/drafts/broken/publish", headers=dev)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "not_publishable"
    assert "longest" in refused.json()["error"]["message"]
    assert (await client.get("/library/books", headers=dev)).json()["books"] == []


async def test_khmer_needs_a_person_to_confirm_the_split(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/library/drafts/market-km", json=_draft(MARKET_KM), headers=dev)
    assert (await client.post("/library/drafts/market-km/publish", headers=dev)).status_code == 422

    await client.put("/library/drafts/market-km", json=_draft(MARKET_KM, confirmedSplit=True), headers=dev)
    assert (await client.post("/library/drafts/market-km/publish", headers=dev)).status_code == 422


async def test_a_parent_can_read_but_not_write(client, db, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}

    assert (await client.get("/library/books", headers=parent)).status_code == 200
    assert (await client.get("/library/can-author", headers=parent)).status_code == 403
    assert (await client.get("/library/drafts", headers=parent)).status_code == 403
    assert (await client.put("/library/drafts/x", json=_draft(MARKET), headers=parent)).status_code == 403


async def test_can_author_answers_yes_for_an_operator(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    assert (await client.get("/library/can-author", headers=dev)).status_code == 204


async def test_unpublish_takes_it_off_the_shelf_and_delete_removes_it(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/library/drafts/farm-day", json=_draft(MARKET), headers=dev)
    await client.post("/library/drafts/farm-day/publish", headers=dev)
    await client.post("/library/drafts/farm-day/unpublish", headers=dev)
    assert (await client.get("/library/books", headers=dev)).json()["books"] == []
    assert (await client.delete("/library/drafts/farm-day", headers=dev)).status_code == 204
    assert (await client.get("/library/drafts", headers=dev)).json()["books"] == []


async def test_ids_and_sizes_are_bounded(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    assert (await client.put("/library/drafts/Not An Id", json=_draft(MARKET), headers=dev)).status_code in (400, 404)
    huge = copy.deepcopy(MARKET)
    huge["sentences"] = huge["sentences"] * 20
    assert (await client.put("/library/drafts/huge", json=_draft(huge), headers=dev)).status_code == 413



async def test_page_pictures_are_kept_and_must_be_picture_keys(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    book = copy.deepcopy(MARKET)
    book["sentences"][0]["picture"] = "cat"
    book["sentences"][2]["picture"] = None  # "no picture on this page"
    saved = await client.put("/library/drafts/pics", json=_draft(book), headers=dev)
    assert saved.status_code == 200, saved.text
    sentences = saved.json()["draft"]["sentences"]
    assert sentences[0]["picture"] == "cat" and sentences[2]["picture"] is None

    bad = copy.deepcopy(MARKET)
    bad["sentences"][0]["picture"] = "<svg onload=x>"
    assert (await client.put("/library/drafts/pics", json=_draft(bad), headers=dev)).status_code == 400
    cover = copy.deepcopy(MARKET)
    cover["picture"] = "Not A Key"
    assert (await client.put("/library/drafts/pics", json=_draft(cover), headers=dev)).status_code == 400


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def test_a_photo_is_stored_by_its_hash_and_shown_to_readers(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    up = await client.post("/library/images", json={"mime": "image/png", "data": base64.b64encode(PNG).decode()}, headers=dev)
    assert up.status_code == 200, up.text
    image_id = up.json()["id"]
    assert image_id == hashlib.sha256(PNG).hexdigest()
    got = await client.get(f"/library/images/{image_id}", headers=dev)
    assert got.status_code == 200 and got.content == PNG
    assert got.headers["content-type"] == "image/png" and got.headers["x-content-type-options"] == "nosniff"


async def test_only_real_photos_are_accepted(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    svg = base64.b64encode(b"<svg onload='x'/>").decode()
    assert (await client.post("/library/images", json={"mime": "image/svg+xml", "data": svg}, headers=dev)).status_code == 415
    assert (await client.post("/library/images", json={"mime": "image/png", "data": svg}, headers=dev)).status_code == 415


async def test_a_page_photo_and_its_place_are_kept_and_must_exist_to_publish(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    book = copy.deepcopy(MARKET)
    missing = "photo-" + "a" * 64
    book["sentences"][0].update({"picture": missing, "pictureAt": "left"})
    saved = await client.put("/library/drafts/photo-book", json=_draft(book), headers=dev)
    assert saved.status_code == 200, saved.text
    assert saved.json()["draft"]["sentences"][0]["pictureAt"] == "left"
    refused = await client.post("/library/drafts/photo-book/publish", headers=dev)
    assert refused.status_code == 422 and "question counts" in refused.text

    up = await client.post("/library/images", json={"mime": "image/png", "data": base64.b64encode(PNG).decode()}, headers=dev)
    book["sentences"][0]["picture"] = "photo-" + up.json()["id"]
    await client.put("/library/drafts/photo-book", json=_draft(book), headers=dev)
    assert (await client.post("/library/drafts/photo-book/publish", headers=dev)).status_code == 422

    book["sentences"][0]["pictureAt"] = "middle"
    assert (await client.put("/library/drafts/photo-book", json=_draft(book), headers=dev)).status_code == 400


async def test_a_unit_name_recording_is_kept_by_unit_and_read_by_every_reader(client, db, signup_body):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    clip = (await client.post("/library/audio", json={"mime": "audio/wav", "data": _b64(WAV)}, headers=dev)).json()["id"]
    foot = "\u17d2\u1798"  # ◌្ម, said "ជើងម"
    put = await client.put("/library/unit-voices", json={"unit": foot, "clip": clip}, headers=dev)
    assert put.status_code == 200, put.text
    assert put.json()["voices"] == {foot: clip}

    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    assert (await client.get("/library/unit-voices", headers=parent)).json()["voices"] == {foot: clip}
    assert (await client.put("/library/unit-voices", json={"unit": foot, "clip": None}, headers=parent)).status_code == 403

    await client.put("/library/unit-voices", json={"unit": foot, "clip": None}, headers=dev)
    assert (await client.get("/library/unit-voices", headers=dev)).json()["voices"] == {}


async def test_a_unit_name_must_be_one_unit_and_its_recording_must_exist(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    clip = (await client.post("/library/audio", json={"mime": "audio/wav", "data": _b64(WAV)}, headers=dev)).json()["id"]
    for bad in ("mango", "\u1781\u17d2\u1798\u17c2\u179a", ""):
        assert (await client.put("/library/unit-voices", json={"unit": bad, "clip": clip}, headers=dev)).status_code == 400
    assert (await client.put("/library/unit-voices", json={"unit": "\u1780", "clip": "f" * 64}, headers=dev)).status_code == 422


# ------------------------------------------------------------- the studio list


async def _shelf_of(client, dev, n: int, **over) -> None:
    for i in range(n):
        book = {**copy.deepcopy(MARKET), **over, "title": f"{over.get('title', 'Book')} {i:02d}"}
        await client.put(f"/library/drafts/{over.get('prefix', 'book')}-{i:02d}", json=_draft(book), headers=dev)


async def test_the_studio_list_pages_and_counts_in_the_database(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await _shelf_of(client, dev, 12)
    page = (await client.get("/library/drafts?pageSize=5&page=3", headers=dev)).json()
    assert page["total"] == 12 and page["pages"] == 3 and page["page"] == 3
    assert len(page["books"]) == 2
    row = page["books"][0]
    # A summary, never the story.
    assert "draft" not in row and "sentences" in row and isinstance(row["sentences"], int)
    assert row["sentences"] == len(MARKET["sentences"]) and row["questions"] == len(MARKET["questions"])
    assert page["stats"] == {"all": 12, "draft": 12, "published": 0, "changed": 0, "reported": 0}

    titles = [b["title"] for b in (await client.get("/library/drafts?sort=title&pageSize=100", headers=dev)).json()["books"]]
    assert titles == sorted(titles)


async def test_the_studio_list_searches_filters_and_offers_only_real_options(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await _shelf_of(client, dev, 3, title="Farm", prefix="farm")
    await _shelf_of(client, dev, 2, title="Rain", prefix="rain", category="Weather & play", band="B")
    await client.put("/library/drafts/km-one", json=_draft(MARKET_KM), headers=dev)

    got = (await client.get("/library/drafts?q=rain", headers=dev)).json()
    assert {b["id"] for b in got["books"]} == {"rain-00", "rain-01"}
    assert (await client.get("/library/drafts?q=FARM-0", headers=dev)).json()["total"] == 3  # the id matches too
    assert (await client.get("/library/drafts?q=.*", headers=dev)).json()["total"] == 0  # a pattern is text, not a regex
    assert (await client.get("/library/drafts?language=km", headers=dev)).json()["total"] == 1
    assert (await client.get("/library/drafts?band=B&category=Weather %26 play", headers=dev)).json()["total"] == 2

    facets = got["facets"]
    assert {f["value"]: f["count"] for f in facets["languages"]} == {"en": 5, "km": 1}
    assert {f["value"] for f in facets["categories"]} >= {"Weather & play"}


async def test_the_studio_list_knows_published_changed_and_reported(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await _shelf_of(client, dev, 3)
    for i in (0, 1):
        assert (await client.post(f"/library/drafts/book-0{i}/publish", headers=dev)).status_code == 422
    await client.put("/library/drafts/book-01", json=_draft({**MARKET, "title": "Book 01 again"}), headers=dev)  # saved after publishing
    await client.post("/library/books/book-00/reports", json={"rev": 1, "reason": "other", "note": ""}, headers=dev)

    stats = (await client.get("/library/drafts", headers=dev)).json()["stats"]
    assert stats == {"all": 3, "draft": 3, "published": 0, "changed": 0, "reported": 1}
    changed = (await client.get("/library/drafts?status=changed", headers=dev)).json()["books"]
    assert changed == []
    reported = (await client.get("/library/drafts?status=reported", headers=dev)).json()["books"]
    assert [(b["id"], b["reports"]) for b in reported] == [("book-00", 1)]
    assert len((await client.get("/library/reports?bookId=book-00", headers=dev)).json()["reports"]) == 1
    assert (await client.get("/library/reports?bookId=book-02", headers=dev)).json()["reports"] == []


async def test_one_book_loads_in_full_and_the_list_rejects_silly_requests(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await _shelf_of(client, dev, 1)
    full = (await client.get("/library/drafts/book-00", headers=dev)).json()
    assert full["draft"]["sentences"] == MARKET["sentences"]
    assert (await client.get("/library/drafts/nope", headers=dev)).status_code == 404
    assert (await client.get("/library/drafts?pageSize=1000", headers=dev)).status_code == 422
    assert (await client.get("/library/drafts?status=everything", headers=dev)).status_code == 422
    assert (await client.get("/library/drafts?sort=random", headers=dev)).status_code == 422
    meta = (await client.get("/library/studio/meta", headers=dev)).json()
    assert "Weather & play" in meta["categories"] and meta["pageSizeMax"] == 100 and "changed" in meta["statuses"]


async def test_the_units_to_record_come_from_every_khmer_book(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/library/drafts/km-one", json=_draft(MARKET_KM), headers=dev)
    units = (await client.get("/library/studio/spelling-units", headers=dev)).json()["units"]
    words = [q["word"] for q in MARKET_KM["questions"] if q["kind"] == "spell"]
    assert set(units) == {u for w in words for u in tiles_of(w, "km")}

# ------------------------------------------------------------- recordings


WAV = b"RIFF" + b"\x00" * 40 + b"sound"


def _b64(data: bytes) -> str:
    import base64

    return base64.b64encode(data).decode()


async def test_recordings_upload_once_play_for_readers_and_stay_optional(client, db, signup_body):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    up = await client.post("/library/audio", json={"mime": "audio/wav", "data": _b64(WAV)}, headers=dev)
    assert up.status_code == 200, up.text
    clip = up.json()["id"]
    assert len(clip) == 64
    # The same bytes are the same clip.
    assert (await client.post("/library/audio", json={"mime": "audio/wav", "data": _b64(WAV)}, headers=dev)).json()["id"] == clip
    sizes = await client.post("/library/audio/sizes", json={"ids": [clip]}, headers=dev)
    assert sizes.status_code == 200
    stored = b"test-m4a:" + WAV
    assert sizes.json()["sizes"] == {clip: len(stored)}
    path = Path(settings().library_audio_dir) / clip[:2] / clip[2:4] / f"{clip}.m4a"
    assert path.read_bytes() == stored
    assert await db.library_audio.count_documents({}) == 0

    book = copy.deepcopy(MARKET)
    book["sentences"][0]["audio"] = clip
    await client.put("/library/drafts/farm-day", json=_draft(book), headers=dev)
    assert (await client.post("/library/drafts/farm-day/publish", headers=dev)).status_code == 422

    # A family device can play it; it is marked immutable so it can be kept offline.
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    got = await client.get(f"/library/audio/{clip}", headers=parent)
    assert got.status_code == 200 and got.content == stored
    assert got.headers["content-type"].startswith("audio/mp4")
    assert "immutable" in got.headers["cache-control"]

    # …but may not upload.
    assert (await client.post("/library/audio", json={"mime": "audio/wav", "data": _b64(WAV)}, headers=parent)).status_code == 403


async def test_a_book_pointing_at_a_missing_recording_is_refused(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    book = copy.deepcopy(MARKET)
    book["sentences"][0]["audio"] = "f" * 64
    await client.put("/library/drafts/farm-day", json=_draft(book), headers=dev)
    refused = await client.post("/library/drafts/farm-day/publish", headers=dev)
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "not_publishable"

    book["sentences"][0]["audio"] = "s1.m4a"
    await client.put("/library/drafts/farm-day", json=_draft(book), headers=dev)
    assert (await client.post("/library/drafts/farm-day/publish", headers=dev)).json()["error"]["code"] == "not_publishable"


async def test_recordings_are_bounded(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    assert (await client.post("/library/audio", json={"mime": "text/html", "data": _b64(WAV)}, headers=dev)).status_code == 415
    assert (await client.post("/library/audio", json={"mime": "audio/wav", "data": "not base64!"}, headers=dev)).status_code == 400
    big = _b64(b"x" * (2 * 1024 * 1024 + 1))
    assert (await client.post("/library/audio", json={"mime": "audio/wav", "data": big}, headers=dev)).status_code == 413
    assert (await client.get("/library/audio/nope", headers=dev)).status_code == 404


# -------------------------------------------------------------------- reports


async def test_a_reader_reports_a_book_and_an_author_resolves_it(client, db, signup_body):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}

    made = await client.post(
        "/library/books/farm-day/reports",
        json={"rev": 2, "reason": "wrong_question", "note": "q2 has two right answers"},
        headers=parent,
    )
    assert made.status_code == 201, made.text

    # Only authors read the reports.
    assert (await client.get("/library/reports", headers=parent)).status_code == 403
    reports = (await client.get("/library/reports", headers=dev)).json()["reports"]
    assert [(r["bookId"], r["rev"], r["reason"], r["note"]) for r in reports] == [
        ("farm-day", 2, "wrong_question", "q2 has two right answers")
    ]

    assert (await client.post(f"/library/reports/{reports[0]['id']}/resolve", headers=dev)).status_code == 204
    assert (await client.get("/library/reports", headers=dev)).json()["reports"] == []
    assert (await client.post(f"/library/reports/{reports[0]['id']}/resolve", headers=dev)).status_code == 404


async def test_a_report_needs_a_known_reason(client, db, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    assert (await client.post("/library/books/farm-day/reports", json={"reason": "spam"}, headers=parent)).status_code == 400
