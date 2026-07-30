"""Application settings, loaded from environment / .env (pydantic-settings)."""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


#: Values that exist only so a developer can start the app with no .env. Any of them reaching
#: a deployment would mean every token is forgeable, so `environment=production` rejects them.
INSECURE_JWT_SECRETS = {
    "change-me-please-use-a-long-random-string",
    "dev-only-insecure-secret-change-me-0000000000000000",
}
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" keeps the convenience defaults; "production" refuses them.
    environment: str = "development"

    # Database
    mongo_uri: str = "mongodb://localhost:27017"
    # Dedicated DB for this app. Do NOT reuse "koda" — that belongs to koda-v3
    # (different schema); sharing it causes index conflicts on startup.
    mongo_db: str = "koda_v4"

    # Auth
    jwt_secret: str = "change-me-please-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 30

    # CORS (JSON array in env, e.g. ["https://app.example.com"]). The localhost entries are
    # the dev server's; production must set its own real origins.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
    ]

    # Mail. `console` logs the message (development only); `smtp` sends for real — Mailpit
    # locally, a provider in production. Production refuses `console` at send time.
    mail_transport: str = "console"
    mail_from: str = "Koda <no-reply@koda.local>"
    smtp_host: str = "mailpit"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = False
    #: Where a reset link points. Must be the address a parent actually browses.
    app_base_url: str = "http://localhost:3000"

    # AI proxy
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}

    @model_validator(mode="after")
    def production_rejects_development_defaults(self):
        """Fail to boot rather than run a deployment on developer conveniences.

        A forgeable signing key or a localhost CORS allowance is not something to warn about
        and continue past — the app would come up looking healthy while being open.
        """
        if not self.is_production:
            return self

        problems: list[str] = []
        if self.jwt_secret in INSECURE_JWT_SECRETS:
            problems.append("JWT_SECRET is still the development placeholder")
        elif len(self.jwt_secret) < MIN_JWT_SECRET_LENGTH:
            problems.append(
                f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters"
            )

        local = [origin for origin in self.cors_origins if "localhost" in origin or "127.0.0.1" in origin]
        if local:
            problems.append(f"CORS_ORIGINS still allows development origins: {', '.join(local)}")
        if not self.cors_origins:
            problems.append("CORS_ORIGINS is empty; set the deployment's real origins")

        if problems:
            raise ValueError(
                "Refusing to start with ENVIRONMENT=production: "
                + "; ".join(problems)
            )
        return self


settings = Settings()
