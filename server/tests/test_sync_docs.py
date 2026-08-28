"""Documents both ways: revisions, conflicts, tombstones, and the XP merge."""

from datetime import timedelta

import pytest

from app.models.common import now
from app.plan_defaults import DEFAULT_PLANS
from app.repos import plans as plans_repo
from app.repos import subscriptions as subs_repo


async def _room_for_siblings(db, family_id: str) -> None:
    """Lift the free plan's one-child limit.

    A test about two children has to buy the second one first: the limit is
    enforced where a family grows, which is exactly `POST /learners`.
    """
    for plan in DEFAULT_PLANS:
        await plans_repo.seed_default(db, plan)
    await subs_repo.set_plan(
        db,
        family_id,
        plan_id="family",
        status="active",
        current_period_end=now() + timedelta(days=30),
        actor_id="test",
    )


@pytest.fixture
async def parent(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def second_device(client, signup_body):
    """The same family on another device — a phone beside the tablet."""
    await client.post("/auth/signup", json=signup_body())
    tokens = (
        await client.post(
            "/auth/login", json={"email": "parent@example.com", "password": "correct horse battery"}
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


def mutation(op_id: str, **overrides) -> dict:
    base = {
        "opId": op_id,
        "kind": "skill",
        "key": "counting",
        "body": {"isEnabled": True, "thumbnail": "counting-quest"},
        "baseRev": 0,
    }
    base.update(overrides)
    return base


async def test_a_setting_reaches_the_other_device(client, parent, second_device):
    r = await client.post("/sync/push", json={"mutations": [mutation("op_1")]}, headers=parent)
    assert r.status_code == 200, r.text
    assert r.json()["accepted"] == 1
    assert r.json()["conflicts"] == []

    changes = (await client.get("/sync/changes?since=0", headers=second_device)).json()
    assert len(changes["docs"]) == 1
    doc = changes["docs"][0]
    assert doc["kind"] == "skill"
    assert doc["key"] == "counting"
    assert doc["body"]["thumbnail"] == "counting-quest"
    assert doc["rev"] == 1


async def test_an_edit_against_a_stale_revision_loses_and_is_told_so(client, parent):
    await client.post("/sync/push", json={"mutations": [mutation("op_1")]}, headers=parent)
    await client.post(
        "/sync/push",
        json={"mutations": [mutation("op_2", body={"thumbnail": "apple"}, baseRev=1)]},
        headers=parent,
    )

    # A device that still thinks the document is at rev 1.
    stale = await client.post(
        "/sync/push",
        json={"mutations": [mutation("op_3", body={"thumbnail": "grape"}, baseRev=1)]},
        headers=parent,
    )
    body = stale.json()
    assert body["accepted"] == 0
    assert len(body["conflicts"]) == 1
    assert body["conflicts"][0]["opId"] == "op_3"
    assert body["conflicts"][0]["doc"]["body"]["thumbnail"] == "apple", "the server's copy wins"


async def test_progress_merges_instead_of_clobbering(client, parent):
    """Two devices for one child must never subtract XP from each other."""
    await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_1", kind="progress", key="l_mia", body={"xp": 300, "dailyGoal": 5})
            ]
        },
        headers=parent,
    )

    # A tablet that was offline all day, still holding this morning's numbers.
    stale = await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation(
                    "op_2",
                    kind="progress",
                    key="l_mia",
                    body={"xp": 120, "dailyGoal": 8},
                    baseRev=0,
                )
            ]
        },
        headers=parent,
    )
    assert stale.json()["conflicts"] == [], "progress merges rather than conflicting"

    changes = (await client.get("/sync/changes?since=0", headers=parent)).json()
    body = changes["docs"][0]["body"]
    assert body["xp"] == 300, "the larger XP survives"
    assert body["dailyGoal"] == 8, "a setting that is not a counter takes the later write"


async def test_a_delete_travels_as_a_tombstone(client, parent, second_device):
    await client.post("/sync/push", json={"mutations": [mutation("op_1")]}, headers=parent)
    await client.post(
        "/sync/push",
        json={"mutations": [mutation("op_2", baseRev=1, deleted=True)]},
        headers=parent,
    )

    changes = (await client.get("/sync/changes?since=0", headers=second_device)).json()
    assert changes["docs"][0]["deleted"] is True
    assert changes["docs"][0]["body"] == {}


async def test_a_cursor_only_returns_what_is_new(client, parent):
    first = await client.post("/sync/push", json={"mutations": [mutation("op_1")]}, headers=parent)
    cursor = (await client.get("/sync/changes?since=0", headers=parent)).json()["cursor"]
    assert cursor >= first.json()["cursor"] - 1

    empty = (await client.get(f"/sync/changes?since={cursor}", headers=parent)).json()
    assert empty["docs"] == []

    await client.post(
        "/sync/push",
        json={"mutations": [mutation("op_2", key="addition", baseRev=0)]},
        headers=parent,
    )
    later = (await client.get(f"/sync/changes?since={cursor}", headers=parent)).json()
    assert [d["key"] for d in later["docs"]] == ["addition"]


async def test_one_family_never_sees_another_families_settings(client, signup_body):
    a = (await client.post("/auth/signup", json=signup_body("a@example.com"))).json()
    b = (await client.post("/auth/signup", json=signup_body("b@example.com"))).json()

    await client.post(
        "/sync/push",
        json={"mutations": [mutation("op_1")]},
        headers={"Authorization": f"Bearer {a['accessToken']}"},
    )

    seen = await client.get(
        "/sync/changes?since=0", headers={"Authorization": f"Bearer {b['accessToken']}"}
    )
    assert seen.json()["docs"] == []


async def test_an_unknown_kind_is_refused_rather_than_stored(client, parent):
    r = await client.post(
        "/sync/push", json={"mutations": [mutation("op_1", kind="whatever")]}, headers=parent
    )
    assert r.status_code >= 400


async def test_art_syncs_like_any_other_document(client, parent):
    svg = "<svg viewBox='0 0 10 10'><circle cx='5' cy='5' r='4'/></svg>"
    r = await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_art", kind="art", key="red-apple",
                         body={"markup": svg, "category": "fruits"})
            ]
        },
        headers=parent,
    )
    assert r.status_code == 200
    assert r.json()["accepted"] == 1

    docs = (await client.get("/sync/changes?since=0", headers=parent)).json()["docs"]
    art = [d for d in docs if d["kind"] == "art"][0]
    assert art["key"] == "red-apple"
    assert art["body"]["markup"] == svg


async def test_oversized_art_is_refused_with_a_useful_message(client, parent):
    """A 64 KB ceiling: bigger is usually a bitmap that should not be an SVG."""
    huge = "<svg viewBox='0 0 10 10'>" + ("<path d='M0 0h1v1z'/>" * 4000) + "</svg>"
    r = await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_big", kind="art", key="huge", body={"markup": huge, "category": "x"})
            ]
        },
        headers=parent,
    )
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "art_too_large"
    assert "KB" in r.json()["error"]["message"]


async def test_a_pull_can_ask_for_settings_without_dragging_the_art(client, parent):
    """Art bodies dwarf a settings blob; a device fetching a toggle says so."""
    await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_1"),
                mutation("op_art", kind="art", key="apple",
                         body={"markup": "<svg viewBox='0 0 1 1'/>", "category": "fruits"}),
            ]
        },
        headers=parent,
    )

    everything = (await client.get("/sync/changes?since=0", headers=parent)).json()["docs"]
    assert {d["kind"] for d in everything} == {"skill", "art"}

    settings_only = (
        await client.get("/sync/changes?since=0&kinds=skill,scoring", headers=parent)
    ).json()["docs"]
    assert {d["kind"] for d in settings_only} == {"skill"}


async def test_deleting_art_travels_as_a_tombstone(client, parent, second_device):
    await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_art", kind="art", key="apple",
                         body={"markup": "<svg viewBox='0 0 1 1'/>", "category": "fruits"})
            ]
        },
        headers=parent,
    )
    await client.post(
        "/sync/push",
        json={"mutations": [mutation("op_del", kind="art", key="apple", baseRev=1, deleted=True)]},
        headers=parent,
    )

    docs = (await client.get("/sync/changes?since=0", headers=second_device)).json()["docs"]
    art = [d for d in docs if d["kind"] == "art"][0]
    assert art["deleted"] is True


async def test_the_reward_rules_are_not_family_documents_any_more(client, parent):
    """Scoring, the streak rule and the badges belong to the deployment.

    One operator sets what a star is worth and what a badge takes, and every
    family inherits it — so a family device pushing one is not a permission
    failure, it is a kind the store no longer holds. Refused loudly rather than
    stored quietly, because a row nothing reads back is worse than an error.
    """
    for kind in ("scoring", "streak", "badges"):
        r = await client.post(
            "/sync/push",
            json={"mutations": [mutation(f"op_{kind}", kind=kind, key="default", body={"x": 1})]},
            headers=parent,
        )
        assert r.status_code == 400, r.text
        assert r.json()["error"]["code"] == "unknown_kind"


async def test_a_parent_reads_the_deployment_rules_but_cannot_set_them(
    client, parent, signup_body, db
):
    """Every device needs the rates to score a round, so reading is nobody's secret.

    Writing is `system:write`, which no family role holds and no grant hands
    out — an owner runs their family, an operator runs the service.
    """
    from app.repos import memberships, users
    from app.security import passwords

    readable = await client.get("/defaults", headers=parent)
    assert readable.status_code == 200
    assert "defaults" in readable.json()

    refused = await client.put(
        "/defaults/scoring", json={"value": {"xpPerLevel": 999}}, headers=parent
    )
    assert refused.status_code == 403
    assert "system write" in refused.json()["error"]["message"]

    family = (await client.get("/family/members", headers=parent)).json()["familyId"]
    dad = await users.create(db, "dad@example.com", passwords.hash_password("correct horse battery"))
    await memberships.add(db, dad["_id"], family, role="parent")
    token = (
        await client.post(
            "/auth/login", json={"email": "dad@example.com", "password": "correct horse battery"}
        )
    ).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    allowed = await client.post("/sync/push", json={"mutations": [mutation("op_s3")]}, headers=headers)
    assert allowed.status_code == 200, "skills are still a parent's"
    assert allowed.json()["accepted"] == 1


async def test_a_parent_sets_what_the_child_may_not(client, parent):
    """The rule the `childSettings` kind exists to hold.

    A time cap a child can lift is not a cap. Both halves are checked here:
    the parent writing it, and the child's own device being refused — because
    the child *does* receive the document (it is where the rule is enforced)
    and receiving it must never imply being able to change it.
    """
    mia = (
        await client.post("/learners", headers=parent, json={"displayName": "Mia"})
    ).json()

    settings = {"sessionMinutes": 20, "aiHelpEnabled": False}
    written = await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_1", kind="childSettings", key=mia["id"], learnerId=mia["id"],
                         body=settings)
            ]
        },
        headers=parent,
    )
    assert written.status_code == 200, written.text
    assert written.json()["accepted"] == 1

    # The child's own session: the settings reach the tablet they are enforced on.
    child = (await client.post(f"/auth/switch/{mia['id']}", headers=parent)).json()
    as_child = {"Authorization": f"Bearer {child['accessToken']}"}

    pulled = (await client.get("/sync/changes?since=0", headers=as_child)).json()["docs"]
    theirs = [d for d in pulled if d["kind"] == "childSettings"]
    assert len(theirs) == 1, "a child must receive the rules their device enforces"
    assert theirs[0]["body"] == settings

    # …and cannot lift them.
    refused = await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_2", kind="childSettings", key=mia["id"], learnerId=mia["id"],
                         body={"sessionMinutes": 999}, baseRev=1)
            ]
        },
        headers=as_child,
    )
    assert refused.status_code == 403, refused.text


async def test_a_learner_cannot_write_settings_for_a_sibling(db, client, parent):
    """`learner:update` says a student may set settings; not whose."""
    await _room_for_siblings(db, (await client.get("/auth/me", headers=parent)).json()["familyId"])
    mia = (await client.post("/learners", headers=parent, json={"displayName": "Mia"})).json()
    sam = (await client.post("/learners", headers=parent, json={"displayName": "Sam"})).json()

    child = (await client.post(f"/auth/switch/{mia['id']}", headers=parent)).json()
    # Granted the right a student holds, so the test turns on the *key* rather
    # than on the permission — which is the thing LEARNER_OWNED_KINDS guards.
    await client.get("/auth/me", headers={"Authorization": f"Bearer {child['accessToken']}"})

    refused = await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_1", kind="childSettings", key=sam["id"], learnerId=sam["id"],
                         body={"sessionMinutes": 999})
            ]
        },
        headers={"Authorization": f"Bearer {child['accessToken']}"},
    )
    assert refused.status_code == 403, refused.text


async def test_child_settings_are_one_document_per_child(db, client, parent):
    """Two children, two documents — never one shared blob."""
    await _room_for_siblings(db, (await client.get("/auth/me", headers=parent)).json()["familyId"])
    mia = (await client.post("/learners", headers=parent, json={"displayName": "Mia"})).json()
    sam = (await client.post("/learners", headers=parent, json={"displayName": "Sam"})).json()

    await client.post(
        "/sync/push",
        json={
            "mutations": [
                mutation("op_1", kind="childSettings", key=mia["id"], learnerId=mia["id"],
                         body={"sessionMinutes": 20}),
                mutation("op_2", kind="childSettings", key=sam["id"], learnerId=sam["id"],
                         body={"sessionMinutes": 45}),
            ]
        },
        headers=parent,
    )

    docs = (await client.get("/sync/changes?since=0&kinds=childSettings", headers=parent)).json()
    by_key = {d["key"]: d["body"]["sessionMinutes"] for d in docs["docs"]}
    assert by_key == {mia["id"]: 20, sam["id"]: 45}
