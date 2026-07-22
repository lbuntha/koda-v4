"""Koda API — FastAPI app wiring: DB lifecycle, CORS, and router registration."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db, close_db
from .routers import auth, family, content, events, analytics, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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

app.include_router(auth.router)
app.include_router(family.router)
app.include_router(content.router)
app.include_router(events.router)
app.include_router(analytics.router)
app.include_router(ai.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
