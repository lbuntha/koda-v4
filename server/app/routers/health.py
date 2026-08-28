"""Liveness, and whether Mongo is actually reachable."""

from fastapi import APIRouter

from app import db as database
from app.settings import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    try:
        await database.ping()
        db_state = "ok"
    except Exception:  # noqa: BLE001 — the endpoint reports, it does not raise
        db_state = "unreachable"
    return {"status": "ok" if db_state == "ok" else "degraded", "db": db_state,
            "environment": settings().environment}
