async def test_parent_creates_child_and_one_time_join_code(client, db, signup_body):
    parent = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {parent['accessToken']}"}

    created = await client.post(
        "/learners", headers=auth, json={"displayName": "Mia", "birthYear": 2017}
    )
    assert created.status_code == 201
    learner = created.json()
    assert learner["displayName"] == "Mia"

    code = await client.post(f"/learners/{learner['id']}/join-code", headers=auth)
    assert code.status_code == 200
    body = code.json()
    assert len(body["code"]) == 8
    assert body["learner"]["hasActiveCode"] is True

    switched = await client.post(f"/auth/switch/{learner['id']}", headers=auth)
    assert switched.status_code == 200, switched.text
    assert switched.json()["role"] == "child"
    assert switched.json()["permissions"]

    joined = await client.post(
        "/auth/join", json={"code": body["code"], "deviceName": "Mia's tablet"}
    )
    assert joined.status_code == 200, joined.text
    child = joined.json()
    assert child["role"] == "child"
    assert child["familyId"] == parent["familyId"]
    assert child["permissions"]

    me = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {child['accessToken']}"}
    )
    assert me.status_code == 200
    assert me.json()["role"] == "child"
    assert me.json()["learnerId"] == learner["id"]
    assert me.json()["avatarSeed"] == learner["avatarSeed"]

    changed_avatar = await client.patch(
        "/auth/me/avatar",
        headers={"Authorization": f"Bearer {child['accessToken']}"},
        json={"avatarSeed": "a_mias_choice_123"},
    )
    assert changed_avatar.status_code == 200, changed_avatar.text
    saved_learner = await db.learners.find_one({"_id": learner["id"]})
    assert saved_learner["avatarSeed"] == "a_mias_choice_123"

    forbidden_switch = await client.post(
        f"/auth/switch/{learner['id']}",
        headers={"Authorization": f"Bearer {child['accessToken']}"},
    )
    assert forbidden_switch.status_code == 403

    replay = await client.post("/auth/join", json={"code": body["code"]})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "join_code_invalid"


async def test_non_parent_cannot_create_child(client, signup_body):
    student = (
        await client.post(
            "/auth/signup",
            json={**signup_body("student@example.com"), "accountType": "student"},
        )
    ).json()
    response = await client.post(
        "/learners",
        headers={"Authorization": f"Bearer {student['accessToken']}"},
        json={"displayName": "Nope"},
    )
    assert response.status_code == 403


async def test_a_student_is_their_own_learner(client, db, signup_body):
    """The row that makes the role mean anything.

    Without it a student had `learnerId: None`, and everything learner-scoped
    quietly had nowhere to go — progress and the daily goal fell back to a
    per-device id, and `childSettings` could not be written for them at all.
    """
    body = signup_body("solo@example.com")
    body["accountType"] = "student"
    tokens = (await client.post("/auth/signup", json=body)).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    assert tokens["role"] == "student"

    me = (await client.get("/auth/me", headers=auth)).json()
    assert me["learnerId"], "a student with no learner row is a role with nothing behind it"
    assert me["learnerName"] == "Solo"

    # They see themselves, and only themselves.
    listing = (await client.get("/learners", headers=auth)).json()["learners"]
    assert [row["id"] for row in listing] == [me["learnerId"]]

    # And can now hold learner-scoped settings, keyed to that row.
    written = await client.post(
        "/sync/push",
        headers=auth,
        json={
            "mutations": [
                {
                    "opId": "op_1",
                    "kind": "childSettings",
                    "key": me["learnerId"],
                    "learnerId": me["learnerId"],
                    "baseRev": 0,
                    "body": {"goalCadence": "weekly"},
                }
            ]
        },
    )
    assert written.status_code == 200, written.text
    assert written.json()["accepted"] == 1


async def test_a_student_renaming_themselves_does_not_end_up_with_two_names(
    client, db, signup_body
):
    """One person, two rows, one name.

    `/auth/me` reads `displayName` off the user and `learnerName` off the
    learner. A rename that wrote only one of them would leave the answer
    depending on which field a screen happened to read.
    """
    body = signup_body("solo@example.com")
    body["accountType"] = "student"
    tokens = (await client.post("/auth/signup", json=body)).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    renamed = await client.patch("/auth/me", headers=auth, json={"displayName": "Sol"})
    assert renamed.status_code == 200, renamed.text

    me = renamed.json()
    assert me["displayName"] == "Sol"
    assert me["learnerName"] == "Sol"


async def test_a_parent_is_not_made_into_a_learner(client, signup_body):
    """An adult running a household is not somebody's pupil."""
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {tokens['accessToken']}"}

    assert (await client.get("/auth/me", headers=auth)).json()["learnerId"] is None
    assert (await client.get("/learners", headers=auth)).json()["learners"] == []
