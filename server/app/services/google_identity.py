"""Verification boundary for credentials returned by Google Identity Services."""

from typing import Any

from google.auth.transport import requests
from google.oauth2 import id_token


def verify(credential: str, client_id: str) -> dict[str, Any]:
    """Verify signature, issuer, expiry and that the token was made for Koda."""
    return id_token.verify_oauth2_token(credential, requests.Request(), client_id)
