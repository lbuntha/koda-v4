"""Verification boundary for credentials returned by Google Identity Services."""

from typing import Any

from google.auth.transport import requests
from google.oauth2 import id_token


def verify(credential: str, client_id: str) -> dict[str, Any]:
    """Verify signature, issuer, expiry and that the token was made for Koda."""
    return id_token.verify_oauth2_token(credential, requests.Request(), client_id)


def verify_oidc(token: str, audience: str) -> dict[str, Any]:
    """Verify an OIDC identity token Google minted for a service account.

    The same primitive as `verify` and deliberately the same file: both are "a
    Google-signed ID token, checked against the audience it was made for". What
    differs is who is at the other end — a parent's browser there, Cloud
    Scheduler here — and that is the caller's business, not this boundary's.

    Signature, issuer and expiry are checked by the library against Google's
    published keys. The `email` claim is *not* checked here: which service
    account may call is policy, and policy belongs where the route is.
    """
    return id_token.verify_oauth2_token(token, requests.Request(), audience)
