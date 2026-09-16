"""A learner with nobody above them: signing up, signing in, and being named.

A student *is* their own learner, and three things quietly did not say so. They
signed up with a learner row and then signed in without one, so every session
after the first had no `learnerId` and nothing learner-scoped worked. Their
account had no name, so screens fell back to the word "Student". And an account
made before the row existed had no way to get one.
"""

import pytest

from app.repos import learners as learners_repo
from app.repos import memberships, users

PASSWORD = "correct horse battery"


async def signup(client, email: str, account_type: str = "student"):
    return await client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": PASSWORD,
            "accountType": account_type,
            "deviceName": "Their laptop",
            "installId": "i_theirs",
        },
    )


async def me(client, tokens: dict) -> dict:
    headers = {"Authorization": f"Bearer {tokens['accessToken']}"}
    return (await client.get("/auth/me", headers=headers)).json()


@pytest.fixture
async def student(client, db):
    """Signed up, then signed in — the state every session after the first is in."""
    await signup(client, "jutta@example.com")
    signed_in = (
        await client.post(
            "/auth/login",
            json={"email": "jutta@example.com", "password": PASSWORD, "installId": "i_again"},
        )
    ).json()
    return signed_in


async def test_signing_up_names_the_account_and_the_learner(client, db):
    tokens = (await signup(client, "jutta@example.com")).json()

    body = await me(client, tokens)
    assert body["displayName"] == "Jutta", "the menu shows a name, not the word Student"
    assert body["learnerName"] == "Jutta"
    assert body["role"] == "student"


async def test_signing_in_again_keeps_the_learner(client, db, student):
    body = await me(client, student)

    assert body["learnerId"], "a student signing in is still their own learner"
    assert body["learnerName"] == "Jutta"


async def test_a_student_may_write_their_own_settings(client, db, student):
    """`learner:update` is what the settings screen is gated on."""
    body = await me(client, student)

    assert "learner:update" in body["permissions"]


async def test_an_account_made_before_learner_rows_is_healed_on_sign_in(client, db):
    """Jutta's account: a student membership, a space, and no learner row."""
    from app.security import passwords

    user = await users.create(db, "old@example.com", passwords.hash_password(PASSWORD))
    family = await db.families.insert_one(
        {"_id": "f_old", "name": "My learning space", "ownerId": user["_id"]}
    )
    await memberships.add(db, user["_id"], "f_old", role="student")
    assert await learners_repo.for_family(db, "f_old") == []
    assert family.inserted_id == "f_old"

    tokens = (
        await client.post(
            "/auth/login", json={"email": "old@example.com", "password": PASSWORD, "installId": "i_old"}
        )
    ).json()

    body = await me(client, tokens)
    assert body["learnerId"], "the row is made on the way in, not by a migration"
    assert len(await learners_repo.for_family(db, "f_old")) == 1


async def test_signing_in_twice_does_not_make_a_second_learner(client, db, student):
    await client.post(
        "/auth/login", json={"email": "jutta@example.com", "password": PASSWORD, "installId": "i_third"}
    )

    membership = await db.memberships.find_one({"role": "student"})
    assert len(await learners_repo.for_family(db, membership["familyId"])) == 1


async def test_a_parent_is_not_given_a_learner_row(client, db):
    tokens = (await signup(client, "dara@example.com", account_type="parent")).json()

    body = await me(client, tokens)
    assert body["learnerId"] is None
    assert body["displayName"] is None, "a parent names themselves; a guess is worse than blank"
