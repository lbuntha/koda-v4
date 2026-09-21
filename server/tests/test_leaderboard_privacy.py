"""Phase 1: nobody is published without explicit, eligible consent.

There is deliberately no leaderboard read here yet. These tests pin the
privacy boundary before buddy relationships and weekly scores exist, so later
phases have to build on it rather than inventing a looser one.
"""


def auth(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def parent_and_child(client, signup_body, email: str = "parent@example.com"):
    parent = (await client.post("/auth/signup", json=signup_body(email))).json()
    learner = (
        await client.post(
            "/learners", headers=auth(parent), json={"displayName": "Mia"}
        )
    ).json()
    child = (
        await client.post(f"/auth/switch/{learner['id']}", headers=auth(parent))
    ).json()
    return parent, learner, child


async def test_missing_consent_is_private_and_creates_no_public_state(
    client, db, signup_body
):
    parent, learner, _ = await parent_and_child(client, signup_body)

    response = await client.get(
        f"/leaderboard/privacy/{learner['id']}", headers=auth(parent)
    )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "learnerId": learner["id"],
        "sharingEnabled": False,
        "visibility": "private",
        "nickname": None,
        "consentedAt": None,
        "revokedAt": None,
    }
    assert await db.leaderboard_privacy.count_documents({}) == 0
    # Phase 1 exposes no ranking that could accidentally list a private child.
    assert (await client.get("/leaderboard", headers=auth(parent))).status_code == 404


async def test_parent_must_confirm_and_choose_a_nickname(client, db, signup_body):
    parent, learner, _ = await parent_and_child(client, signup_body)
    path = f"/leaderboard/privacy/{learner['id']}"

    unconfirmed = await client.patch(
        path,
        headers=auth(parent),
        json={"sharingEnabled": True, "nickname": "StarFox"},
    )
    unnamed = await client.patch(
        path,
        headers=auth(parent),
        json={"sharingEnabled": True, "confirmed": True},
    )

    assert unconfirmed.status_code == 422
    assert unnamed.status_code == 422
    assert await db.leaderboard_privacy.count_documents({}) == 0


async def test_parent_opt_in_records_consent_without_exposing_the_actor(
    client, db, signup_body
):
    parent, learner, _ = await parent_and_child(client, signup_body)

    response = await client.patch(
        f"/leaderboard/privacy/{learner['id']}",
        headers=auth(parent),
        json={"sharingEnabled": True, "nickname": "  StarFox  ", "confirmed": True},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sharingEnabled"] is True
    assert body["visibility"] == "buddies"
    assert body["nickname"] == "StarFox"
    assert body["consentedAt"]
    assert "consentedBy" not in body
    assert "familyId" not in body

    row = await db.leaderboard_privacy.find_one({"_id": learner["id"]})
    assert row["sharingEnabled"] is True
    assert row["visibility"] == "buddies"
    assert row["consentedBy"]
    assert row["consentHistory"][-1]["action"] == "enabled"
    assert row["consentHistory"][-1]["actorRole"] == "owner"


async def test_managed_child_cannot_consent_for_themselves(client, db, signup_body):
    _, learner, child = await parent_and_child(client, signup_body)

    response = await client.patch(
        f"/leaderboard/privacy/{learner['id']}",
        headers=auth(child),
        json={"sharingEnabled": True, "nickname": "StarFox", "confirmed": True},
    )

    assert response.status_code == 403
    assert await db.leaderboard_privacy.count_documents({}) == 0
    assert "leaderboard:consent" not in child["permissions"]


async def test_self_managed_student_can_consent_only_for_themselves(
    client, signup_body
):
    student = (
        await client.post(
            "/auth/signup",
            json={**signup_body("solo@example.com"), "accountType": "student"},
        )
    ).json()
    me = (await client.get("/auth/me", headers=auth(student))).json()

    own = await client.patch(
        f"/leaderboard/privacy/{me['learnerId']}",
        headers=auth(student),
        json={"sharingEnabled": True, "nickname": "MathMango", "confirmed": True},
    )
    invented = await client.patch(
        "/leaderboard/privacy/l_somebody_else",
        headers=auth(student),
        json={"sharingEnabled": True, "nickname": "Nope", "confirmed": True},
    )

    assert own.status_code == 200, own.text
    assert own.json()["sharingEnabled"] is True
    assert invented.status_code == 404
    assert "leaderboard:consent" in student["permissions"]


async def test_one_family_cannot_read_or_change_another_family_choice(
    client, db, signup_body
):
    first, learner, _ = await parent_and_child(client, signup_body, "first@example.com")
    second = (
        await client.post("/auth/signup", json=signup_body("second@example.com"))
    ).json()
    path = f"/leaderboard/privacy/{learner['id']}"

    await client.patch(
        path,
        headers=auth(first),
        json={"sharingEnabled": True, "nickname": "BlueComet", "confirmed": True},
    )
    read = await client.get(path, headers=auth(second))
    write = await client.patch(
        path,
        headers=auth(second),
        json={"sharingEnabled": False},
    )

    assert read.status_code == 404
    assert write.status_code == 404
    row = await db.leaderboard_privacy.find_one({"_id": learner["id"]})
    assert row["sharingEnabled"] is True
    assert row["nickname"] == "BlueComet"


async def test_stopping_sharing_is_immediate_and_audited(client, db, signup_body):
    parent, learner, _ = await parent_and_child(client, signup_body)
    path = f"/leaderboard/privacy/{learner['id']}"
    await client.patch(
        path,
        headers=auth(parent),
        json={"sharingEnabled": True, "nickname": "SunnyOtter", "confirmed": True},
    )

    stopped = await client.patch(
        path, headers=auth(parent), json={"sharingEnabled": False}
    )

    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["sharingEnabled"] is False
    assert stopped.json()["revokedAt"]
    row = await db.leaderboard_privacy.find_one({"_id": learner["id"]})
    assert row["sharingEnabled"] is False
    assert [event["action"] for event in row["consentHistory"]] == [
        "enabled",
        "disabled",
    ]


async def test_nickname_cannot_be_an_email_address(client, db, signup_body):
    parent, learner, _ = await parent_and_child(client, signup_body)
    response = await client.patch(
        f"/leaderboard/privacy/{learner['id']}",
        headers=auth(parent),
        json={
            "sharingEnabled": True,
            "nickname": "mia@example.com",
            "confirmed": True,
        },
    )
    assert response.status_code == 422
    assert await db.leaderboard_privacy.count_documents({}) == 0


async def test_removing_a_learner_removes_their_consent_record(
    client, db, signup_body
):
    parent, learner, _ = await parent_and_child(client, signup_body)
    await client.patch(
        f"/leaderboard/privacy/{learner['id']}",
        headers=auth(parent),
        json={"sharingEnabled": True, "nickname": "StarFox", "confirmed": True},
    )

    deleted = await client.delete(f"/learners/{learner['id']}", headers=auth(parent))

    assert deleted.status_code == 204
    assert await db.leaderboard_privacy.find_one({"_id": learner["id"]}) is None


async def test_privacy_routes_require_a_session(client):
    assert (await client.get("/leaderboard/privacy/l_anything")).status_code == 401
