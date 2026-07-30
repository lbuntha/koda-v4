"""Production must not boot on developer defaults.

The app shipped with a placeholder `JWT_SECRET` and a localhost CORS allowance that silently
took effect if a deployment forgot to override them — it would come up looking healthy while
every token was forgeable. These pin the refusal.
"""

import pytest

from app.core.config import INSECURE_JWT_SECRETS, MIN_JWT_SECRET_LENGTH, Settings


REAL_SECRET = "b7f3" * 12          # comfortably over the minimum
REAL_ORIGINS = ["https://app.koda.example"]


def build(**over) -> Settings:
    """A Settings built from explicit values, ignoring any ambient .env."""
    base = {
        "environment": "production",
        "jwt_secret": REAL_SECRET,
        "cors_origins": REAL_ORIGINS,
        "_env_file": None,
    }
    return Settings(**{**base, **over})


def test_a_properly_configured_production_boots():
    settings = build()
    assert settings.is_production
    assert settings.cors_origins == REAL_ORIGINS


@pytest.mark.parametrize("placeholder", sorted(INSECURE_JWT_SECRETS))
def test_every_known_placeholder_secret_is_refused(placeholder):
    with pytest.raises(ValueError, match="development placeholder"):
        build(jwt_secret=placeholder)


def test_a_short_secret_is_refused_even_if_it_is_not_a_known_placeholder():
    with pytest.raises(ValueError, match="at least"):
        build(jwt_secret="x" * (MIN_JWT_SECRET_LENGTH - 1))


@pytest.mark.parametrize(
    "origin",
    ["http://localhost:3000", "http://127.0.0.1:5173", "https://localhost"],
)
def test_development_origins_are_refused(origin):
    with pytest.raises(ValueError, match="development origins"):
        build(cors_origins=[*REAL_ORIGINS, origin])


def test_an_empty_origin_list_is_refused():
    with pytest.raises(ValueError, match="CORS_ORIGINS is empty"):
        build(cors_origins=[])


def test_development_keeps_its_conveniences():
    """The same values must stay usable locally — the guard is about deployments."""
    settings = Settings(environment="development", _env_file=None)
    assert not settings.is_production
    assert settings.jwt_secret in INSECURE_JWT_SECRETS
    assert any("localhost" in origin for origin in settings.cors_origins)


@pytest.mark.parametrize("value", ["production", "PRODUCTION", " Prod "])
def test_production_is_recognised_however_it_is_written(value):
    with pytest.raises(ValueError):
        Settings(environment=value, jwt_secret=sorted(INSECURE_JWT_SECRETS)[0], _env_file=None)
