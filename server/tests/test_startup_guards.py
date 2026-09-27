"""
Deployments that would run but not work.

Both faults here are invisible from the outside: the service starts, answers,
and is wrong. The audio one cost a family a book that read aloud on the iPad it
was recorded on and stayed silent on every other device, because each Cloud Run
instance had written the recordings to its own disk.
"""

import pytest

from app.main import refuse_unsafe_deployment
from app.settings import Settings

PROD = {"environment": "production", "jwt_secret": "a-real-secret-that-is-long-enough-32b"}


def test_production_without_an_audio_bucket_refuses_to_start():
    with pytest.raises(RuntimeError, match="LIBRARY_AUDIO_BUCKET"):
        refuse_unsafe_deployment(Settings(**PROD, library_audio_bucket=None))


def test_production_with_a_bucket_starts():
    refuse_unsafe_deployment(Settings(**PROD, library_audio_bucket="koda-library-audio"))


def test_production_still_refuses_the_development_secret():
    # Spelled out rather than left to the environment: a .env beside the tests
    # would otherwise supply a real secret and the guard would look broken.
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        refuse_unsafe_deployment(
            Settings(
                environment="production",
                jwt_secret="dev-only-change-me-not-a-real-secret-32b",
                library_audio_bucket="koda-library-audio",
            )
        )


def test_development_needs_no_bucket():
    # Locally the folder is a real folder on a real disk, kept in a docker volume.
    refuse_unsafe_deployment(Settings(environment="development", library_audio_bucket=None))
