"""Koda API — FastAPI app wiring: DB lifecycle, CORS, and router registration."""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import settings
from .core.logging import configure_logging, get_logger, redact
from .core.db import init_db, close_db
from .core.seed_menus import ensure_seed
from .core.seed_academic import ensure_academic_catalogs
from .features import ALL_ROUTERS


logger = get_logger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info(
        "starting environment=%s db=%s origins=%d",
        settings.environment, settings.mongo_db, len(settings.cors_origins),
    )
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

@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """Log what broke, and tell the caller nothing it could exploit.

    A reference is returned instead of the message so a report ("error 3f2a9c") can be tied to
    a log line without putting a stack trace, a query, or a learner's data on screen.
    """
    reference = uuid.uuid4().hex[:8]
    logger.exception(
        "unhandled error ref=%s %s %s params=%s",
        reference,
        request.method,
        request.url.path,
        redact(dict(request.query_params)),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side.", "reference": reference},
    )


for router in ALL_ROUTERS:
    app.include_router(router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
