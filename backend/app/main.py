"""Koda API — FastAPI app wiring: DB lifecycle, CORS, and router registration."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.db import init_db, close_db
from .core.seed_menus import ensure_seed
from .core.seed_academic import ensure_academic_catalogs
from .features import ALL_ROUTERS


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await ensure_seed()  # idempotent: seed default menus + roles if missing
    await ensure_academic_catalogs()  # lift legacy embedded grade/subject data into canonical catalogs
    yield
    await close_db()


app = FastAPI(title="Koda API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in ALL_ROUTERS:
    app.include_router(router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
