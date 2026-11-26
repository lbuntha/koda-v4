"""Server-side ABA PayWay sandbox client for KHQR."""

import asyncio
import base64
import hashlib
import hmac
import json
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from app.errors import AppError
from app.models.common import now
from app.services import key_box
from app.settings import settings

SANDBOX_ID = "payway:sandbox"
CAMBODIA = ZoneInfo("Asia/Phnom_Penh")
BASE_URL = "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments"
QR_MINUTES = 10
QR_FIELDS = (
    "req_time", "merchant_id", "tran_id", "amount", "items", "first_name", "last_name", "email", "phone",
    "purchase_type", "payment_option", "callback_url", "return_deeplink", "currency", "custom_fields",
    "return_params", "payout", "lifetime", "qr_image_template",
)
PNG_DATA_URL = re.compile(r"data:image/png;base64,[A-Za-z0-9+/]+={0,2}")


def encryption_secret() -> str | None:
    configured = settings().payway_credentials_secret
    value = configured.get_secret_value() if configured else ""
    return value if len(value) >= 32 else None


async def credentials(db) -> tuple[str, str] | None:
    secret = encryption_secret()
    if not settings().is_dev or not secret:
        return None
    row = await db.payment_credentials.find_one({"_id": SANDBOX_ID})
    if not row:
        return None
    try:
        if date.fromisoformat(row["expiresOn"]) < datetime.now(CAMBODIA).date():
            return None
        clear = key_box.unseal(row["sealed"], secret=secret)
        key = json.loads(clear or "{}").get("apiKey")
        return (row["merchantId"], key) if isinstance(key, str) and key else None
    except (KeyError, ValueError, TypeError):
        return None


def _post(endpoint: str, payload: dict) -> dict:
    req = Request(
        f"{BASE_URL}/{endpoint}", data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST",
    )
    try:
        with urlopen(req, timeout=10) as response:
            data = json.loads(response.read(1_500_000))
        if isinstance(data, dict):
            return data
    except (OSError, ValueError):
        pass
    raise AppError(502, "payway_unavailable", "ABA PayWay did not respond. Try again.")


def _signed(merchant: str, secret: str, reference: str, fields: tuple[str, ...], **extra) -> dict:
    payload = {
        "req_time": now().strftime("%Y%m%d%H%M%S"), "merchant_id": merchant,
        "tran_id": reference, **extra,
    }
    message = "".join(str(payload.get(field, "")) for field in fields)
    payload["hash"] = base64.b64encode(hmac.digest(secret.encode(), message.encode(), hashlib.sha512)).decode()
    return payload


def _matches_amount(value, cents: int) -> bool:
    try:
        return Decimal(str(value)) == Decimal(cents) / 100
    except InvalidOperation:
        return False


async def generate_qr(merchant: str, key: str, reference: str, cents: int) -> tuple[str, str | None]:
    amount = f"{Decimal(cents) / 100:.2f}"
    payload = _signed(
        merchant, key, reference, QR_FIELDS, amount=amount, purchase_type="purchase",
        payment_option="abapay_khqr", currency="USD", lifetime=QR_MINUTES, qr_image_template="template3_color",
    )
    result = await asyncio.to_thread(_post, "generate-qr", payload)
    image = result.get("qrImage")
    if (
        str((result.get("status") or {}).get("code")) not in {"0", "00"}
        or not isinstance(image, str) or not PNG_DATA_URL.fullmatch(image)
        or result.get("currency") != "USD" or not _matches_amount(result.get("amount"), cents)
    ):
        raise AppError(502, "payway_qr_failed", "ABA PayWay could not generate the checkout code.")
    deeplink = result.get("abapay_deeplink")
    if not isinstance(deeplink, str) or not deeplink.startswith("abamobilebank://ababank.com?"):
        deeplink = None
    return image, deeplink


async def check(merchant: str, key: str, reference: str, cents: int, *, archived: bool = False) -> str:
    payload = _signed(merchant, key, reference, ("req_time", "merchant_id", "tran_id"))
    endpoint = "transaction-detail" if archived else "check-transaction-2"
    result = await asyncio.to_thread(_post, endpoint, payload)
    status = result.get("status") or {}
    data = result.get("data") or {}
    code = str(status.get("code"))
    if code == "6" and status.get("tran_id") == reference:
        return "pending"
    if code not in {"0", "00"} or status.get("tran_id") != reference:
        raise AppError(502, "payway_check_failed", "ABA PayWay could not confirm the payment status.")
    payment_status = data.get("payment_status")
    if payment_status == "APPROVED":
        if (
            str(data.get("payment_status_code")) != "0"
            or data.get("payment_currency") != "USD"
            or not _matches_amount(data.get("payment_amount"), cents)
            or not _matches_amount(data.get("total_amount"), cents)
        ):
            raise AppError(409, "payway_payment_mismatch", "The payment details did not match this checkout.")
        return "paid"
    return "closed" if payment_status in {"DECLINED", "CANCELLED", "EXPIRED", "REFUNDED"} else "pending"
