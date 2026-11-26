"""Write-only storage for the deployment's PayWay sandbox key material."""

import json
from datetime import date, datetime
from typing import Annotated

from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import APIRouter, Depends, Request, Response
from pydantic import Field, SecretStr, ValidationError

from app.deps import AUTHENTICATED, Db, require
from app.errors import AppError, BadRequest, Forbidden
from app.models.auth import Principal
from app.models.common import Model, now
from app.services import key_box
from app.services.payway import CAMBODIA, SANDBOX_ID, encryption_secret

router = APIRouter(prefix="/billing/payway/sandbox", tags=["billing"], dependencies=[AUTHENTICATED])


def _operator(p: Annotated[Principal, Depends(require("system:write"))]) -> None:
    if p.family_id is not None:
        raise Forbidden("Merchant credentials belong to the platform operator.")


CanConfigure = Annotated[None, Depends(_operator)]


class CredentialsIn(Model):
    merchant_id: str = Field(alias="merchantId", pattern=r"^[A-Za-z0-9_-]{1,50}$")
    api_key: SecretStr = Field(alias="apiKey", min_length=1, max_length=1024)
    expires_on: date = Field(alias="expiresOn")
    rsa_public_key: str = Field(alias="rsaPublicKey", default="", max_length=12000)
    rsa_private_key: SecretStr = Field(alias="rsaPrivateKey", default=SecretStr(""), max_length=12000)


class CredentialStatus(Model):
    available: bool
    configured: bool
    merchant_id: str | None = Field(default=None, alias="merchantId")
    expires_on: date | None = Field(default=None, alias="expiresOn")
    updated_at: datetime | None = Field(default=None, alias="updatedAt")


def _rsa_public_key(pem: str) -> str:
    pem = _normalize_pem(pem)
    if not pem:
        return ""
    try:
        if isinstance(serialization.load_pem_public_key(pem.encode()), rsa.RSAPublicKey):
            return pem
    except (ValueError, TypeError, UnsupportedAlgorithm):
        pass
    raise BadRequest(
        "Paste the complete RSA public PEM, or leave this field blank for KHQR checkout.",
        "payway_invalid_rsa_public",
    )


def _rsa_private_key(pem: str) -> str:
    pem = _normalize_pem(pem)
    if not pem:
        return ""
    try:
        if isinstance(serialization.load_pem_private_key(pem.encode(), password=None), rsa.RSAPrivateKey):
            return pem
    except (ValueError, TypeError, UnsupportedAlgorithm):
        pass
    raise BadRequest(
        "Paste the complete unencrypted RSA private PEM, or leave this field blank for KHQR checkout.",
        "payway_invalid_rsa_private",
    )


def _normalize_pem(pem: str) -> str:
    return pem.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\r\n", "\n").strip()


@router.get("")
async def status(db: Db, p: CanConfigure, response: Response) -> CredentialStatus:
    response.headers["Cache-Control"] = "no-store"
    row = await db.payment_credentials.find_one(
        {"_id": SANDBOX_ID}, {"merchantId": 1, "expiresOn": 1, "updatedAt": 1}
    )
    return CredentialStatus(available=encryption_secret() is not None, configured=row is not None, **(row or {}))


@router.put("")
async def save(request: Request, db: Db, p: CanConfigure, response: Response) -> CredentialStatus:
    response.headers["Cache-Control"] = "no-store"
    secret = encryption_secret()
    if not secret:
        raise AppError(503, "payway_vault_unavailable", "Configure PAYWAY_CREDENTIALS_SECRET on the API server.")
    # Parse explicitly so invalid requests never echo their submitted keys in a 422 response.
    try:
        body = CredentialsIn.model_validate(await request.json())
    except (ValidationError, ValueError):
        raise BadRequest("Enter a valid merchant ID, API key, and expiry date.") from None
    if body.expires_on < datetime.now(CAMBODIA).date():
        raise BadRequest("This API key has expired. Enter the replacement from ABA.")

    api_key = body.api_key.get_secret_value().strip()
    if not api_key or any(ch.isspace() for ch in api_key):
        raise BadRequest("Enter the complete API key without spaces.")
    public_key = _rsa_public_key(body.rsa_public_key)
    private_key = _rsa_private_key(body.rsa_private_key.get_secret_value())

    metadata = {
        "merchantId": body.merchant_id,
        "expiresOn": body.expires_on.isoformat(),
        "updatedAt": now(),
    }
    sealed = key_box.seal(json.dumps({
        "apiKey": api_key,
        "rsaPublicKey": public_key,
        "rsaPrivateKey": private_key,
    }), secret=secret)
    await db.payment_credentials.replace_one(
        {"_id": SANDBOX_ID}, {"_id": SANDBOX_ID, **metadata, "sealed": sealed}, upsert=True,
    )
    return CredentialStatus(available=True, configured=True, **metadata)
