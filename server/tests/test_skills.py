"""Skill registration is deployment data; publication survives restarts."""

from app.repos import skills as skills_repo
from app.repos import users
from app.security import passwords
from app.skill_defaults import load_defaults


async def _operator(client, db) -> dict[str, str]:
    await users.create(
        db,
        "skill-developer@example.com",
        passwords.hash_password("123456"),
        platform_role="developer",
    )
    tokens = (
        await client.post(
            "/auth/login",
            json={"email": "skill-developer@example.com", "password": "123456"},
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_deployment_registers_bundled_skills_in_mongo(db):
    defaults = load_defaults()
    assert {item["id"] for item in defaults} == {"counting"}
    assert sum([await skills_repo.seed_default(db, item) for item in defaults]) == 1

    registered = await skills_repo.get(db, "counting")
    assert registered is not None
    assert registered["version"] == "1.0.0"
    assert registered["status"] == "published"
    assert registered["publishedBy"]["id"] == "deploy"
    assert len(registered["lessons"]) == 15


async def test_operator_publishes_on_server_and_every_reader_sees_it(client, db, signup_body):
    default = load_defaults()[0]
    await skills_repo.seed_default(db, {**default, "status": "draft"})
    operator = await _operator(client, db)

    published = await client.patch(
        "/skills/counting/publication",
        json={"status": "published"},
        headers=operator,
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"
    assert published.json()["rev"] == 2
    assert published.json()["publishedBy"]["displayName"] == "skill-developer@example.com"
    assert published.json()["publishedAt"] > 0

    family = (await client.post("/auth/signup", json=signup_body())).json()
    listing = await client.get(
        "/skills", headers={"Authorization": f"Bearer {family['accessToken']}"}
    )
    assert listing.status_code == 200, listing.text
    assert listing.json()["skills"][0]["status"] == "published"

    withdrawn = await client.patch(
        "/skills/counting/publication",
        json={"status": "draft"},
        headers=operator,
    )
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["publishedBy"] == published.json()["publishedBy"]
    assert withdrawn.json()["publishedAt"] == published.json()["publishedAt"]
    assert withdrawn.json()["statusChangedBy"]["id"] == published.json()["publishedBy"]["id"]
    assert withdrawn.json()["statusChangedAt"] >= withdrawn.json()["publishedAt"]


async def test_deploy_refreshes_metadata_without_overwriting_publication(db):
    default = load_defaults()[0]
    await skills_repo.seed_default(db, {**default, "status": "draft"})
    await skills_repo.set_status(
        db, "counting", "published", {"id": "developer", "displayName": "Developer"}
    )
    await skills_repo.set_configuration(
        db,
        "counting",
        {
            "isEnabled": False,
            "tagline": "Managed on the server",
            "thumbnail": "apple",
            "features": [{"id": "sound", "isEnabled": False}],
            "settings": {"speechRate": 1.4},
            "lessonContent": {"lesson-1": {"title": "Managed title"}},
        },
        {"id": "developer", "displayName": "Developer"},
    )

    changed = {
        **default,
        "name": "A New Display Name",
        "status": "draft",
        "tagline": "A deploy must not restore this",
        "settings": {"speechRate": 0.5},
    }
    assert not await skills_repo.seed_default(db, changed)
    registered = await skills_repo.get(db, "counting")
    assert registered is not None
    assert registered["name"] == "A New Display Name"
    assert registered["status"] == "published"
    assert registered["isEnabled"] is False
    assert registered["tagline"] == "Managed on the server"
    assert registered["settings"] == {"speechRate": 1.4}
    assert registered["lessonContent"]["lesson-1"]["title"] == "Managed title"


async def test_family_can_read_but_cannot_publish(client, db, signup_body):
    await skills_repo.seed_default(db, load_defaults()[0])
    family = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {family['accessToken']}"}

    assert (await client.get("/skills", headers=auth)).status_code == 200
    refused = await client.patch(
        "/skills/counting/publication", json={"status": "draft"}, headers=auth
    )
    assert refused.status_code == 403
    refused_config = await client.put(
        "/skills/counting/configuration",
        json={"isEnabled": False, "features": [], "settings": {}, "lessonContent": {}},
        headers=auth,
    )
    assert refused_config.status_code == 403


async def test_operator_saves_the_complete_skill_manager_configuration(client, db):
    await skills_repo.seed_default(db, load_defaults()[0])
    operator = await _operator(client, db)
    configuration = {
        "isEnabled": False,
        "tagline": "Server listing",
        "thumbnail": "apple",
        "features": [{"id": "sound", "name": "Sound", "isEnabled": False}],
        "settings": {"speechRate": 1.4, "hapticIntensity": "strong"},
        "lessonContent": {
            "count-in-a-row": {
                "title": "Server-authored title",
                "prompts": {"intro": "Count every object."},
            }
        },
    }

    saved = await client.put(
        "/skills/counting/configuration", json=configuration, headers=operator
    )
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["isEnabled"] is False
    assert body["tagline"] == "Server listing"
    assert body["settings"]["speechRate"] == 1.4
    assert body["lessonContent"]["count-in-a-row"]["title"] == "Server-authored title"
    assert body["configurationChangedBy"]["displayName"] == "skill-developer@example.com"
    assert body["configurationChangedAt"] > 0

    listing = (await client.get("/skills", headers=operator)).json()["skills"][0]
    assert listing["features"][0]["isEnabled"] is False
    assert listing["thumbnail"] == "apple"
