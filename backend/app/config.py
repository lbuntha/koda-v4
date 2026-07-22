"""Application settings, loaded from environment / .env (pydantic-settings)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "koda"

    # Auth
    jwt_secret: str = "change-me-please-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 30

    # CORS (JSON array in env, e.g. ["http://localhost:3000"])
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # AI proxy
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"


settings = Settings()
