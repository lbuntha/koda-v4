"""Configuration, read once from the environment.

Everything the service needs to run is here and nowhere else: no module reads
`os.environ` on its own, so "what does this deployment need?" has one answer.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "koda_v4"

    # Dev default so `make dev-local` works out of the box. Production supplies
    # a real one; `main.py` refuses to start with this value outside dev.
    jwt_secret: str = "dev-only-change-me-not-a-real-secret-32b"
    jwt_algorithm: str = "HS256"
    access_ttl_minutes: int = 15
    refresh_ttl_days: int = 60

    #: Password registrations may be held until their mailbox is proved. Off
    #: by default so a deployment without outbound mail cannot create accounts
    #: whose activation link it has no way to deliver.
    require_email_verification: bool = False
    email_verification_ttl_hours: int = 24

    #: Public OAuth client id for Google Identity Services. The browser and
    #: this API receive the same value: the browser asks Google for an ID token,
    #: and the API uses the id as the token's required audience. There is no
    #: client secret in this flow.
    google_client_id: str | None = None

    #: Shared with the tutor server (`server.ts`), and with nothing else.
    #:
    #: A family's Gemini key has to reach whatever calls Gemini, and that is not
    #: the browser — so the one endpoint that hands the key out asks for this on
    #: top of the caller's own token. Unset means the endpoint is off: a
    #: deployment that has not configured the tutor server cannot leak through
    #: an endpoint it never meant to expose.
    tutor_service_token: str | None = None

    #: Where mail goes. `console` logs it and sends nothing, which is what local
    #: work and the test suite want; `smtp` is a real server — Mailpit next door
    #: in compose, or Gmail with an app password.
    mail_driver: Literal["console", "smtp"] = "console"
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_user: str | None = None
    smtp_password: str | None = None
    #: Port 587 wants STARTTLS and Gmail requires it; a local catcher takes none.
    smtp_starttls: bool = False
    mail_from: str = "Koda <no-reply@koda.local>"

    #: What a link in an email points at.
    #:
    #: Has to be configuration rather than a constant: the same code sends a
    #: reset link to `localhost:3001` on a laptop and to a real domain in
    #: production, and a hardcoded host is a reset nobody outside dev can use.
    app_base_url: str = "http://localhost:3001"

    #: How notifications leave. `console` logs the message and sends nothing,
    #: which is what local work and the test suite want; `fcm` is Firebase Cloud
    #: Messaging, authenticated as the Cloud Run service account.
    push_driver: Literal["console", "fcm"] = "console"

    #: The Firebase project that owns the Web Push certificate and the tokens.
    #: There is no credential beside it: on Cloud Run the runtime service
    #: account *is* the credential, so a deployment configures an id and grants
    #: a role, and no key file exists to leak.
    firebase_project_id: str | None = None

    cors_origins: list[str] = ["http://localhost:3001", "http://localhost:3002"]
    environment: str = "development"

    @property
    def is_dev(self) -> bool:
        return self.environment == "development"


@lru_cache
def settings() -> Settings:
    return Settings()
