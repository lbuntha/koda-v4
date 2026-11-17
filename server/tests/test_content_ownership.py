"""Studio content belongs to whoever made it; the admin role sees everyone's."""

from tests.test_library import MARKET, RAINY, _draft, _login


async def test_a_creator_sees_only_their_own_books_and_the_admin_sees_all(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="admin")

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
    boss = await _login(client, db, "boss@example.com", platform_role="admin")
    await client.put("/library/drafts/ana-book", json=_draft(MARKET), headers=ana)
    owner = (await db.library_books.find_one({"id": "ana-book"}))["ownerId"]

    assert (await client.put("/library/drafts/ana-book", json=_draft(RAINY), headers=boss)).status_code == 200
    assert (await db.library_books.find_one({"id": "ana-book"}))["ownerId"] == owner
    assert [b["id"] for b in (await client.get("/library/drafts", headers=ana)).json()["books"]] == ["ana-book"]


async def test_books_from_before_owners_belong_to_the_admin(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    boss = await _login(client, db, "boss@example.com", platform_role="admin")
    await client.put("/library/drafts/old-book", json=_draft(MARKET), headers=boss)
    await db.library_books.update_one({"id": "old-book"}, {"$unset": {"ownerId": ""}})

    assert (await client.get("/library/drafts", headers=ana)).json()["books"] == []
    assert (await client.get("/library/drafts/old-book", headers=ana)).status_code == 404
    assert (await client.get("/library/drafts/old-book", headers=boss)).status_code == 200


async def test_a_creator_cannot_reach_users_or_cleanup(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    assert (await client.get("/admin/users", headers=ana)).status_code == 403
    assert (await client.get("/admin/cleanup/summary", headers=ana)).status_code == 403
