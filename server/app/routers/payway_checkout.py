"""Family checkout and fulfillment for ABA PayWay's test environment."""

from datetime import datetime, timedelta
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.deps import AUTHENTICATED, Db, require
from app.errors import AppError, BadRequest, Conflict, Forbidden, NotFound
from app.models.auth import Principal
from app.models.common import Model, now
from app.repos import plans, upgrade_requests
from app.services import payway
from app.services.entitlements import effective_plan
from app.settings import settings

router = APIRouter(prefix="/billing/checkout", tags=["billing"], dependencies=[AUTHENTICATED])


def _family(p: Annotated[Principal, Depends(require("family:update"))]) -> str:
    if not settings().is_dev or not p.family_id:
        raise Forbidden("PayWay sandbox checkout is only available to test families.")
    return p.family_id


CheckoutFamily = Annotated[str, Depends(_family)]


class CheckoutIn(Model):
    plan_id: str = Field(alias="planId", max_length=32)


class CheckoutOut(Model):
    reference: str = Field(validation_alias="_id")
    plan_name: str = Field(alias="planName")
    amount_cents: int = Field(alias="amountCents")
    currency: str
    expires_at: datetime = Field(alias="expiresAt")
    status: Literal["pending", "paid", "closed"]
    qr_image: str | None = Field(default=None, alias="qrImage")
    deep_link: str | None = Field(default=None, alias="deepLink")


class CheckoutState(Model):
    available: bool
    checkout: CheckoutOut | None = None


def _out(row: dict) -> CheckoutOut:
    status = row["status"]
    details = row if status == "pending" and row["expiresAt"] > now() else {
        **row, "qrImage": None, "deepLink": None,
    }
    return CheckoutOut.model_validate(details)


async def _open(db: Db, family: str) -> dict | None:
    row = await db.billing_payments.find_one({"familyId": family, "open": True})
    # An interrupted generation never disclosed a QR code. Unlock the family once
    # the request timeout has passed, unless the generator has since saved its QR.
    if row and row["status"] == "creating" and row["createdAt"] < now() - timedelta(seconds=30):
        await db.billing_payments.update_one(
            {"_id": row["_id"], "status": "creating"}, {"$set": {"open": False, "status": "closed"}},
        )
        return await db.billing_payments.find_one({"familyId": family, "open": True})
    return row


@router.get("")
async def state(db: Db, family: CheckoutFamily) -> CheckoutState:
    row = await _open(db, family)
    return CheckoutState(
        available=await payway.credentials(db) is not None,
        checkout=_out(row) if row and row["status"] == "pending" else None,
    )


@router.post("")
async def create(body: CheckoutIn, db: Db, family: CheckoutFamily) -> CheckoutOut:
    key = await payway.credentials(db)
    if key is None:
        raise AppError(503, "payway_not_configured", "ABA PayWay sandbox credentials are unavailable.")
    existing = await _open(db, family)
    if existing:
        if existing["status"] == "pending":
            return _out(existing)
        raise Conflict("Your checkout is being created. Try again in a moment.")

    plan = await plans.by_id(db, body.plan_id)
    if not plan or plan.get("currency") != "USD" or not plan.get("priceCents", 0) > 0:
        raise BadRequest("Choose a paid USD plan.")
    current, _ = await effective_plan(db, family)
    if current["_id"] == body.plan_id:
        raise Conflict("This family already has this plan.")

    started = now()
    row = {
        "_id": uuid4().hex[:20], "familyId": family, "merchantId": key[0], "source": "payway:sandbox",
        "planId": body.plan_id, "planName": plan["name"], "amountCents": plan["priceCents"], "currency": "USD",
        "status": "creating", "open": True, "createdAt": started,
        "expiresAt": started + timedelta(minutes=payway.QR_MINUTES),
    }
    try:
        await db.billing_payments.insert_one(row)
    except DuplicateKeyError:
        raise Conflict("Your checkout is being created. Try again in a moment.") from None
    try:
        image, link = await payway.generate_qr(*key, row["_id"], row["amountCents"])
    except AppError:
        await db.billing_payments.update_one(
            {"_id": row["_id"], "status": "creating"}, {"$set": {"status": "closed", "open": False}},
        )
        raise

    updated = await db.billing_payments.find_one_and_update(
        {"_id": row["_id"], "status": "creating"},
        {"$set": {"status": "pending", "qrImage": image, "deepLink": link}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise Conflict("Checkout timed out. Start a new checkout.")
    return _out(updated)


async def _fulfill(db: Db, row: dict) -> None:
    # The entitlement and its payment marker are written atomically in Mongo.
    # If the receipt update fails afterward, checking again can finish it.
    reference, plan, paid_at = row["_id"], row["planId"], row["paidAt"]
    already_applied = {"$in": [reference, {"$ifNull": ["$appliedSandboxPayments", []]}]}
    extend = {"$and": [
        {"$eq": ["$planId", plan]}, {"$in": ["$status", ["active", "trialing"]]},
        {"$gt": ["$currentPeriodEnd", paid_at]},
    ]}
    period_end = {"$add": [{"$cond": [extend, "$currentPeriodEnd", paid_at]}, 30 * 86_400_000]}
    changes = {
        "planId": plan, "status": "active", "source": "payway:sandbox", "updatedAt": paid_at,
        "currentPeriodEnd": period_end,
        "appliedSandboxPayments": {"$concatArrays": [{"$ifNull": ["$appliedSandboxPayments", []]}, [reference]]},
    }
    await db.subscriptions.update_one(
        {"_id": row["familyId"]},
        [{"$set": {field: {"$cond": [already_applied, f"${field}", value]} for field, value in changes.items()}}],
        upsert=True,
    )
    await upgrade_requests.answer(db, row["familyId"], plan)
    await db.billing_payments.update_one(
        {"_id": reference, "status": "pending"},
        {"$set": {"status": "paid", "open": False}, "$unset": {"qrImage": "", "deepLink": ""}},
    )


@router.post("/{reference}/check")
async def check(reference: str, db: Db, family: CheckoutFamily) -> CheckoutOut:
    selector = {"_id": reference, "familyId": family, "source": "payway:sandbox"}
    row = await db.billing_payments.find_one(selector)
    if not row or row["status"] == "creating":
        raise NotFound("No such checkout.")
    if row["status"] != "pending":
        return _out(row)
    if not row.get("paidAt"):
        key = await payway.credentials(db)
        if not key or key[0] != row["merchantId"]:
            raise AppError(503, "payway_not_configured", "The original ABA sandbox merchant is unavailable.")
        archived = row["createdAt"] < now() - timedelta(days=7)
        retry_after = now() - timedelta(seconds=60 if archived else 12)
        # Other devices may check the same family checkout at the same time.
        attempt = await db.billing_payments.update_one(
            {**selector, "status": "pending", "paidAt": {"$exists": False}, "$or": [
                {"lastCheckedAt": {"$exists": False}}, {"lastCheckedAt": {"$lt": retry_after}},
            ]},
            {"$set": {"lastCheckedAt": now()}},
        )
        if not attempt.modified_count:
            return _out(row)
        result = await payway.check(*key, reference, row["amountCents"], archived=archived)
        if result == "paid":
            await db.billing_payments.update_one(
                {**selector, "status": "pending", "paidAt": {"$exists": False}},
                {"$set": {"paidAt": now()}},
            )
        elif result == "closed" or now() > row["expiresAt"] + timedelta(minutes=1):
            await db.billing_payments.update_one(
                {**selector, "status": "pending", "paidAt": {"$exists": False}},
                {"$set": {"status": "closed", "open": False}, "$unset": {"qrImage": "", "deepLink": ""}},
            )

    row = await db.billing_payments.find_one(selector)
    if row is None:
        raise NotFound("No such checkout.")
    if row["status"] == "pending" and row.get("paidAt"):
        await _fulfill(db, row)
        row = {**row, "status": "paid"}
    return _out(row)
