from app.repos import users
from app.services import google_identity
from app.settings import settings

CREDENTIAL = "google-id-token-" * 10
CLIENT_ID = "koda-web.apps.googleusercontent.com"


def google_claims(
    *,
    subject: str = "google-123",
    email: str = "parent@gmail.com",
    verified: bool = True,
    **extra,
) -> dict:
    return {
        "sub": subject,
        "email": email,
        "email_verified": verified,
        "name": "Sokha Parent",
        **extra,
    }


def configure_google(monkeypatch, claims: dict) -> None:
    monkeypatch.setattr(settings(), "google_client_id", CLIENT_ID)
    monkeypatch.setattr(google_identity, "verify", lambda credential, audience: claims)


async def test_google_can_create_a_parent_and_then_sign_in_again(client, db, monkeypatch):
    configure_google(monkeypatch, google_claims())

    created = await client.post(
        "/auth/google",
        json={
            "credential": CREDENTIAL,
            "createAccount": True,
            "familyName": "Sokha's family",
            "installId": "i_google_browser",
        },
    )
    assert created.status_code == 200, created.text
    first = created.json()
    assert first["role"] == "owner"

    me = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {first['accessToken']}"}
    )
    assert me.json()["email"] == "parent@gmail.com"
    assert me.json()["displayName"] == "Sokha Parent"
    assert me.json()["familyName"] == "Sokha's family"

    stored = await users.by_google_sub(db, "google-123")
    assert stored is not None
    assert stored["passwordHash"] is None
    assert stored["emailVerifiedAt"] is not None

    signed_in = await client.post(
        "/auth/google",
        json={
            "credential": CREDENTIAL,
            "createAccount": False,
            "installId": "i_google_browser",
        },
    )
    assert signed_in.status_code == 200, signed_in.text
    # The install is recognised just like a password login, rather than being
    # added to the device page twice.
    assert signed_in.json()["deviceId"] == first["deviceId"]
    assert await db.users.count_documents({"googleSub": "google-123"}) == 1


async def test_google_sign_in_does_not_silently_create_an_account(client, monkeypatch):
    configure_google(monkeypatch, google_claims())
    response = await client.post(
        "/auth/google",
        json={"credential": CREDENTIAL, "createAccount": False},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "google_account_missing"


async def test_invalid_google_token_is_rejected(client, monkeypatch):
    monkeypatch.setattr(settings(), "google_client_id", CLIENT_ID)

    def invalid(*_args):
        raise ValueError("bad signature")

    monkeypatch.setattr(google_identity, "verify", invalid)
    response = await client.post(
        "/auth/google",
        json={"credential": CREDENTIAL, "createAccount": True},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "google_token_invalid"


async def test_google_requires_a_verified_email(client, monkeypatch):
    configure_google(monkeypatch, google_claims(verified=False))
    response = await client.post(
        "/auth/google",
        json={"credential": CREDENTIAL, "createAccount": True},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "google_email_unverified"


async def test_verified_gmail_identity_links_to_existing_password_account(
    client, db, signup_body, monkeypatch
):
    signup = signup_body(email="parent@gmail.com")
    original = (await client.post("/auth/signup", json=signup)).json()
    original_family = original["familyId"]
    configure_google(monkeypatch, google_claims())

    response = await client.post(
        "/auth/google", json={"credential": CREDENTIAL, "createAccount": False}
    )
    assert response.status_code == 200, response.text
    assert response.json()["familyId"] == original_family
    assert (await users.by_email(db, "parent@gmail.com"))["googleSub"] == "google-123"

    # Linking adds a sign-in method; it does not remove the old one.
    password_login = await client.post(
        "/auth/login",
        json={"email": signup["email"], "password": signup["password"]},
    )
    assert password_login.status_code == 200


async def test_third_party_google_email_is_not_auto_linked(
    client, db, signup_body, monkeypatch
):
    await client.post("/auth/signup", json=signup_body(email="parent@example.com"))
    configure_google(monkeypatch, google_claims(email="parent@example.com"))

    response = await client.post(
        "/auth/google", json={"credential": CREDENTIAL, "createAccount": False}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "google_link_required"
    assert (await users.by_email(db, "parent@example.com")).get("googleSub") is None


async def test_an_existing_google_link_cannot_be_replaced_by_email_match(
    client, db, signup_body, monkeypatch
):
    await client.post("/auth/signup", json=signup_body(email="parent@gmail.com"))
    user = await users.by_email(db, "parent@gmail.com")
    await users.link_google(db, user["_id"], "google-original")
    configure_google(monkeypatch, google_claims(subject="google-attacker"))

    response = await client.post(
        "/auth/google", json={"credential": CREDENTIAL, "createAccount": False}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "google_identity_conflict"
    assert (await users.by_email(db, "parent@gmail.com"))["googleSub"] == "google-original"


async def test_google_only_account_fails_password_login_cleanly(client, monkeypatch):
    configure_google(monkeypatch, google_claims())
    await client.post(
        "/auth/google", json={"credential": CREDENTIAL, "createAccount": True}
    )

    response = await client.post(
        "/auth/login", json={"email": "parent@gmail.com", "password": "anything"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "bad_credentials"
