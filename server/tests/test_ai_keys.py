"""Settings → My AI keys: a content maker's own Gemini, OpenAI or Claude key."""

import pytest

from tests.test_library import _login

SERVICE = "test-tutor-service-token"
KEY = "sk-test-NOTAREALKEY-0123456789abcd"


@pytest.fixture(autouse=True)
def tutor_configured():
    from app.settings import settings

    cfg = settings()
    before = cfg.tutor_service_token
    cfg.tutor_service_token = SERVICE
    yield
    cfg.tutor_service_token = before


def _resolve(client, headers, provider="openai", service=SERVICE):
    return client.post(f"/me/ai-keys/{provider}/resolve", headers={**headers, "X-Service-Token": service})


async def test_a_creator_saves_a_key_and_sees_only_its_last_four(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    saved = await client.put("/me/ai-keys/openai", json={"key": KEY}, headers=ana)
    assert saved.status_code == 200, saved.text
    assert saved.json()["last4"] == "abcd" and "key" not in saved.json()

    listed = (await client.get("/me/ai-keys", headers=ana)).json()
    assert [k["provider"] for k in listed["keys"]] == ["openai"] and listed["available"] is True
    assert KEY not in str(listed)

    # Stored sealed: the database never holds the key itself.
    row = await db.user_ai_keys.find_one({"provider": "openai"})
    assert KEY not in str(row) and row["last4"] == "abcd"


async def test_only_the_app_server_reads_a_key_and_only_the_owners(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    ben = await _login(client, db, "ben@example.com", platform_role="creator")
    await client.put("/me/ai-keys/openai", json={"key": KEY}, headers=ana)

    assert (await _resolve(client, ana)).json() == {"value": KEY}
    assert (await _resolve(client, ana, service="wrong")).status_code == 403
    assert (await client.post("/me/ai-keys/openai/resolve", headers=ana)).status_code == 403
    # Ben's sign-in reads Ben's key, which he has not set: never Ana's.
    assert (await _resolve(client, ben)).status_code == 404
    assert (await _resolve(client, ana, provider="gemini")).status_code == 404


async def test_a_removed_key_is_gone(client, db):
    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    await client.put("/me/ai-keys/anthropic", json={"key": KEY}, headers=ana)
    assert (await client.delete("/me/ai-keys/anthropic", headers=ana)).status_code == 204
    assert (await _resolve(client, ana, provider="anthropic")).status_code == 404
    assert (await client.get("/me/ai-keys", headers=ana)).json()["keys"] == []


async def test_a_parent_cannot_keep_keys_and_junk_is_refused(client, db, signup_body):
    tokens = (await client.post("/auth/signup", json=signup_body())).json()
    parent = {"Authorization": f"Bearer {tokens['accessToken']}"}
    assert (await client.put("/me/ai-keys/openai", json={"key": KEY}, headers=parent)).status_code == 403
    assert (await client.get("/me/ai-keys", headers=parent)).status_code == 403

    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    assert (await client.put("/me/ai-keys/openai", json={"key": "sk-has a space in it 12345"}, headers=ana)).status_code == 400
    assert (await client.put("/me/ai-keys/mistral", json={"key": KEY}, headers=ana)).status_code == 422


async def test_a_deleted_account_takes_its_keys_with_it(client, db):
    from app.repos import cleanup

    ana = await _login(client, db, "ana@example.com", platform_role="creator")
    await client.put("/me/ai-keys/openai", json={"key": KEY}, headers=ana)
    user = await db.users.find_one({"email": "ana@example.com"})
    await cleanup.purge_user(db, user["_id"])
    assert await db.user_ai_keys.count_documents({}) == 0


def test_production_without_a_secret_cannot_seal(monkeypatch):
    from app.services import key_box
    from app.settings import settings

    monkeypatch.setattr(settings(), "environment", "production")
    monkeypatch.setattr(settings(), "ai_keys_secret", None)
    assert key_box.available() is False
    monkeypatch.setattr(settings(), "ai_keys_secret", "a-long-random-secret-for-the-test")
    assert key_box.unseal(key_box.seal("abc")) == "abc"
