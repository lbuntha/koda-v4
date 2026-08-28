"""The shared art library is durable Mongo data with guarded management APIs."""

from app.art_defaults import load_defaults
from app.repos import art as art_repo
from app.repos import users
from app.security import passwords


async def _operator(client, db, role: str = "developer") -> dict[str, str]:
    await users.create(
        db,
        f"{role}@example.com",
        passwords.hash_password("123456"),
        platform_role=role,
    )
    tokens = (
        await client.post(
            "/auth/login", json={"email": f"{role}@example.com", "password": "123456"}
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_bundled_art_seeds_once_and_survives_edits(db):
    defaults = load_defaults()
    assert len(defaults) == 11
    assert sum([await art_repo.seed_default(db, item) for item in defaults]) == 11

    await art_repo.put(db, "apple", "food", "<svg><circle r='4'/></svg>", "developer")
    assert sum([await art_repo.seed_default(db, item) for item in defaults]) == 0
    apple = await art_repo.get(db, "apple")
    assert apple and apple["category"] == "food"
    assert apple["markup"] == "<svg><circle r='4'/></svg>"


async def test_operator_can_create_rename_list_and_delete_art(client, db):
    auth = await _operator(client, db)

    created = await client.put(
        "/art/red-apple",
        json={"category": "fruits", "markup": "<svg viewBox='0 0 10 10'><circle r='4'/></svg>"},
        headers=auth,
    )
    assert created.status_code == 200, created.text
    assert created.json()["created"] is True
    assert created.json()["category"] == "fruits"

    renamed = await client.patch(
        "/art/red-apple", json={"toId": "green-apple", "category": "food"}, headers=auth
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["id"] == "green-apple"

    listing = await client.get("/art", headers=auth)
    assert [item["id"] for item in listing.json()["assets"]] == ["green-apple"]

    assert (await client.delete("/art/green-apple", headers=auth)).status_code == 204
    assert (await client.get("/art", headers=auth)).json()["assets"] == []


async def test_family_can_browse_but_cannot_change_shared_art(client, signup_body, db):
    owner = (await client.post("/auth/signup", json=signup_body())).json()
    auth = {"Authorization": f"Bearer {owner['accessToken']}"}

    assert (await client.get("/art", headers=auth)).status_code == 200
    refused = await client.put(
        "/art/apple", json={"category": "fruits", "markup": "<svg/>"}, headers=auth
    )
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "not_an_operator"


async def test_art_api_refuses_executable_svg(client, db):
    auth = await _operator(client, db, "admin")
    response = await client.put(
        "/art/bad", json={"category": "tests", "markup": "<svg><script>alert(1)</script></svg>"},
        headers=auth,
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unsafe_svg"


async def test_deleted_seed_asset_does_not_return_on_restart(db):
    apple = next(item for item in load_defaults() if item["id"] == "apple")
    await art_repo.seed_default(db, apple)
    assert await art_repo.delete(db, "apple", "admin")
    assert not await art_repo.seed_default(db, apple)
    assert await art_repo.get(db, "apple") is None
