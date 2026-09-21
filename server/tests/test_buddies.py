"""Phase 2 buddy connections: mutual, private and non-enumerable."""

import re
from datetime import timedelta

from app.models.common import now
from app.services.codes import hash_buddy_code


def auth(tokens: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def family_with_child(client, signup_body, email: str, name: str):
    parent = (await client.post("/auth/signup", json=signup_body(email))).json()
    learner = (
        await client.post(
            "/learners", headers=auth(parent), json={"displayName": name}
        )
    ).json()
    child = (
        await client.post(f"/auth/switch/{learner['id']}", headers=auth(parent))
    ).json()
    return parent, learner, child


async def two_learners(client, signup_body):
    first = await family_with_child(client, signup_body, "one@example.com", "Mia")
    second = await family_with_child(client, signup_body, "two@example.com", "Sam")
    return first, second


async def connect(client, first, second):
    first_parent, first_learner, _ = first
    second_parent, second_learner, _ = second
    invitation = (
        await client.post(
            f"/leaderboard/buddies/{first_learner['id']}/invites",
            headers=auth(first_parent),
        )
    ).json()
    accepted = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(second_parent),
        json={"learnerId": second_learner["id"], "code": invitation["code"]},
    )
    assert accepted.status_code == 201, accepted.text
    return invitation, accepted.json()


async def test_invite_code_is_short_lived_hashed_and_shown_once(
    client, db, signup_body
):
    parent, learner, _ = await family_with_child(
        client, signup_body, "one@example.com", "Mia"
    )

    created = await client.post(
        f"/leaderboard/buddies/{learner['id']}/invites", headers=auth(parent)
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert re.fullmatch(r"KODA-[A-HJ-NP-Z2-9]{6}", body["code"])

    row = await db.buddy_invites.find_one({"_id": body["id"]})
    assert row["codeHash"] == hash_buddy_code(body["code"])
    assert body["code"] not in str(row)
    assert timedelta(minutes=14) < row["expiresAt"] - row["createdAt"] <= timedelta(minutes=15)

    listing = await client.get(
        f"/leaderboard/buddies/{learner['id']}/invites", headers=auth(parent)
    )
    assert listing.status_code == 200
    listed = listing.json()["invites"]
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]
    assert listed[0]["code"] is None
    # Mongo stores milliseconds; the create response still has Python's
    # remaining microseconds. They name the same expiry.
    assert listed[0]["expiresAt"].split(".")[0] == body["expiresAt"].split(".")[0]


async def test_replacing_a_code_invalidates_the_previous_one(client, signup_body):
    first, second = await two_learners(client, signup_body)
    parent, learner, _ = first
    old = (
        await client.post(
            f"/leaderboard/buddies/{learner['id']}/invites", headers=auth(parent)
        )
    ).json()
    new = (
        await client.post(
            f"/leaderboard/buddies/{learner['id']}/invites", headers=auth(parent)
        )
    ).json()

    rejected = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(second[0]),
        json={"learnerId": second[1]["id"], "code": old["code"]},
    )
    assert old["code"] != new["code"]
    assert rejected.status_code == 401
    assert rejected.json()["error"]["code"] == "buddy_invite_invalid"


async def test_accepting_is_mutual_but_does_not_enable_sharing(
    client, db, signup_body
):
    first, second = await two_learners(client, signup_body)
    invitation, accepted = await connect(client, first, second)

    assert accepted["sharingEnabled"] is False
    assert accepted["nickname"] is None
    assert "learnerId" not in accepted
    assert "familyId" not in accepted
    relation = await db.buddy_relationships.find_one({"_id": accepted["relationshipId"]})
    assert relation["inviteId"] == invitation["id"]
    assert relation["status"] == "accepted"

    for parent, learner, _ in (first, second):
        privacy = (
            await client.get(
                f"/leaderboard/privacy/{learner['id']}", headers=auth(parent)
            )
        ).json()
        assert privacy["sharingEnabled"] is False
        buddies = (
            await client.get(
                f"/leaderboard/buddies/{learner['id']}", headers=auth(parent)
            )
        ).json()["buddies"]
        assert len(buddies) == 1
        assert buddies[0]["sharingEnabled"] is False
        assert buddies[0]["nickname"] is None


async def test_only_opted_in_identity_is_visible_to_an_accepted_buddy(
    client, signup_body
):
    first, second = await two_learners(client, signup_body)
    await connect(client, first, second)
    first_parent, first_learner, _ = first
    second_parent, second_learner, _ = second

    await client.patch(
        f"/leaderboard/privacy/{first_learner['id']}",
        headers=auth(first_parent),
        json={"sharingEnabled": True, "nickname": "StarFox", "confirmed": True},
    )
    seen = (
        await client.get(
            f"/leaderboard/buddies/{second_learner['id']}",
            headers=auth(second_parent),
        )
    ).json()["buddies"][0]

    assert seen["nickname"] == "StarFox"
    assert seen["avatarSeed"] == first_learner["avatarSeed"]
    assert seen["sharingEnabled"] is True
    assert "Mia" not in str(seen)


async def test_a_code_is_one_time_and_cannot_add_a_third_learner(
    client, signup_body
):
    first, second = await two_learners(client, signup_body)
    third = await family_with_child(client, signup_body, "three@example.com", "Lee")
    invitation, _ = await connect(client, first, second)

    replay = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(third[0]),
        json={"learnerId": third[1]["id"], "code": invitation["code"]},
    )
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "buddy_invite_invalid"


async def test_managed_child_cannot_create_accept_remove_or_block(
    client, signup_body
):
    first, second = await two_learners(client, signup_body)
    invitation, relation = await connect(client, first, second)
    _, learner, child = first

    create = await client.post(
        f"/leaderboard/buddies/{learner['id']}/invites", headers=auth(child)
    )
    accept = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(child),
        json={"learnerId": learner["id"], "code": invitation["code"]},
    )
    remove = await client.delete(
        f"/leaderboard/buddies/{learner['id']}/{relation['relationshipId']}",
        headers=auth(child),
    )
    block = await client.post(
        f"/leaderboard/buddies/{learner['id']}/{relation['relationshipId']}/block",
        headers=auth(child),
    )

    assert {create.status_code, accept.status_code, remove.status_code, block.status_code} == {403}
    assert "buddy:manage" not in child["permissions"]


async def test_self_managed_student_can_manage_only_their_own_connections(
    client, signup_body
):
    student = (
        await client.post(
            "/auth/signup",
            json={**signup_body("solo@example.com"), "accountType": "student"},
        )
    ).json()
    me = (await client.get("/auth/me", headers=auth(student))).json()

    own = await client.post(
        f"/leaderboard/buddies/{me['learnerId']}/invites", headers=auth(student)
    )
    invented = await client.post(
        "/leaderboard/buddies/l_somebody_else/invites", headers=auth(student)
    )

    assert own.status_code == 201, own.text
    assert invented.status_code == 404
    assert "buddy:manage" in student["permissions"]


async def test_cross_family_management_is_not_an_identity_oracle(
    client, signup_body
):
    first, second = await two_learners(client, signup_body)
    first_parent, first_learner, _ = first
    second_parent, _, _ = second
    invitation = (
        await client.post(
            f"/leaderboard/buddies/{first_learner['id']}/invites",
            headers=auth(first_parent),
        )
    ).json()

    listing = await client.get(
        f"/leaderboard/buddies/{first_learner['id']}", headers=auth(second_parent)
    )
    revoke = await client.delete(
        f"/leaderboard/buddies/{first_learner['id']}/invites/{invitation['id']}",
        headers=auth(second_parent),
    )

    assert listing.status_code == 404
    assert revoke.status_code == 404


async def test_remove_hides_the_relationship_from_both_sides(client, signup_body):
    first, second = await two_learners(client, signup_body)
    _, relation = await connect(client, first, second)

    removed = await client.delete(
        f"/leaderboard/buddies/{first[1]['id']}/{relation['relationshipId']}",
        headers=auth(first[0]),
    )
    assert removed.status_code == 204
    for parent, learner, _ in (first, second):
        body = (
            await client.get(
                f"/leaderboard/buddies/{learner['id']}", headers=auth(parent)
            )
        ).json()
        assert body == {"buddies": []}


async def test_block_prevents_reconnection_until_unblocked(client, signup_body):
    first, second = await two_learners(client, signup_body)
    _, relation = await connect(client, first, second)
    relationship_id = relation["relationshipId"]

    blocked = await client.post(
        f"/leaderboard/buddies/{first[1]['id']}/{relationship_id}/block",
        headers=auth(first[0]),
    )
    invite = (
        await client.post(
            f"/leaderboard/buddies/{second[1]['id']}/invites",
            headers=auth(second[0]),
        )
    ).json()
    refused = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(first[0]),
        json={"learnerId": first[1]["id"], "code": invite["code"]},
    )

    assert blocked.status_code == 204
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "buddy_unavailable"

    unblocked = await client.delete(
        f"/leaderboard/buddies/{first[1]['id']}/{relationship_id}/block",
        headers=auth(first[0]),
    )
    assert unblocked.status_code == 204
    # Unblocking is not acceptance; both sides remain disconnected until a new code.
    assert (
        await client.get(
            f"/leaderboard/buddies/{first[1]['id']}", headers=auth(first[0])
        )
    ).json() == {"buddies": []}


async def test_expired_and_revoked_codes_are_indistinguishable(
    client, db, signup_body
):
    first, second = await two_learners(client, signup_body)
    invite = (
        await client.post(
            f"/leaderboard/buddies/{first[1]['id']}/invites",
            headers=auth(first[0]),
        )
    ).json()
    await db.buddy_invites.update_one(
        {"_id": invite["id"]}, {"$set": {"expiresAt": now() - timedelta(seconds=1)}}
    )

    expired = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(second[0]),
        json={"learnerId": second[1]["id"], "code": invite["code"]},
    )
    invented = await client.post(
        "/leaderboard/buddies/accept",
        headers=auth(second[0]),
        json={"learnerId": second[1]["id"], "code": "KODA-AAAAAA"},
    )

    assert expired.status_code == invented.status_code == 401
    assert expired.json()["error"] == invented.json()["error"]


async def test_deleting_a_learner_cleans_up_invites_and_relationships(
    client, db, signup_body
):
    first, second = await two_learners(client, signup_body)
    await connect(client, first, second)
    await client.post(
        f"/leaderboard/buddies/{first[1]['id']}/invites", headers=auth(first[0])
    )

    deleted = await client.delete(
        f"/learners/{first[1]['id']}", headers=auth(first[0])
    )

    assert deleted.status_code == 204
    assert await db.buddy_invites.count_documents({"learnerId": first[1]["id"]}) == 0
    assert await db.buddy_relationships.count_documents(
        {"participants.learnerId": first[1]["id"]}
    ) == 0
