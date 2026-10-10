"""Koda Trace: who may make collections, the publish gate, and what children download."""

import base64
import copy

from app.repos import users
from app.security import passwords
from app.trace_verify import item_problems

LINE = {
    "id": "x",
    "rev": 1,
    "title": "Line",
    "kind": "line",
    "grid": "none",
    "sensitivity": "balanced",
    "strokes": [
        {
            "id": "s1",
            "order": 1,
            "shape": "line",
            "closed": False,
            "join": "lift",
            "width": 60,
            "checkpoints": [],
            "nodes": [{"x": 500, "y": 150, "type": "corner"}, {"x": 500, "y": 850, "type": "corner"}],
        },
    ],
    "guide": {"glyph": {"text": "|", "size": 700, "x": 500, "y": 780}},
}
PLAN = {"steps": [{"id": "watch", "pass": 0, "times": 1}, {"id": "guided", "pass": 70, "times": 2}], "canDoAt": "guided"}
PASSED = {"watch": {"score": 100, "accepted": True, "strokes": "a"}, "guided": {"score": 90, "accepted": True, "strokes": "a"}}


async def _login(client, db, email, *, platform_role=None):
    await users.create(db, email, passwords.hash_password("123456"), platform_role=platform_role)
    tokens = (await client.post("/auth/login", json={"email": email, "password": "123456"})).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


def test_an_item_is_publishable_only_when_complete_and_tested():
    assert item_problems(LINE, PLAN, PASSED) == []
    assert any("test-written" in p for p in item_problems(LINE, PLAN, {}))
    untitled = {**LINE, "title": " "}
    assert "it has no title" in item_problems(untitled, PLAN, PASSED)
    outside = copy.deepcopy(LINE)
    outside["strokes"][0]["nodes"][1]["x"] = 1400
    assert any("outside the canvas" in p for p in item_problems(outside, PLAN, PASSED))
    low = {**PASSED, "guided": {"score": 50, "accepted": True}}
    assert any("guided" in p for p in item_problems(LINE, PLAN, low))


def test_a_colouring_item_needs_colour_steps_not_writing_tests():
    step = {"id": "p1", "color": "red", "seeds": [{"x": 300, "y": 500}]}
    colour = {**LINE, "kind": "drawing", "activity": "color", "paint": {"steps": [step]}}
    assert item_problems(colour, PLAN, {}) == []
    custom = copy.deepcopy(colour)
    custom["paint"]["steps"][0]["color"] = "#d6a078"
    assert item_problems(custom, PLAN, {}) == []
    assert "it has no colour steps" in item_problems({**colour, "paint": {"steps": []}}, PLAN, {})
    bad = copy.deepcopy(colour)
    bad["paint"]["steps"][0].update(color="gold", seeds=[])
    problems = item_problems(bad, PLAN, {})
    assert any("unknown colour" in p for p in problems)
    assert any("no areas" in p for p in problems)
    assert any("activity" in p for p in item_problems({**LINE, "activity": "paint"}, PLAN, PASSED))
    picture = {"lines": "data:image/png;base64,AAAA", "walls": "A" * 41668, "strength": 150}
    from_picture = {**colour, "strokes": [], "paint": {**colour["paint"], "picture": picture}}
    assert item_problems(from_picture, PLAN, {}) == []
    assert "it has no line art" in item_problems({**colour, "strokes": []}, PLAN, {})
    broken = {**from_picture, "paint": {**from_picture["paint"], "picture": {**picture, "walls": "short"}}}
    assert any("parts are not readable" in p for p in item_problems(broken, PLAN, {}))


def test_a_continued_stroke_must_touch_the_one_before():
    two = copy.deepcopy(LINE)
    two["strokes"].append(
        {
            "id": "s2",
            "order": 2,
            "shape": "line",
            "closed": False,
            "join": "continue",
            "width": 60,
            "checkpoints": [],
            "nodes": [{"x": 560, "y": 850, "type": "corner"}, {"x": 800, "y": 850, "type": "corner"}],
        }
    )
    assert any("does not touch" in p for p in item_problems(two, PLAN, PASSED))


async def test_a_parent_can_play_but_not_make(client, db, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    assert (await client.get("/trace/collections", headers=parent)).status_code == 200
    assert (await client.get("/trace/studio/items", headers=parent)).status_code == 403
    assert (await client.put("/trace/studio/items/a", json={"item": LINE, "plan": PLAN}, headers=parent)).status_code == 403


async def test_a_creator_publishes_a_collection_everyone_can_download(client, db, signup_body):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    saved = await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    assert saved.status_code == 200
    assert saved.json()["item"]["id"] == "line-1"
    col = await client.put("/trace/studio/collections/lines", json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"]}, headers=dev)
    assert col.json()["publishedRev"] is None

    published = await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert published.status_code == 200, published.text
    assert published.json()["publishedRev"] == 1

    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    anyone = {"Authorization": f"Bearer {tokens['accessToken']}"}
    shelf = (await client.get("/trace/collections", headers=anyone)).json()["collections"]
    assert [(c["id"], c["count"], c["rev"]) for c in shelf] == [("lines", 1, 1)]
    bundle = (await client.get("/trace/collections/lines", headers=anyone)).json()
    assert bundle["items"][0]["item"]["title"] == "Line"
    # The Studio's guide never reaches a child's device.
    assert "guide" not in bundle["items"][0]["item"]


async def test_publish_refuses_an_untested_item_and_says_which(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": {}}, headers=dev)
    await client.put("/trace/studio/collections/lines", json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"]}, headers=dev)
    refused = await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert refused.status_code == 422
    assert "Line" in refused.text
    problems = (await client.post("/trace/studio/collections/lines/check", headers=dev)).json()["problems"]
    assert problems[0]["item"] == "line-1"


async def test_republishing_makes_a_new_revision_and_unpublish_takes_it_off_the_shelf(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    await client.put("/trace/studio/collections/lines", json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"]}, headers=dev)
    await client.post("/trace/studio/collections/lines/publish", headers=dev)
    again = await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert again.json()["publishedRev"] == 2
    await client.post("/trace/studio/collections/lines/unpublish", headers=dev)
    assert (await client.get("/trace/collections", headers=dev)).json()["collections"] == []


async def test_ids_and_duplicates_are_refused(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    assert (await client.put("/trace/studio/items/Bad_Id", json={"item": LINE, "plan": PLAN}, headers=dev)).status_code == 422
    dup = await client.put("/trace/studio/collections/c", json={"ages": [6, 8], "title": "C", "itemIds": ["a", "a"]}, headers=dev)
    assert dup.status_code == 422


def test_no_family_role_can_be_granted_trace_create():
    from app.security.policy import effective_permissions

    assert "trace:create" not in effective_permissions("owner", extra=["trace:create"])
    assert "trace:create" not in effective_permissions("child", extra=["trace:create"])


async def test_a_learner_reports_an_item_and_a_creator_resolves_it(client, db, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    sent = await client.post(
        "/trace/reports",
        json={"itemId": "line-1", "collectionId": "lines", "rev": 1, "reason": "strokes_wrong", "note": "goes up"},
        headers=parent,
    )
    assert sent.status_code == 201
    assert (await client.post("/trace/reports", json={"itemId": "line-1", "reason": "nope"}, headers=parent)).status_code == 422
    assert (await client.get("/trace/studio/reports", headers=parent)).status_code == 403

    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    reports = (await client.get("/trace/studio/reports", headers=dev)).json()["reports"]
    assert [(r["itemId"], r["reason"], r["note"]) for r in reports] == [("line-1", "strokes_wrong", "goes up")]
    assert "reportedBy" not in reports[0]
    assert (await client.post(f"/trace/studio/reports/{reports[0]['id']}/resolve", headers=dev)).status_code == 204
    assert (await client.get("/trace/studio/reports", headers=dev)).json()["reports"] == []


async def test_the_chosen_cover_is_the_shelf_cover(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    second = {**copy.deepcopy(LINE), "title": "Second"}
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    await client.put("/trace/studio/items/line-2", json={"item": second, "plan": PLAN, "tests": PASSED}, headers=dev)
    saved = await client.put(
        "/trace/studio/collections/lines",
        json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1", "line-2"], "cover": "line-2"},
        headers=dev,
    )
    assert saved.json()["cover"] == "line-2"
    await client.post("/trace/studio/collections/lines/publish", headers=dev)
    shelf = (await client.get("/trace/collections", headers=dev)).json()["collections"]
    assert shelf[0]["cover"]["title"] == "Second"
    # A cover that is not in the collection is dropped.
    assert (
        await client.put(
            "/trace/studio/collections/lines",
            json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"], "cover": "line-2"},
            headers=dev,
        )
    ).json()["cover"] is None


async def test_a_cover_picture_is_saved_and_published(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    photo = "photo-" + "a" * 64
    url = "/trace/studio/collections/lines"
    saved = await client.put(url, json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"], "picture": photo}, headers=dev)
    assert saved.json()["picture"] == photo
    await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert (await client.get("/trace/collections", headers=dev)).json()["collections"][0]["picture"] == photo
    assert (await client.get("/trace/collections/lines", headers=dev)).json()["picture"] == photo
    # Only a picture name or a photo key, never markup or a URL.
    bad = await client.put(url, json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"], "picture": "https://x/y.png"}, headers=dev)
    assert bad.status_code == 422



async def test_a_collections_xp_per_step_is_saved_and_published(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    url = "/trace/studio/collections/lines"
    saved = await client.put(url, json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"], "xpPerStep": 35}, headers=dev)
    assert saved.json()["xpPerStep"] == 35
    await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert (await client.get("/trace/collections/lines", headers=dev)).json()["xpPerStep"] == 35
    # Absent means the deployment's XP per level; out of range is refused.
    assert (await client.put(url, json={"ages": [6, 8], "title": "Lines", "itemIds": ["line-1"]}, headers=dev)).json()["xpPerStep"] is None
    assert (await client.put(url, json={"ages": [6, 8], "title": "Lines", "xpPerStep": 9999}, headers=dev)).status_code == 422

# ------------------------------------------------- creators, review, progress


async def _creator(client, db, email):
    """A user a Koda admin gave a custom role holding only the Trace Studio permission."""
    from app.repos import platform_roles

    if not await platform_roles.by_id(db, "trace-creator"):
        await platform_roles.create(db, "trace-creator", "Trace creator", "", ["settings:read", "trace:create"], "admin")
    return await _login(client, db, email, platform_role="trace-creator")


async def _ready_collection(client, headers, cid="lines", iid="line-1"):
    await client.put(f"/trace/studio/items/{iid}", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=headers)
    await client.put(f"/trace/studio/collections/{cid}", json={"ages": [6, 8], "title": "Lines", "itemIds": [iid]}, headers=headers)


async def test_a_creator_sees_and_changes_only_their_own_work(client, db):
    ann = await _creator(client, db, "ann@example.com")
    bob = await _creator(client, db, "bob@example.com")
    await _ready_collection(client, ann)

    assert (await client.get("/trace/studio/items", headers=bob)).json()["items"] == []
    assert (await client.get("/trace/studio/collections", headers=bob)).json()["collections"] == []
    taken = await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN}, headers=bob)
    assert taken.status_code == 403
    assert (await client.delete("/trace/studio/collections/lines", headers=bob)).status_code == 403

    admin = await _login(client, db, "admin@example.com", platform_role="admin")
    assert [i["id"] for i in (await client.get("/trace/studio/items", headers=admin)).json()["items"]] == ["line-1"]


async def test_a_creator_has_limits_and_an_admin_does_not(client, db, monkeypatch):
    from app.routers import trace as trace_router

    monkeypatch.setattr(trace_router, "MAX_ITEMS_PER_CREATOR", 1)
    ann = await _creator(client, db, "ann@example.com")
    assert (await client.put("/trace/studio/items/a", json={"item": LINE, "plan": PLAN}, headers=ann)).status_code == 200
    # Saving the same item again is not a new one.
    assert (await client.put("/trace/studio/items/a", json={"item": LINE, "plan": PLAN}, headers=ann)).status_code == 200
    assert (await client.put("/trace/studio/items/b", json={"item": LINE, "plan": PLAN}, headers=ann)).status_code == 429
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    for i in ("c", "d"):
        assert (await client.put(f"/trace/studio/items/{i}", json={"item": LINE, "plan": PLAN}, headers=dev)).status_code == 200


async def test_a_creators_publish_waits_for_an_admin(client, db, signup_body):
    ann = await _creator(client, db, "ann@example.com")
    await _ready_collection(client, ann)
    asked = (await client.post("/trace/studio/collections/lines/publish", headers=ann)).json()
    assert asked["reviewState"] == "pending"
    assert asked["publishedRev"] is None
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    anyone = {"Authorization": f"Bearer {tokens['accessToken']}"}
    assert (await client.get("/trace/collections", headers=anyone)).json()["collections"] == []
    # Only an admin sees the queue.
    assert (await client.get("/trace/studio/review", headers=ann)).status_code == 403

    admin = await _login(client, db, "admin@example.com", platform_role="admin")
    queue = (await client.get("/trace/studio/review", headers=admin)).json()["collections"]
    assert [c["id"] for c in queue] == ["lines"]
    assert queue[0]["pending"]["items"][0]["item"]["title"] == "Line"
    approved = (await client.post("/trace/studio/review/lines/approve", headers=admin)).json()
    assert approved["publishedRev"] == 1 and approved["reviewState"] is None
    assert [c["id"] for c in (await client.get("/trace/collections", headers=anyone)).json()["collections"]] == ["lines"]


async def test_an_admin_can_send_a_collection_back_with_a_note(client, db):
    ann = await _creator(client, db, "ann@example.com")
    await _ready_collection(client, ann)
    await client.post("/trace/studio/collections/lines/publish", headers=ann)
    admin = await _login(client, db, "admin@example.com", platform_role="admin")
    sent_back = (await client.post("/trace/studio/review/lines/reject", json={"note": "Stroke 1 goes the wrong way"}, headers=admin)).json()
    assert sent_back["reviewState"] == "rejected"
    mine = (await client.get("/trace/studio/collections", headers=ann)).json()["collections"][0]
    assert mine["reviewNote"] == "Stroke 1 goes the wrong way"


def test_trace_progress_merges_item_by_item():
    from app.services.sync import merge_trace_progress

    tablet = {"a": {"status": "canDo", "updatedAt": 10}, "b": {"status": "learning", "updatedAt": 5}}
    phone = {
        "b": {"status": "canDo", "updatedAt": 9},
        "a": {"status": "learning", "updatedAt": 3},
        "c": {"status": "learning", "updatedAt": 1},
    }
    merged = merge_trace_progress(tablet, phone)
    assert merged["a"]["status"] == "canDo"  # the tablet's is newer
    assert merged["b"]["status"] == "canDo"  # the phone's is newer
    assert "c" in merged


async def test_a_parent_reads_a_childs_writing_with_titles_and_the_common_mistake(client, db, signup_body):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await _ready_collection(client, dev)
    await client.post("/trace/studio/collections/lines/publish", headers=dev)

    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    family_id = (await db.memberships.find_one({}, sort=[("_id", -1)]))["familyId"]
    await db.docs.insert_one(
        {
            "familyId": family_id,
            "kind": "traceProgress",
            "key": "kid-1",
            "learnerId": "kid-1",
            "rev": 1,
            "body": {
                "line-1": {"status": "canDo", "step": "guided", "attempts": 6, "faults": {"start": 3, "direction": 1}, "updatedAt": 5}
            },
        }
    )
    rows = (await client.get("/trace/learners/kid-1", headers=parent)).json()["items"]
    assert rows == [
        {
            "itemId": "line-1",
            "title": "Line",
            "collection": "Lines",
            "kind": "line",
            "status": "canDo",
            "step": "guided",
            "dueAt": None,
            "attempts": 6,
            "topFault": "start",
            "updatedAt": 5,
        }
    ]
    stats = (await client.get("/trace/studio/stats", headers=dev)).json()
    assert stats["line-1"] == {"learners": 1, "canDo": 1, "attempts": 6, "topFault": "start"}


async def test_ai_strokes_are_for_admins_and_paid_creators(client, db):
    admin = await _login(client, db, "admin@example.com", platform_role="admin")
    assert (await client.get("/trace/studio/ai", headers=admin)).json() == {"allowed": True}
    ann = await _creator(client, db, "ann@example.com")
    assert (await client.get("/trace/studio/ai", headers=ann)).json() == {"allowed": False, "reason": "plan_required"}


async def test_a_creator_records_an_item_aloud_without_being_a_library_author(client, db, tmp_path, monkeypatch):
    from app import audio_store
    from app.settings import settings

    monkeypatch.setattr(settings(), "library_audio_dir", str(tmp_path / "library-audio"))
    monkeypatch.setattr(settings(), "library_audio_bucket", None)
    monkeypatch.setattr(audio_store, "_encode_m4a", lambda data, _mime: b"test-m4a:" + data)
    ann = await _creator(client, db, "ann@example.com")
    wav = base64.b64encode(b"RIFF" + b"\x00" * 40 + b"sound").decode()

    assert (await client.post("/library/audio", json={"mime": "audio/wav", "data": wav}, headers=ann)).status_code == 403
    saved = await client.post("/trace/studio/audio", json={"mime": "audio/wav", "data": wav}, headers=ann)
    assert saved.status_code == 200
    clip = saved.json()["id"]
    assert (await client.get(f"/library/audio/{clip}", headers=ann)).status_code == 200

    # The clip rides on the item; anything that is not a clip id stops publishing.
    assert "recording" not in " ".join(item_problems({**LINE, "voice": clip}, PLAN, PASSED))
    assert any("recording" in p for p in item_problems({**LINE, "voice": "x"}, PLAN, PASSED))
    assert not item_problems({**LINE, "voice": clip, "voiceText": "ក — ក្អែក"}, PLAN, PASSED)
    assert any("200 characters" in p for p in item_problems({**LINE, "voiceText": "ក" * 201}, PLAN, PASSED))


async def test_a_creator_uploads_a_cover_photo_without_being_a_library_author(client, db):
    ann = await _creator(client, db, "ann@example.com")
    png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 64).decode()

    assert (await client.post("/library/images", json={"mime": "image/png", "data": png}, headers=ann)).status_code == 403
    saved = await client.post("/trace/studio/images", json={"mime": "image/png", "data": png}, headers=ann)
    assert saved.status_code == 200
    assert (await client.get(f"/library/images/{saved.json()['id']}", headers=ann)).status_code == 200
    # Not a photo at all: refused here as it is in the library.
    fake = base64.b64encode(b"not a picture").decode()
    assert (await client.post("/trace/studio/images", json={"mime": "image/png", "data": fake}, headers=ann)).status_code == 415


async def test_a_collection_says_who_it_is_for_before_it_is_published(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    url = "/trace/studio/collections/lines"

    # Saved without ages, it is a draft that cannot go out, and the check says why.
    saved = await client.put(url, json={"title": "Lines", "itemIds": ["line-1"]}, headers=dev)
    assert saved.json()["ages"] is None
    problems = (await client.post(f"{url}/check", headers=dev)).json()["problems"]
    assert any("grades" in p for pr in problems for p in pr["problems"])
    assert (await client.post(f"{url}/publish", headers=dev)).status_code == 422

    # A malformed range is refused outright.
    assert (await client.put(url, json={"title": "Lines", "itemIds": ["line-1"], "ages": [9, 6]}, headers=dev)).status_code == 400

    # With ages it publishes, and the shelf and the bundle carry them.
    await client.put(url, json={"title": "Lines", "itemIds": ["line-1"], "ages": [6, 8]}, headers=dev)
    assert (await client.post(f"{url}/publish", headers=dev)).status_code == 200
    assert (await client.get("/trace/collections", headers=dev)).json()["collections"][0]["ages"] == [6, 8]
    assert (await client.get("/trace/collections/lines", headers=dev)).json()["ages"] == [6, 8]


async def test_a_collection_s_topics_come_from_the_shared_list_and_are_published(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    url = "/trace/studio/collections/lines"

    body = {"title": "Lines", "itemIds": ["line-1"], "ages": [6, 8], "topics": ["shapes", "drawing"]}
    saved = await client.put(url, json=body, headers=dev)
    assert saved.json()["topics"] == ["shapes", "drawing"]
    assert (await client.put(url, json={"title": "Lines", "itemIds": ["line-1"], "topics": ["dragons"]}, headers=dev)).status_code == 400

    await client.put(url, json={"title": "Lines", "itemIds": ["line-1"], "ages": [6, 8], "topics": ["shapes"]}, headers=dev)
    await client.post(f"{url}/publish", headers=dev)
    assert (await client.get("/trace/collections", headers=dev)).json()["collections"][0]["topics"] == ["shapes"]
    assert (await client.get("/trace/collections/lines", headers=dev)).json()["topics"] == ["shapes"]


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40


def _painting(png: bytes = PNG, at: int = 1000, accuracy: int = 90) -> dict:
    return {"image": base64.b64encode(png).decode(), "title": "Carrot", "accuracy": accuracy, "stars": 3, "paintedAt": at}


async def test_a_childs_painting_is_kept_one_per_picture_and_only_for_the_family(client, db, signup_body, tmp_path, monkeypatch):
    from app.settings import settings

    monkeypatch.setattr(settings(), "trace_paintings_dir", str(tmp_path / "paintings"))
    monkeypatch.setattr(settings(), "library_audio_bucket", None)
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    kid = (await client.post("/learners", headers=parent, json={"displayName": "Dara"})).json()["id"]

    saved = await client.put(f"/trace/paintings/{kid}/carrot-1", headers=parent, json=_painting())
    assert saved.status_code == 200
    rows = (await client.get(f"/trace/paintings/{kid}", headers=parent)).json()["paintings"]
    assert [(r["itemId"], r["accuracy"]) for r in rows] == [("carrot-1", 90)]
    image = await client.get(f"/trace/paintings/{kid}/carrot-1/image", headers=parent)
    assert image.status_code == 200 and image.content == PNG and image.headers["content-type"] == "image/png"

    # A newer painting of the same picture replaces it, and its old file goes.
    newer = PNG + b"newer"
    await client.put(f"/trace/paintings/{kid}/carrot-1", headers=parent, json=_painting(newer, at=2000, accuracy=95))
    assert (await client.get(f"/trace/paintings/{kid}/carrot-1/image", headers=parent)).content == newer
    assert len(list((tmp_path / "paintings").rglob("*.png"))) == 1
    # An older one arriving late (a tablet that was offline) does not.
    late = await client.put(f"/trace/paintings/{kid}/carrot-1", headers=parent, json=_painting(PNG + b"old", at=1500))
    assert late.json()["accuracy"] == 95

    # Only a PNG, and only this family's children.
    assert (await client.put(f"/trace/paintings/{kid}/carrot-1", headers=parent, json=_painting(b"GIF89a", at=3000))).status_code == 415
    assert (await client.put("/trace/paintings/someone-else/carrot-1", headers=parent, json=_painting(at=3000))).status_code == 404
    other = (await client.post("/auth/signup", json=signup_body("other@example.com"))).json()
    stranger = {"Authorization": f"Bearer {other['accessToken']}"}
    assert (await client.get(f"/trace/paintings/{kid}/carrot-1/image", headers=stranger)).status_code == 404

    assert (await client.delete(f"/trace/paintings/{kid}/carrot-1", headers=parent)).status_code == 204
    assert (await client.get(f"/trace/paintings/{kid}", headers=parent)).json()["paintings"] == []
    assert list((tmp_path / "paintings").rglob("*.png")) == []
