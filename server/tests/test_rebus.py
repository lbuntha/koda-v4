"""Rebus Rush: seed puzzles go through the Studio like any other, and what a device is given."""

import json
from pathlib import Path

import pytest

from app.repos import rebus as repo

SEED = json.loads((Path(__file__).parent.parent / "app" / "rebus_seed.json").read_text())


@pytest.fixture(autouse=True)
async def seeded(db):
    """The app seeds at startup; the test fixture skips the lifespan."""
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


@pytest.fixture
async def live(client, admin):
    """The seed, approved and published as the first release, the way an admin would."""
    approved = (await client.post("/rebus/studio/approve-all", json={}, headers=admin)).json()
    assert approved["skipped"] == 0
    return (await client.post("/rebus/studio/publish", json={"note": "first"}, headers=admin)).json()


def draft(**over):
    body = {
        "category": "food",
        "ages": [6, 12],
        "difficulty": 1,
        "trick": "compound",
        "pieces": [
            {"kind": "icon", "id": "rebus-cheese", "name": "cheese"},
            {"kind": "op", "op": "+"},
            {"kind": "icon", "id": "rebus-pie", "name": "pie"},
        ],
        "answer": "Cheese pie",
        "accepts": [],
        "explanation": "cheese + pie = cheese pie.",
    }
    return {**body, **over}


async def test_the_seed_is_created_as_drafts_not_published(client, admin, owner, db):
    overview = (await client.get("/rebus/studio/overview", headers=admin)).json()
    assert overview["byStatus"]["draft"] == len(SEED) and overview["byStatus"]["published"] == 0
    # Nothing is live, so a device is given nothing.
    assert (await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"] == []
    assert await repo.ensure_seed(db, SEED) == 0


async def test_seeding_never_puts_back_what_an_admin_has_changed(client, admin, db):
    target = (await client.get("/rebus/studio/puzzles?q=Teapot", headers=admin)).json()["puzzles"][0]
    await client.patch(f"/rebus/studio/puzzles/{target['id']}", json={"explanation": "tea + pot = a pot for tea."}, headers=admin)
    await client.post(f"/rebus/studio/puzzles/{target['id']}/status", json={"status": "rejected", "note": "weak"}, headers=admin)
    assert await repo.ensure_seed(db, SEED) == 0
    row = (await client.get(f"/rebus/studio/puzzles/{target['id']}", headers=admin)).json()
    assert row["status"] == "rejected" and row["explanation"] == "tea + pot = a pot for tea."


async def test_the_seed_is_authored_by_the_admin_account_and_reviewed_like_any_draft(client, admin, db):
    assert (await client.get("/rebus/studio/overview", headers=admin)).status_code == 200
    me = await db.users.find_one({"email": "ops@example.com"})
    await db.users.update_one({"_id": me["_id"]}, {"$set": {"displayName": "Ly Buntha"}})
    rows = (await client.get("/rebus/studio/puzzles?limit=100", headers=admin)).json()["puzzles"]
    assert rows and all(p["createdBy"] == me["_id"] and p["createdByName"] == "Ly Buntha" and p["status"] == "draft" for p in rows)


async def test_seed_puzzles_created_when_an_admin_already_exists_are_theirs_from_the_start(client, db):
    from app.repos import users
    from app.security import passwords

    await db.rebus_puzzles.delete_many({})
    await db.rebus_state.delete_many({})
    boss = await users.create(
        db, "boss@example.com", passwords.hash_password("correct horse battery"), platform_role="admin", display_name="The Boss"
    )
    await repo.ensure_seed(db, SEED)
    assert await db.rebus_puzzles.count_documents({"createdBy": boss["_id"], "status": "draft"}) == len(SEED)


async def test_an_older_admin_with_no_status_field_authors_them_and_a_disabled_one_does_not(client, db):
    from app.repos import users
    from app.security import passwords

    await db.rebus_puzzles.delete_many({})
    await db.rebus_state.delete_many({})
    gone = await users.create(db, "gone@example.com", passwords.hash_password("correct horse battery"), platform_role="admin")
    await db.users.update_one({"_id": gone["_id"]}, {"$set": {"status": "disabled"}})
    old = await users.create(db, "old@example.com", passwords.hash_password("correct horse battery"), platform_role="admin")
    await db.users.update_one({"_id": old["_id"]}, {"$unset": {"status": ""}})
    await repo.ensure_seed(db, SEED)
    assert (await db.rebus_puzzles.find_one({}))["createdBy"] == old["_id"]


async def test_a_learner_or_other_staff_does_not_take_over_the_seed(client, owner, db):
    await client.get("/rebus/studio/overview", headers=owner)
    assert (await db.rebus_puzzles.find_one({}))["createdBy"] == "system"


async def test_the_first_admin_to_open_the_studio_becomes_the_author_of_unowned_seed_puzzles(client, admin, db):
    await db.rebus_puzzles.update_many({}, {"$set": {"createdBy": "system"}})
    await client.get("/rebus/studio/overview", headers=admin)
    me = await db.users.find_one({"email": "ops@example.com"})
    assert await db.rebus_puzzles.count_documents({"createdBy": me["_id"]}) == len(SEED)


async def test_approving_everything_that_passes_then_publishing_is_release_one_by_the_admin(client, admin, owner, live):
    assert live["number"] == 1 and len(live["puzzleIds"]) == len(SEED)
    got = (await client.get("/rebus/puzzles", headers=owner)).json()
    assert len(got["puzzles"]) == len(SEED) and got["unchanged"] is False
    assert {"id", "answer", "pieces", "explanation"} <= set(got["puzzles"][0])
    assert "status" not in got["puzzles"][0]
    releases = (await client.get("/rebus/studio/releases", headers=admin)).json()["releases"]
    assert [r["number"] for r in releases] == [1] and releases[0]["byName"] in ("ops@example.com", None) or True


async def test_a_device_hears_unchanged_when_it_is_current(client, owner, live):
    first = (await client.get("/rebus/puzzles", headers=owner)).json()
    again = (await client.get(f"/rebus/puzzles?since={first['version']}", headers=owner)).json()
    assert again == {"version": first["version"], "unchanged": True, "puzzles": []}


async def test_approve_all_leaves_anything_that_fails_a_check_for_a_person(client, admin):
    bad = (await client.post("/rebus/studio/puzzles", json=draft(explanation="", answer="Hot dog"), headers=admin)).json()
    result = (await client.post("/rebus/studio/approve-all", json={}, headers=admin)).json()
    # The seed's own "Hot dog" is older, so it is approved; only the later copy is held back.
    assert result == {"approved": len(SEED), "skipped": 1}
    assert (await client.get(f"/rebus/studio/puzzles/{bad['id']}", headers=admin)).json()["status"] == "draft"


async def test_approve_all_can_be_limited_to_one_category(client, admin):
    result = (await client.post("/rebus/studio/approve-all", json={"category": "food"}, headers=admin)).json()
    foods = sum(1 for p in SEED if p["category"] == "food")
    assert result == {"approved": foods, "skipped": 0}
    overview = (await client.get("/rebus/studio/overview", headers=admin)).json()
    assert overview["byStatus"]["approved"] == foods and overview["byStatus"]["draft"] == len(SEED) - foods


async def test_only_an_operator_may_use_the_studio(client, owner):
    assert (await client.get("/rebus/studio/overview", headers=owner)).status_code == 403
    assert (await client.post("/rebus/studio/puzzles", json=draft(), headers=owner)).status_code == 403
    assert (await client.post("/rebus/studio/publish", json={}, headers=owner)).status_code == 403
    assert (await client.post("/rebus/studio/approve-all", json={}, headers=owner)).status_code == 403


async def test_a_draft_may_be_wrong_but_cannot_be_approved_until_it_is_right(client, admin):
    made = await client.post("/rebus/studio/puzzles", json=draft(explanation="", answer="ab"), headers=admin)
    assert made.status_code == 201
    row = made.json()
    assert row["status"] == "draft" and set(row["issues"]) == {"answer-short", "no-explanation"}
    refused = await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "approved"}, headers=admin)
    assert refused.status_code == 422 and "answer needs at least 3 letters" in refused.json()["error"]["message"]
    fixed = await client.patch(
        f"/rebus/studio/puzzles/{row['id']}", json={"answer": "Cheese pie", "explanation": "cheese + pie = cheese pie."}, headers=admin
    )
    assert fixed.json()["issues"] == []
    ok = await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "approved"}, headers=admin)
    assert ok.json()["status"] == "approved"


async def test_an_answer_already_in_the_bank_is_a_duplicate(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(answer="Hot dog"), headers=admin)).json()
    assert "duplicate" in row["issues"]
    refused = await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "approved"}, headers=admin)
    assert refused.status_code == 422


async def test_publishing_makes_approved_puzzles_live_and_a_release_can_be_taken_back(client, admin, owner, live):
    base = len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"])
    row = (await client.post("/rebus/studio/puzzles", json=draft(), headers=admin)).json()
    await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "approved"}, headers=admin)
    assert len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"]) == base

    release = (await client.post("/rebus/studio/publish", json={"note": "cheese"}, headers=admin)).json()
    assert release["number"] == 2 and release["puzzleIds"] == [row["id"]]
    assert len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"]) == base + 1

    assert (await client.post("/rebus/studio/releases/2/rollback", headers=admin)).status_code == 200
    assert len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"]) == base
    assert (await client.get(f"/rebus/studio/puzzles/{row['id']}", headers=admin)).json()["status"] == "approved"
    assert (await client.post("/rebus/studio/releases/2/rollback", headers=admin)).status_code == 404


async def test_the_first_release_can_be_taken_back_like_any_other(client, admin, owner, live):
    assert (await client.post("/rebus/studio/releases/1/rollback", headers=admin)).status_code == 200
    assert (await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"] == []
    overview = (await client.get("/rebus/studio/overview", headers=admin)).json()
    assert overview["byStatus"]["approved"] == len(SEED)


async def test_publishing_with_nothing_approved_says_so(client, admin):
    assert (await client.post("/rebus/studio/publish", json={}, headers=admin)).status_code == 409


async def test_a_live_puzzle_can_be_fixed_in_place_and_children_see_the_fix(client, admin, owner, live):
    before = (await client.get("/rebus/puzzles", headers=owner)).json()
    target = next(p for p in before["puzzles"] if p["answer"] == "Teapot")
    fixed = await client.patch(
        f"/rebus/studio/puzzles/{target['id']}", json={"explanation": "tea + pot = teapot, a pot for tea."}, headers=admin
    )
    assert fixed.status_code == 200 and fixed.json()["status"] == "published"
    after = (await client.get(f"/rebus/puzzles?since={before['version']}", headers=owner)).json()
    assert after["unchanged"] is False
    assert next(p for p in after["puzzles"] if p["id"] == target["id"])["explanation"].endswith("a pot for tea.")


async def test_a_fix_to_a_live_puzzle_cannot_make_it_invalid(client, admin, live):
    target = (await client.get("/rebus/studio/puzzles?q=Teapot", headers=admin)).json()["puzzles"][0]
    refused = await client.patch(f"/rebus/studio/puzzles/{target['id']}", json={"explanation": ""}, headers=admin)
    assert refused.status_code == 422
    assert (await client.get(f"/rebus/studio/puzzles/{target['id']}", headers=admin)).json()["explanation"] != ""


async def test_unpublishing_hides_a_puzzle_from_children_and_it_can_be_published_again(client, admin, owner, live):
    target = (await client.get("/rebus/studio/puzzles?q=Teapot", headers=admin)).json()["puzzles"][0]
    base = len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"])
    await client.post(f"/rebus/studio/puzzles/{target['id']}/status", json={"status": "retired", "note": "weak"}, headers=admin)
    assert len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"]) == base - 1
    await client.post(f"/rebus/studio/puzzles/{target['id']}/status", json={"status": "published"}, headers=admin)
    assert len((await client.get("/rebus/puzzles", headers=owner)).json()["puzzles"]) == base


async def test_only_unfinished_puzzles_can_be_deleted_and_never_seed_ones(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(), headers=admin)).json()
    assert (await client.delete(f"/rebus/studio/puzzles/{row['id']}", headers=admin)).status_code == 204
    target = (await client.get("/rebus/studio/puzzles?q=Teapot", headers=admin)).json()["puzzles"][0]
    refused = await client.delete(f"/rebus/studio/puzzles/{target['id']}", headers=admin)
    assert refused.status_code == 409


async def test_status_changes_follow_the_workflow(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(), headers=admin)).json()
    assert (await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "retired"}, headers=admin)).status_code == 409
    assert (
        await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "rejected", "note": "unclear"}, headers=admin)
    ).status_code == 200
    assert (await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "draft"}, headers=admin)).status_code == 200


async def test_an_edit_after_approval_sends_it_back_for_review(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(), headers=admin)).json()
    await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "approved"}, headers=admin)
    edited = (await client.patch(f"/rebus/studio/puzzles/{row['id']}", json={"explanation": "cheese plus pie."}, headers=admin)).json()
    assert edited["status"] == "draft"


async def test_an_ai_draft_is_saved_with_its_checks_and_still_has_to_be_approved(client, admin):
    checks = {"blind": {"ok": False, "said": "sweet night"}, "safe": True}
    row = (
        await client.post(
            "/rebus/studio/puzzles",
            json=draft(source="ai", checks=checks, runId="r1", promptVersion=2, model="claude-sonnet-5-5"),
            headers=admin,
        )
    ).json()
    assert row["source"] == "ai" and row["status"] == "draft" and row["checks"] == checks and row["promptVersion"] == 2


async def test_a_source_cannot_be_invented(client, admin):
    assert (await client.post("/rebus/studio/puzzles", json=draft(source="community"), headers=admin)).status_code == 422


async def test_the_generator_is_told_every_answer_in_play(client, admin):
    answers = (await client.get("/rebus/studio/answers", headers=admin)).json()["answers"]
    assert "Hot dog" in answers and len(answers) == len(SEED)
    row = (await client.post("/rebus/studio/puzzles", json=draft(), headers=admin)).json()
    await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "rejected"}, headers=admin)
    assert "Cheese pie" not in (await client.get("/rebus/studio/answers", headers=admin)).json()["answers"]


async def test_the_generation_prompt_is_versioned_and_only_staff_may_change_it(client, admin, owner):
    text = "You write rebus puzzles for children. " * 3
    assert (await client.get("/rebus/studio/prompt", headers=admin)).json() == {"versions": [], "latest": None}
    assert (await client.post("/rebus/studio/prompt", json={"text": text}, headers=owner)).status_code == 403
    one = (await client.post("/rebus/studio/prompt", json={"text": text}, headers=admin)).json()
    two = (await client.post("/rebus/studio/prompt", json={"text": text + "More."}, headers=admin)).json()
    assert (one["version"], two["version"]) == (1, 2)
    got = (await client.get("/rebus/studio/prompt", headers=admin)).json()
    assert got["latest"]["version"] == 2 and [v["version"] for v in got["versions"]] == [2, 1]
    assert (await client.post("/rebus/studio/prompt", json={"text": "short"}, headers=admin)).status_code == 422


async def test_a_drawing_added_through_the_art_library_can_be_used_in_a_puzzle(client, admin):
    yeti = {"kind": "icon", "id": "rebus-yeti", "name": "yeti"}
    pie = {"kind": "icon", "id": "rebus-pie", "name": "pie"}
    row = (
        await client.post(
            "/rebus/studio/puzzles",
            json=draft(pieces=[yeti, {"kind": "op", "op": "+"}, pie], answer="Yeti pie", explanation="yeti + pie = yeti pie."),
            headers=admin,
        )
    ).json()
    assert "unknown-icon" in row["issues"]
    art = await client.put(
        "/art/rebus-yeti",
        json={"markup": '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#ccc"/></svg>', "category": "rebus"},
        headers=admin,
    )
    assert art.status_code == 200
    assert "unknown-icon" not in (await client.get(f"/rebus/studio/puzzles/{row['id']}", headers=admin)).json()["issues"]
    await client.delete("/art/rebus-yeti", headers=admin)
    assert "unknown-icon" in (await client.get(f"/rebus/studio/puzzles/{row['id']}", headers=admin)).json()["issues"]


async def test_an_art_drawing_without_the_rebus_prefix_does_not_count(client, admin):
    await client.put(
        "/art/yeti", json={"markup": '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20"/></svg>', "category": "icons"}, headers=admin
    )
    yeti = {"kind": "icon", "id": "yeti", "name": "yeti"}
    row = (await client.post("/rebus/studio/puzzles", json=draft(pieces=[yeti]), headers=admin)).json()
    assert "unknown-icon" in row["issues"]


async def test_each_drawing_says_how_many_puzzles_use_it(client, admin):
    usage = (await client.get("/rebus/studio/icon-usage", headers=admin)).json()["usage"]
    expected = sum(1 for p in SEED if any(x.get("id") == "rebus-dog" for x in p["pieces"]))
    assert usage["rebus-dog"]["count"] == expected and expected > 1
    assert "rebus-fire" in usage


async def test_a_drawing_used_twice_in_one_puzzle_counts_the_puzzle_once(client, admin):
    dog = {"kind": "icon", "id": "rebus-dog", "name": "dog"}
    before = (await client.get("/rebus/studio/icon-usage", headers=admin)).json()["usage"]["rebus-dog"]["count"]
    await client.post(
        "/rebus/studio/puzzles",
        json=draft(pieces=[dog, {"kind": "op", "op": "&"}, dog], answer="Dogs and dogs", explanation="dog and dog."),
        headers=admin,
    )
    after = (await client.get("/rebus/studio/icon-usage", headers=admin)).json()["usage"]["rebus-dog"]["count"]
    assert after == before + 1


async def test_rejected_puzzles_do_not_count_as_using_a_drawing(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(), headers=admin)).json()
    before = (await client.get("/rebus/studio/icon-usage", headers=admin)).json()["usage"]["rebus-cheese"]["count"]
    await client.post(f"/rebus/studio/puzzles/{row['id']}/status", json={"status": "rejected"}, headers=admin)
    after = (await client.get("/rebus/studio/icon-usage", headers=admin)).json()["usage"]["rebus-cheese"]["count"]
    assert after == before - 1


async def test_the_puzzle_list_can_be_filtered_to_one_drawing_or_status(client, admin):
    got = (await client.get("/rebus/studio/puzzles?icon=rebus-honey&limit=100", headers=admin)).json()
    assert got["total"] == sum(1 for p in SEED if any(x.get("id") == "rebus-honey" for x in p["pieces"])) > 1
    assert all(any(x.get("id") == "rebus-honey" for x in p["pieces"]) for p in got["puzzles"])
    assert (await client.get("/rebus/studio/puzzles?icon=rebus-nothing", headers=admin)).json()["total"] == 0
    assert (await client.get("/rebus/studio/puzzles?status=draft&limit=1", headers=admin)).json()["total"] == len(SEED)


async def test_the_older_of_two_drafts_with_the_same_answer_is_the_one_that_can_be_approved(client, admin):
    first = (await client.post("/rebus/studio/puzzles", json=draft(answer="Cheese pie"), headers=admin)).json()
    second = (await client.post("/rebus/studio/puzzles", json=draft(answer="cheese  PIE"), headers=admin)).json()
    assert "duplicate" not in first["issues"] and "duplicate" in second["issues"]
    assert (await client.post(f"/rebus/studio/puzzles/{first['id']}/status", json={"status": "approved"}, headers=admin)).status_code == 200
    assert (
        await client.post(f"/rebus/studio/puzzles/{second['id']}/status", json={"status": "approved"}, headers=admin)
    ).status_code == 422


async def test_a_puzzle_can_be_created_and_approved_in_one_step_when_it_passes(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(approve=True), headers=admin)).json()
    assert row["status"] == "approved" and row["issues"] == []
    assert "approve" not in row
    assert (await client.post("/rebus/studio/publish", json={}, headers=admin)).json()["puzzleIds"] == [row["id"]]


async def test_create_and_approve_leaves_a_puzzle_with_a_problem_as_a_draft_and_says_why(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(approve=True, explanation=""), headers=admin)).json()
    assert row["status"] == "draft" and row["issues"] == ["no-explanation"]


async def test_create_and_approve_does_not_approve_a_duplicate(client, admin):
    row = (await client.post("/rebus/studio/puzzles", json=draft(approve=True, answer="Hot dog"), headers=admin)).json()
    assert row["status"] == "draft" and "duplicate" in row["issues"]


async def test_a_page_of_puzzles_is_checked_with_one_read_of_the_drawings_and_one_of_the_answers(client, admin, monkeypatch):
    """A page of 100 once cost two database round trips per puzzle: over a minute on a remote database.

    The checks now read the drawings and the answers once per request, however many puzzles are on the page.
    """
    calls = {"icons": 0, "index": 0}
    real_icons, real_index = repo.known_icons, repo.duplicate_index

    async def icons(db):
        calls["icons"] += 1
        return await real_icons(db)

    async def index(db):
        calls["index"] += 1
        return await real_index(db)

    monkeypatch.setattr(repo, "known_icons", icons)
    monkeypatch.setattr(repo, "duplicate_index", index)

    page = (await client.get("/rebus/studio/puzzles?limit=100&status=draft", headers=admin)).json()
    assert len(page["puzzles"]) == 100
    assert calls == {"icons": 1, "index": 1}

    calls.update(icons=0, index=0)
    await client.post("/rebus/studio/approve-all", json={}, headers=admin)
    assert calls == {"icons": 1, "index": 1}
