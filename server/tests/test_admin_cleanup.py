"""The Data cleanup page: hard deletes, admin only, and nothing left behind."""

from app.models.common import now
from app.repos import users
from app.security import passwords


async def _staff_auth(client, db, email="admin@example.com", role="admin"):
    await users.create(db, email, passwords.hash_password("admin-pass-123"), platform_role=role)
    signed_in = (
        await client.post("/auth/login", json={"email": email, "password": "admin-pass-123"})
    ).json()
    return {"Authorization": f"Bearer {signed_in['accessToken']}"}


async def _family(client, db, email="parent@example.com"):
    """A signed-up owner with one child, one learning event and one painting."""
    tokens = (
        await client.post(
            "/auth/signup",
            json={"email": email, "password": "correct horse battery", "familyName": "The Riveras"},
        )
    ).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}
    user = await users.by_email(db, email)
    membership = await db.memberships.find_one({"userId": user["_id"]})
    family_id = membership["familyId"]
    child = (await client.post("/learners", json={"displayName": "Mia"}, headers=auth)).json()
    learner_id = child["id"]
    pushed = await client.post(
        "/sync/push",
        headers=auth,
        json={
            "schemaVersion": 1,
            "events": [{
                "id": "e_1", "ts": "2026-08-19T09:00:00.000Z", "type": "answer_submitted",
                "sessionId": "s_1", "learnerId": learner_id, "seq": 1, "skillId": "counting",
                "activityId": "counting-quest", "lessonId": "count-in-a-row",
                "conceptKey": "corresponder", "localDay": "2026-08-19", "correct": True,
                "attempt": 1, "responseMs": 2400, "supportsUsed": 0,
            }],
        },
    )
    assert pushed.status_code == 200, pushed.text
    await db.profile_stats.insert_one({"_id": learner_id, "totalXp": 120})
    await db.trace_paintings.insert_one(
        {"familyId": family_id, "learnerId": learner_id, "itemId": "ka", "imageId": "img_1"}
    )
    return {"auth": auth, "userId": user["_id"], "familyId": family_id, "learnerId": learner_id}


async def test_only_admins_reach_cleanup(client, db, signup_body):
    owner = (await client.post("/auth/signup", json=signup_body())).json()
    owner_auth = {"Authorization": f"Bearer {owner['accessToken']}"}
    developer = await _staff_auth(client, db, "dev@example.com", role="developer")
    for auth in (owner_auth, developer):
        assert (await client.get("/admin/cleanup/summary", headers=auth)).status_code == 403
        r = await client.post("/admin/cleanup/trace/delete", headers=auth, json={"all": True, "confirm": "DELETE"})
        assert r.status_code == 403
    admin = await _staff_auth(client, db)
    assert (await client.get("/admin/cleanup/summary", headers=admin)).status_code == 200


async def test_deleting_an_owner_removes_the_family_and_its_data(client, db):
    admin = await _staff_auth(client, db)
    fam = await _family(client, db)

    preview = (await client.post("/admin/cleanup/users/preview", headers=admin, json={"userIds": [fam["userId"]]})).json()
    owned = preview["users"][0]["ownedFamilies"]
    assert owned[0]["familyId"] == fam["familyId"] and owned[0]["learners"] == 1

    r = await client.post("/admin/cleanup/users/delete", headers=admin, json={"userIds": [fam["userId"]]})
    assert r.status_code == 200, r.text
    assert r.json()["results"][0]["deleted"] is True

    assert await db.users.find_one({"_id": fam["userId"]}) is None
    assert await db.families.find_one({"_id": fam["familyId"]}) is None
    for collection in ("memberships", "learners", "events", "trace_paintings", "devices"):
        assert await db[collection].count_documents({"familyId": fam["familyId"]}) == 0, collection
    assert await db.profile_stats.find_one({"_id": fam["learnerId"]}) is None


async def test_cannot_delete_yourself(client, db):
    admin = await _staff_auth(client, db)
    me = await users.by_email(db, "admin@example.com")
    r = await client.post("/admin/cleanup/users/delete", headers=admin, json={"userIds": [me["_id"]]})
    assert r.json()["results"][0] == {
        "id": me["_id"], "email": "admin@example.com", "deleted": False,
        "error": "You cannot delete the account you are using.", "code": "cannot_delete_self",
    }
    assert await users.by_id(db, me["_id"]) is not None


async def test_clearing_xp_for_one_family_leaves_others_and_bumps_its_generation(client, db):
    admin = await _staff_auth(client, db)
    cleared = await _family(client, db, "one@example.com")
    kept = await _family(client, db, "two@example.com")

    r = await client.post("/admin/cleanup/xp", headers=admin, json={"scope": "users", "userIds": [cleared["userId"]]})
    assert r.status_code == 200, r.text
    assert r.json()["deleted"]["events"] == 1

    assert await db.events.count_documents({"familyId": cleared["familyId"]}) == 0
    assert await db.profile_stats.find_one({"_id": cleared["learnerId"]}) is None
    assert await db.events.count_documents({"familyId": kept["familyId"]}) == 1
    assert await db.profile_stats.find_one({"_id": kept["learnerId"]}) is not None
    # The account and child themselves stay.
    assert await db.learners.count_documents({"familyId": cleared["familyId"]}) == 1

    versions = (await client.get("/system/maintenance/versions", headers=cleared["auth"])).json()
    assert versions["familyId"] == cleared["familyId"]
    assert versions["familyLearningVersion"] == 1
    other = (await client.get("/system/maintenance/versions", headers=kept["auth"])).json()
    assert other["familyLearningVersion"] == 0


async def test_everything_routes_need_the_typed_word(client, db):
    admin = await _staff_auth(client, db)
    for path, body in (
        ("/admin/cleanup/xp", {"scope": "all"}),
        ("/admin/cleanup/trace/delete", {"all": True}),
        ("/admin/cleanup/library/delete", {"all": True}),
    ):
        r = await client.post(path, headers=admin, json={**body, "confirm": "delete please"})
        assert r.status_code == 422, (path, r.text)


async def test_trace_deletes_are_hard_and_take_revisions_and_paintings(client, db):
    admin = await _staff_auth(client, db)
    t = now()
    await db.trace_items.insert_many([
        {"id": "ka", "draft": {"item": {"title": "Ka"}}, "updatedAt": t, "deletedAt": None},
        {"id": "kha", "draft": {"item": {"title": "Kha"}}, "updatedAt": t, "deletedAt": t},
        {"id": "ko", "draft": {"item": {"title": "Ko"}}, "updatedAt": t, "deletedAt": None},
    ])
    await db.trace_collections.insert_one(
        {"id": "first", "draft": {"title": "First", "itemIds": ["ka", "ko"]}, "updatedAt": t, "deletedAt": None, "rev": 1}
    )
    await db.trace_revisions.insert_one({"collectionId": "first", "rev": 1, "bundle": {}})
    await db.trace_paintings.insert_one({"familyId": "f", "learnerId": "l", "itemId": "ka", "imageId": "img_ka"})

    listing = (await client.get("/admin/cleanup/trace", headers=admin)).json()
    assert {row["id"]: row["deleted"] for row in listing["items"]} == {"ka": False, "kha": True, "ko": False}
    assert next(row for row in listing["items"] if row["id"] == "ka")["paintings"] == 1

    r = await client.post("/admin/cleanup/trace/delete", headers=admin, json={"itemIds": ["ka"]})
    assert r.json()["deleted"]["items"] == 1 and r.json()["deleted"]["paintings"] == 1
    assert (await db.trace_collections.find_one({"id": "first"}))["draft"]["itemIds"] == ["ko"]

    r = await client.post("/admin/cleanup/trace/delete", headers=admin, json={"purgeDeleted": True})
    assert r.json()["deleted"]["items"] == 1
    assert await db.trace_items.find_one({"id": "kha"}) is None

    r = await client.post("/admin/cleanup/trace/delete", headers=admin, json={"collectionIds": ["first"]})
    assert r.json()["deleted"] == {"items": 0, "collections": 1, "revisions": 1, "reports": 0, "paintings": 0}

    r = await client.post("/admin/cleanup/trace/delete", headers=admin, json={"all": True, "confirm": "DELETE"})
    assert r.status_code == 200
    assert await db.trace_items.count_documents({}) == 0


async def test_library_deletes_books_with_revisions_and_reports(client, db):
    admin = await _staff_auth(client, db)
    t = now()
    await db.library_books.insert_many([
        {"id": "cat", "draft": {"title": "The Cat"}, "updatedAt": t, "deletedAt": None, "rev": 2},
        {"id": "dog", "draft": {"title": "The Dog"}, "updatedAt": t, "deletedAt": t, "rev": 0},
    ])
    await db.library_revisions.insert_many([{"bookId": "cat", "rev": 1}, {"bookId": "cat", "rev": 2}])
    await db.library_reports.insert_one({"id": "r1", "bookId": "cat", "resolvedAt": None, "createdAt": t})
    await db.library_unit_voices.insert_one({"unit": "ក", "clip": "c"})

    books = (await client.get("/admin/cleanup/library", headers=admin)).json()["books"]
    assert {b["id"]: b["reports"] for b in books} == {"cat": 1, "dog": 0}

    r = await client.post("/admin/cleanup/library/delete", headers=admin, json={"bookIds": ["cat"]})
    assert r.json()["deleted"] == {"books": 1, "revisions": 2, "reports": 1}

    r = await client.post("/admin/cleanup/library/delete", headers=admin, json={"all": True, "confirm": "DELETE"})
    assert r.json()["deleted"]["books"] == 1
    # Recorded unit names are kept unless asked for.
    assert await db.library_unit_voices.count_documents({}) == 1
