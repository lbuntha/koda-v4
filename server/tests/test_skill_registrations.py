from datetime import datetime


def _skill(skill_id: str, *, status: str = "published", ages=None) -> dict:
    return {
        "id": skill_id,
        "name": skill_id.title(),
        "version": "1.0.0",
        "description": "Learn through play.",
        "category": "core",
        "author": "Koda",
        "iconName": "Sparkles",
        "status": status,
        "audience": {"ages": ages or [5, 9], "category": "number-sense"},
        "features": [],
        "settings": {},
        "lessons": [],
    }


async def _signup(client, body):
    pair = (await client.post("/auth/signup", json=body)).json()
    return pair, {"Authorization": f"Bearer {pair['accessToken']}"}


async def test_a_user_registers_and_removes_a_published_skill(client, db, signup_body):
    from app.repos import skills

    await skills.seed_default(db, _skill("counting"))
    _, auth = await _signup(client, signup_body())

    empty = await client.get("/skill-registrations", headers=auth)
    assert empty.status_code == 200
    assert empty.json()["registrations"] == []

    added = await client.post("/skill-registrations/counting", headers=auth)
    assert added.status_code == 201, added.text
    assert added.json()["skillId"] == "counting"
    assert added.json()["registeredAt"] > 0

    # Idempotent: a double tap never creates a duplicate enrollment.
    assert (await client.post("/skill-registrations/counting", headers=auth)).status_code == 201
    listed = (await client.get("/skill-registrations", headers=auth)).json()["registrations"]
    assert [item["skillId"] for item in listed] == ["counting"]

    removed = await client.delete("/skill-registrations/counting", headers=auth)
    assert removed.status_code == 204
    assert (await client.get("/skill-registrations", headers=auth)).json()["registrations"] == []


async def test_registrations_are_private_to_the_authenticated_user(client, db, signup_body):
    from app.repos import skills

    await skills.seed_default(db, _skill("counting"))
    _, first = await _signup(client, signup_body("first@example.com"))
    _, second = await _signup(client, signup_body("second@example.com"))

    await client.post("/skill-registrations/counting", headers=first)
    assert len((await client.get("/skill-registrations", headers=first)).json()["registrations"]) == 1
    assert (await client.get("/skill-registrations", headers=second)).json()["registrations"] == []


async def test_draft_and_disabled_skills_cannot_be_registered(client, db, signup_body):
    from app.repos import skills

    await skills.seed_default(db, _skill("draft-skill", status="draft"))
    await skills.seed_default(db, _skill("disabled-skill"))
    await db.skill_registry.update_one({"id": "disabled-skill"}, {"$set": {"isEnabled": False}})
    _, auth = await _signup(client, signup_body())

    assert (await client.post("/skill-registrations/draft-skill", headers=auth)).status_code == 404
    assert (await client.post("/skill-registrations/disabled-skill", headers=auth)).status_code == 404


async def test_a_child_cannot_register_a_skill_outside_their_age(client, db, signup_body):
    from app.repos import learners, skills

    await skills.seed_default(db, _skill("early-math", ages=[5, 7]))
    pair, parent_auth = await _signup(client, signup_body())
    learner = await learners.create(
        db,
        pair["familyId"],
        "Older learner",
        birth_year=datetime.now().year - 12,
    )
    switched = await client.post(f"/auth/switch/{learner['_id']}", headers=parent_auth)
    child_auth = {"Authorization": f"Bearer {switched.json()['accessToken']}"}

    refused = await client.post("/skill-registrations/early-math", headers=child_auth)
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "skill_outside_age_range"
