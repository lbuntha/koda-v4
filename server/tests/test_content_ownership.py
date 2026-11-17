"""Studio content belongs to whoever made it; the admin role sees everyone's."""

from tests.test_library import MARKET, RAINY, _draft, _login


async def test_a_creator_sees_only_their_own_books_and_the_admin_sees_all(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")

    assert (await client.put("/library/drafts/ana-book", json=_draft(MARKET), headers=ana)).status_code == 200
    assert (await client.put("/library/drafts/ben-book", json=_draft(RAINY), headers=ben)).status_code == 200

    listed = lambda r: sorted(b["id"] for b in r.json()["books"])  # noqa: E731
    assert listed(await client.get("/library/drafts", headers=ana)) == ["ana-book"]
    assert listed(await client.get("/library/drafts", headers=ben)) == ["ben-book"]
    assert listed(await client.get("/library/drafts", headers=boss)) == ["ana-book", "ben-book"]


async def test_someone_elses_book_looks_missing_and_cannot_be_changed(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    await client.put("/library/drafts/ana-book", json=_draft(MARKET), headers=ana)

    assert (await client.get("/library/drafts/ana-book", headers=ben)).status_code == 404
    assert (await client.post("/library/drafts/ana-book/publish", headers=ben)).status_code == 404
    assert (await client.post("/library/drafts/ana-book/unpublish", headers=ben)).status_code == 404
    assert (await client.delete("/library/drafts/ana-book", headers=ben)).status_code == 404
    taken = await client.put("/library/drafts/ana-book", json=_draft(RAINY), headers=ben)
    assert taken.status_code == 409 and taken.json()["error"]["code"] == "book_id_taken"
    assert (await db.library_books.find_one({"id": "ana-book"}))["draft"]["title"] == MARKET["title"]


async def test_the_admin_edits_a_creators_book_without_taking_it_over(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")
    await client.put("/library/drafts/ana-book", json=_draft(MARKET), headers=ana)
    owner = (await db.library_books.find_one({"id": "ana-book"}))["ownerId"]

    assert (await client.put("/library/drafts/ana-book", json=_draft(RAINY), headers=boss)).status_code == 200
    assert (await db.library_books.find_one({"id": "ana-book"}))["ownerId"] == owner
    assert [b["id"] for b in (await client.get("/library/drafts", headers=ana)).json()["books"]] == ["ana-book"]


async def test_books_from_before_owners_belong_to_the_admin(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")
    await client.put("/library/drafts/old-book", json=_draft(MARKET), headers=boss)
    await db.library_books.update_one({"id": "old-book"}, {"$unset": {"ownerId": ""}})

    assert (await client.get("/library/drafts", headers=ana)).json()["books"] == []
    assert (await client.get("/library/drafts/old-book", headers=ana)).status_code == 404
    assert (await client.get("/library/drafts/old-book", headers=boss)).status_code == 200


async def test_a_creator_cannot_reach_users_or_cleanup(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    assert (await client.get("/admin/users", headers=ana)).status_code == 403
    assert (await client.get("/admin/cleanup/summary", headers=ana)).status_code == 403


async def test_trace_creators_see_only_their_own_items_and_the_admin_sees_all(client, db):
    from tests.test_trace import LINE, PASSED, PLAN

    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")
    body = {"item": LINE, "plan": PLAN, "tests": PASSED}
    assert (await client.put("/trace/studio/items/ana-line", json=body, headers=ana)).status_code == 200
    assert (await client.put("/trace/studio/items/ben-line", json=body, headers=ben)).status_code == 200

    ids = lambda r: sorted(i["id"] for i in r.json()["items"])  # noqa: E731
    assert ids(await client.get("/trace/studio/items", headers=ana)) == ["ana-line"]
    assert ids(await client.get("/trace/studio/items", headers=boss)) == ["ana-line", "ben-line"]
    assert (await client.delete("/trace/studio/items/ana-line", headers=ben)).status_code in (403, 404)
    assert (await db.trace_items.find_one({"_id": "ana-line"}) or await db.trace_items.find_one({"id": "ana-line"})) is not None


async def test_rebus_creators_work_on_their_own_quizzes_and_cannot_publish_for_everyone(client, db):
    from app.repos import rebus as rebus_repo
    from tests.test_rebus_categories import SEED, puzzle

    await rebus_repo.ensure_seed(db, SEED)
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")

    made = await client.post("/rebus/studio/puzzles", json=puzzle("food", answer="Cheese pie ana"), headers=ana)
    assert made.status_code == 201, made.text
    pid = made.json()["id"]

    mine = (await client.get("/rebus/studio/puzzles?limit=100", headers=ana)).json()
    assert [r["id"] for r in mine["puzzles"]] == [pid] and mine["total"] == 1
    assert (await client.get("/rebus/studio/puzzles", headers=ben)).json()["total"] == 0
    assert (await client.get("/rebus/studio/puzzles", headers=boss)).json()["total"] > 1

    assert (await client.get(f"/rebus/studio/puzzles/{pid}", headers=ben)).status_code == 404
    assert (await client.patch(f"/rebus/studio/puzzles/{pid}", json={"explanation": "x"}, headers=ben)).status_code == 404
    assert (await client.delete(f"/rebus/studio/puzzles/{pid}", headers=ben)).status_code == 404
    assert (await client.get(f"/rebus/studio/puzzles/{pid}", headers=boss)).status_code == 200

    # Ana's first screen counts her own quizzes only, not the whole game.
    counts = (await client.get("/rebus/studio/overview", headers=ana)).json()["byStatus"]
    assert sum(counts.values()) == 1 and counts["draft"] == 1
    assert sum((await client.get("/rebus/studio/overview", headers=boss)).json()["byStatus"].values()) > 1

    assert (await client.post("/rebus/studio/publish", json={}, headers=ana)).status_code == 403
    assert (await client.post("/rebus/studio/categories/reorder", json={"order": []}, headers=ana)).status_code == 403


SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'


async def test_art_is_shared_to_draw_with_but_only_its_owner_changes_it(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")

    assert (await client.put("/art/ana-sun", json={"markup": SVG}, headers=ana)).status_code == 200
    assert "ana-sun" in [a["id"] for a in (await client.get("/art", headers=ben)).json()["assets"]]

    refused = await client.put("/art/ana-sun", json={"markup": SVG}, headers=ben)
    assert refused.status_code == 403 and refused.json()["error"]["code"] == "art_not_yours"
    assert (await client.patch("/art/ana-sun", json={"toId": "ben-sun"}, headers=ben)).status_code == 403
    assert (await client.delete("/art/ana-sun", headers=ben)).status_code == 403

    assert (await client.patch("/art/ana-sun", json={"toId": "ana-sun-2"}, headers=ana)).status_code == 200
    assert (await db.art_assets.find_one({"id": "ana-sun-2"}))["ownerId"] == (
        await db.users.find_one({"email": "ana@example.com"})
    )["_id"]
    assert (await client.delete("/art/ana-sun-2", headers=boss)).status_code == 204


async def test_only_the_admin_publishes_skills(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    refused = await client.patch("/skills/anything/publication", json={"status": "published"}, headers=ana)
    assert refused.status_code == 403


async def _id(db, email):
    return (await db.users.find_one({"email": email}))["_id"]


async def test_the_admin_sees_who_owns_what_and_moves_it(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")
    await _login(client, db, "ben@example.com", platform_role="creator")
    await client.put("/library/drafts/ana-1", json=_draft(MARKET), headers=ana)
    await client.put("/library/drafts/ana-2", json=_draft(RAINY), headers=ana)
    await client.put("/art/ana-sun", json={"markup": SVG}, headers=ana)

    assert (await client.get("/admin/content/owners", headers=ana)).status_code == 403
    owners = (await client.get("/admin/content/owners", headers=boss)).json()["owners"]
    by_email = {o["email"]: o for o in owners}
    assert by_email["ana@example.com"]["counts"] == {"book": 2, "art": 1}
    assert by_email["ben@example.com"]["counts"] == {}

    ana_id, ben_id = await _id(db, "ana@example.com"), await _id(db, "ben@example.com")
    one = await client.post("/admin/content/reassign", json={"kind": "book", "ids": ["ana-1"], "to": ben_id}, headers=boss)
    assert one.json()["moved"] == {"book": 1}
    rest = await client.post("/admin/content/reassign", json={"kind": "all", "from": ana_id, "to": ben_id}, headers=boss)
    assert rest.json()["moved"] == {"book": 1, "art": 1}
    assert (await client.get("/library/drafts", headers=ana)).json()["books"] == []

    listed = (await client.get(f"/library/drafts?owner={ben_id}", headers=boss)).json()["books"]
    assert sorted(b["id"] for b in listed) == ["ana-1", "ana-2"] and listed[0]["ownerName"] == "ben@example.com"


async def test_the_art_list_says_which_drawings_the_caller_may_change(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    await client.put("/art/ana-sun", json={"markup": SVG}, headers=ana)
    flag = lambda r: {a["id"]: a["editable"] for a in r.json()["assets"]}["ana-sun"]  # noqa: E731
    assert flag(await client.get("/art", headers=ana)) is True
    assert flag(await client.get("/art", headers=ben)) is False


async def test_a_creator_cannot_change_what_every_family_gets(client, db):
    """Skills, subjects and the app's wording are the admin's; a Content creator is refused on the server."""
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="core")

    assert (await client.patch("/system/subjects", json={}, headers=ana)).status_code == 403
    assert (await client.put("/translations/km/nav.home", json={"text": "x"}, headers=ana)).status_code == 403
    assert (await client.delete("/translations/km/nav.home", headers=ana)).status_code == 403
    assert (await client.get("/admin/content/owners", headers=ana)).status_code == 403
    assert (await client.post("/admin/content/reassign", json={"kind": "all", "from": "x", "to": "y"}, headers=ana)).status_code == 403
    assert (await client.put("/translations/km/nav.home", json={"text": "x"}, headers=boss)).status_code != 403

    # The sidebar matches: a creator is offered their Studios, never the admin pages.
    from app.menu_defaults import DEFAULT_MENU
    from app.repos import menu as menu_repo

    for row in DEFAULT_MENU:
        await menu_repo.seed_default(db, row)
    items = {i["id"] for i in (await client.get("/menu", headers=ana)).json()["items"]}
    assert {"library-studio", "rebus-studio", "assets"} <= items
    assert not items & {"skills", "subjects", "translations", "users", "roles", "admin", "cleanup", "menu"}


def test_no_family_role_holds_a_staff_right():
    from app.security.policy import ROLE_PERMISSIONS, STAFF_ONLY

    for role, held in ROLE_PERMISSIONS.items():
        assert not held & STAFF_ONLY, (role, held & STAFF_ONLY)


async def test_a_parent_cannot_reach_content_owners(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    assert (await client.get("/admin/content/owners", headers=parent)).status_code == 403
    assert (await client.post("/admin/content/reassign", json={"kind": "all", "from": "x", "to": "y"}, headers=parent)).status_code == 403


async def test_only_the_koda_owner_sees_everyones_books(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ops = await _login(client, db, "ops@example.com", platform_role="admin")
    core = await _login(client, db, "core@example.com", platform_role="core")
    await client.put("/library/drafts/ana-1", json=_draft(MARKET), headers=ana)
    await client.put("/library/drafts/ops-1", json=_draft(RAINY), headers=ops)
    ids = lambda r: sorted(b["id"] for b in r.json()["books"])  # noqa: E731
    assert ids(await client.get("/library/drafts", headers=ops)) == ["ops-1"]
    assert ids(await client.get("/library/drafts", headers=core)) == ["ana-1", "ops-1"]
    assert (await client.get("/admin/content/owners", headers=ops)).status_code == 403


async def test_an_admin_cannot_take_over_the_owner(client, db):
    ops = await _login(client, db, "ops@example.com", platform_role="admin")
    core = await _login(client, db, "core@example.com", platform_role="core")
    ops_id, core_id = await _id(db, "ops@example.com"), await _id(db, "core@example.com")

    def refused(r):
        return r.status_code == 403 and r.json()["error"]["code"] == "owner_only"

    assert refused(await client.patch(f"/admin/users/{ops_id}", json={"platformRole": "core"}, headers=ops))
    assert refused(await client.patch(f"/admin/users/{core_id}", json={"status": "suspended"}, headers=ops))
    assert refused(await client.post(f"/admin/users/{core_id}/password", json={"password": "a new long password"}, headers=ops))
    assert refused(await client.delete(f"/admin/users/{core_id}", headers=ops))
    made = await client.post("/admin/roles", json={"name": "Sneaky", "permissions": ["content:all"]}, headers=ops)
    assert refused(made)
    # The owner may make another owner.
    assert (await client.patch(f"/admin/users/{ops_id}", json={"platformRole": "core"}, headers=core)).status_code == 200
