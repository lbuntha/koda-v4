"""Koda Trace: who may make collections, the publish gate, and what children download."""

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
    col = await client.put("/trace/studio/collections/lines", json={"title": "Lines", "itemIds": ["line-1"]}, headers=dev)
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
    await client.put("/trace/studio/collections/lines", json={"title": "Lines", "itemIds": ["line-1"]}, headers=dev)
    refused = await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert refused.status_code == 422
    assert "Line" in refused.text
    problems = (await client.post("/trace/studio/collections/lines/check", headers=dev)).json()["problems"]
    assert problems[0]["item"] == "line-1"


async def test_republishing_makes_a_new_revision_and_unpublish_takes_it_off_the_shelf(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    await client.put("/trace/studio/items/line-1", json={"item": LINE, "plan": PLAN, "tests": PASSED}, headers=dev)
    await client.put("/trace/studio/collections/lines", json={"title": "Lines", "itemIds": ["line-1"]}, headers=dev)
    await client.post("/trace/studio/collections/lines/publish", headers=dev)
    again = await client.post("/trace/studio/collections/lines/publish", headers=dev)
    assert again.json()["publishedRev"] == 2
    await client.post("/trace/studio/collections/lines/unpublish", headers=dev)
    assert (await client.get("/trace/collections", headers=dev)).json()["collections"] == []


async def test_ids_and_duplicates_are_refused(client, db):
    dev = await _login(client, db, "dev@example.com", platform_role="developer")
    assert (await client.put("/trace/studio/items/Bad_Id", json={"item": LINE, "plan": PLAN}, headers=dev)).status_code == 422
    dup = await client.put("/trace/studio/collections/c", json={"title": "C", "itemIds": ["a", "a"]}, headers=dev)
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
        "/trace/studio/collections/lines", json={"title": "Lines", "itemIds": ["line-1", "line-2"], "cover": "line-2"}, headers=dev
    )
    assert saved.json()["cover"] == "line-2"
    await client.post("/trace/studio/collections/lines/publish", headers=dev)
    shelf = (await client.get("/trace/collections", headers=dev)).json()["collections"]
    assert shelf[0]["cover"]["title"] == "Second"
    # A cover that is not in the collection is dropped.
    assert (
        await client.put("/trace/studio/collections/lines", json={"title": "Lines", "itemIds": ["line-1"], "cover": "line-2"}, headers=dev)
    ).json()["cover"] is None
