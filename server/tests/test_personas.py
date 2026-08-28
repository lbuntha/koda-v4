"""Who Koda can be, and who gets to decide.

The roster is data an operator edits; the teaching rules every character obeys
are code, in `tutor/persona.ts`, and are not reachable from any of these routes.
What is worth asserting is the boundary between those two — and the two floors
that stop a deployment from ending up with no teacher at all.
"""

import pytest

from app.persona_defaults import DEFAULT_PERSONA, DEFAULT_PERSONAS
from app.repos import personas as personas_repo
from app.repos import platform_roles as platform_roles_repo
from app.role_defaults import DEFAULT_PLATFORM_ROLES


@pytest.fixture(autouse=True)
async def seeded(db):
    """The app seeds the roster at startup; the fixture skips the lifespan."""
    for persona in DEFAULT_PERSONAS:
        await personas_repo.seed_default(db, persona)


@pytest.fixture
async def owner(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


@pytest.fixture
async def admin(client, db):
    from app.repos import users
    from app.security import passwords

    for role in DEFAULT_PLATFORM_ROLES:
        await platform_roles_repo.seed_default(db, role)
    await users.create(
        db, "ops@example.com", passwords.hash_password("correct horse battery"),
        platform_role="admin",
    )
    tokens = (
        await client.post(
            "/auth/login", json={"email": "ops@example.com", "password": "correct horse battery"}
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_a_family_reads_the_roster_but_cannot_edit_it(client, owner):
    """A parent choosing a teacher has to see the choices; none of it is secret."""
    r = await client.get("/personas", headers=owner)
    assert r.status_code == 200
    body = r.json()
    assert {p["personaId"] for p in body["personas"]} == {p["personaId"] for p in DEFAULT_PERSONAS}
    assert body["defaultPersonaId"] == DEFAULT_PERSONA
    assert "Aoede" in body["voices"]

    # Not theirs to change: a character is what every family on the deployment
    # gets, which is the same job as the switchboard.
    edit = await client.patch("/personas/vega", headers=owner, json={"name": "Mine"})
    assert edit.status_code == 403
    assert (await client.get("/personas/all", headers=owner)).status_code == 403


async def test_a_retired_character_leaves_the_family_roster(client, admin, owner):
    """Retiring is the gentle move: the wording stays, the choice disappears."""
    off = await client.patch("/personas/rio", headers=admin, json={"enabled": False})
    assert off.status_code == 200

    family = (await client.get("/personas", headers=owner)).json()
    assert "rio" not in {p["personaId"] for p in family["personas"]}

    # The operator still sees it — that is the difference between the two views.
    everything = (await client.get("/personas/all", headers=admin)).json()
    assert "rio" in {p["personaId"] for p in everything["personas"]}


async def test_the_default_character_cannot_be_retired_or_deleted(client, admin):
    """The floor every unchosen child falls back to.

    Without it a deployment could switch off the teacher a child gets when
    nobody has chosen one, which is a coach that does not exist.
    """
    off = await client.patch(f"/personas/{DEFAULT_PERSONA}", headers=admin, json={"enabled": False})
    assert off.status_code == 409
    assert off.json()["error"]["code"] == "default_persona"

    gone = await client.delete(f"/personas/{DEFAULT_PERSONA}", headers=admin)
    assert gone.status_code == 409


async def test_a_character_may_only_speak_in_a_voice_that_exists(client, admin):
    """A voice the live API does not know is a teacher who cannot speak, and the
    failure would surface as silence mid-lesson rather than as an error here."""
    bad = await client.patch("/personas/vega", headers=admin, json={"voice": "Brian"})
    assert bad.status_code == 409
    assert bad.json()["error"]["code"] == "unknown_voice"

    good = await client.patch("/personas/vega", headers=admin, json={"voice": "Zephyr"})
    assert good.status_code == 200
    assert good.json()["voice"] == "Zephyr"


async def test_an_operator_adds_a_teacher_and_a_family_can_choose_them(client, admin, owner):
    created = await client.post(
        "/personas",
        headers=admin,
        json={
            "personaId": "ms-tan",
            "name": "Ms Tan",
            "emoji": "📐",
            "blurb": "Draws everything before saying it.",
            "manner": "You reach for a picture before a sentence, every time.",
            "voice": "Kore",
            "minAge": 7,
            "maxAge": 11,
        },
    )
    assert created.status_code == 201, created.text

    family = (await client.get("/personas", headers=owner)).json()
    assert "ms-tan" in {p["personaId"] for p in family["personas"]}

    # An id is permanent — a child's settings point at it — so a second one
    # under the same name is refused rather than silently overwriting.
    again = await client.post(
        "/personas",
        headers=admin,
        json={"personaId": "ms-tan", "name": "Someone else", "manner": "A different manner."},
    )
    assert again.status_code == 409


async def test_the_manner_is_bounded_so_it_cannot_become_a_second_prompt(client, admin):
    """A character is a manner, not a system prompt.

    The rules live in code and no row can reach them; the length cap is the
    other half of that — a 50,000-word `manner` would drown the frame it is
    poured into whatever the frame says.
    """
    too_long = await client.patch("/personas/vega", headers=admin, json={"manner": "x" * 5000})
    assert too_long.status_code == 422
