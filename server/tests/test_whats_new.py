"""What's new: recent skills, books and Rebus releases, and nothing that is not live."""

from datetime import timedelta

import pytest

from app.models.common import now


@pytest.fixture
async def parent(client, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    return {"Authorization": f"Bearer {tokens['accessToken']}"}


async def test_lists_recent_live_content_newest_first(client, parent, db):
    t = now()
    await db.skill_registry.insert_many([
        {"id": "dots", "title": "Dot Connect", "status": "published", "deletedAt": None,
         "publishedAt": t - timedelta(days=1), "audience": {"ages": [6, 9]}},
        {"id": "draft", "title": "Draft", "status": "draft", "deletedAt": None, "publishedAt": t},
        {"id": "off", "title": "Off", "status": "published", "deletedAt": None, "isEnabled": False, "publishedAt": t},
        {"id": "old", "title": "Old", "status": "published", "deletedAt": None, "publishedAt": t - timedelta(days=90)},
    ])
    await db.library_books.insert_many([
        {"id": "b1", "deletedAt": None, "publishedAt": t - timedelta(hours=1),
         "published": {"title": "The Market", "ages": [5, 7], "language": "km", "picture": "book"}},
        {"id": "b2", "deletedAt": None, "publishedAt": t, "published": None},
    ])
    await db.rebus_releases.insert_many([
        {"number": 3, "at": t - timedelta(hours=2), "puzzleIds": ["a", "b"], "rolledBack": False},
        {"number": 2, "at": t, "puzzleIds": ["c"], "rolledBack": True},
    ])

    res = await client.get("/whats-new", headers=parent)

    assert res.status_code == 200
    items = res.json()["items"]
    assert [(i["kind"], i["id"]) for i in items] == [("book", "b1"), ("rebus", "release-3"), ("skill", "dots")]
    assert items[0]["ages"] == [5, 7] and items[0]["language"] == "km"
    assert items[1]["count"] == 2
    assert items[2]["title"] == "Dot Connect" and isinstance(items[2]["publishedAt"], int)


async def test_needs_a_sign_in(client):
    assert (await client.get("/whats-new")).status_code == 401
