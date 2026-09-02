"""The app factory.

Routers are mounted under /v1 here and nowhere else, so the version prefix is
one string rather than a decoration on every route.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db as database
from app import errors
from app.art_defaults import load_defaults as load_art_defaults
from app.indexes import ensure_indexes
from app.menu_defaults import DEFAULT_MENU
from app.middleware.requests import RequestContextMiddleware
from app.persona_defaults import DEFAULT_PERSONAS
from app.plan_defaults import DEFAULT_PLANS
from app.repos import art as art_repo
from app.repos import defaults as defaults_repo
from app.repos import menu as menu_repo
from app.repos import personas as personas_repo
from app.repos import plans as plans_repo
from app.repos import platform_roles as platform_roles_repo
from app.repos import skills as skills_repo
from app.repos import system as system_repo
from app.role_defaults import DEFAULT_PLATFORM_ROLES
from app.routers import (
    admin_roles,
    admin_users,
    art,
    auth,
    billing,
    defaults,
    devices,
    family,
    health,
    learners,
    menu,
    personas,
    profile,
    push,
    skill_registrations,
    skills,
    sync,
    system,
)
from app.settings import settings
from app.skill_defaults import load_defaults as load_skill_defaults
from app.system_defaults import DEFAULT_SETTINGS

log = logging.getLogger("koda.api")

API_PREFIX = "/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = settings()
    if not cfg.is_dev and cfg.jwt_secret.startswith("dev-only-change-me"):
        raise RuntimeError("JWT_SECRET is still the development default — refusing to start.")

    db = database.connect()
    await ensure_indexes(db)

    # The sidebar has to exist for a deployment to be usable, so it is seeded
    # here rather than by a second command somebody has to remember.
    seeded = sum([await menu_repo.seed_default(db, item) for item in DEFAULT_MENU])
    if seeded:
        log.info("seeded %s default menu items", seeded)

    # Seeding only inserts, so a gate tightened in `menu_defaults.py` would
    # never reach a database that already has the row. Who may see an entry is
    # the code's decision, so it is re-applied on every boot — except where an
    # operator has pinned it from the Menu screen.
    regated = sum([await menu_repo.reconcile_visibility(db, item) for item in DEFAULT_MENU])
    if regated:
        log.info("re-applied visibility to %s menu items", regated)

    # Learn now opens a skill catalog. Lesson totals live inside each selected
    # skill, so retire the old sidebar badge only when it is still exactly the
    # value Koda shipped; a publisher's custom badge remains theirs.
    if await menu_repo.remove_legacy_badge(db, "game", "{lessons} Levels"):
        log.info("removed the legacy lesson-count badge from Learn")
    if await menu_repo.remove_legacy_badge(db, "home", "Pathway"):
        log.info("removed the legacy Pathway badge from Dashboard")
    if await menu_repo.replace_legacy_label(db, "home", "Dashboard", "Home"):
        log.info("renamed the legacy Dashboard menu item to Home")

    # Profile and Settings no longer carry a badge. Both said what the row
    # already says — a badge earns its place by adding something the label does
    # not. Retired by exact match, so an operator's own wording stays theirs.
    if await menu_repo.remove_legacy_badge(db, "profile", "You"):
        log.info("removed the legacy You badge from Profile")
    if await menu_repo.remove_legacy_badge(db, "settings", "Preferences"):
        log.info("removed the legacy Preferences badge from Settings")

    # And an entry the code has stopped shipping is not hidden, it is gone: it
    # leads nowhere, and an operator editing the Menu screen should not be
    # offered a row they cannot make work.
    pruned = await menu_repo.prune_orphans(db, {item["itemId"] for item in DEFAULT_MENU})
    if pruned:
        log.info("pruned %s menu items the code no longer ships", pruned)

    art_seeded = sum([await art_repo.seed_default(db, item) for item in load_art_defaults()])
    if art_seeded:
        log.info("seeded %s default art assets", art_seeded)

    skill_seeded = sum([await skills_repo.seed_default(db, item) for item in load_skill_defaults()])
    if skill_seeded:
        log.info("registered %s bundled skills", skill_seeded)

    # Same rule as the menu: a switch an operator has thrown survives a deploy,
    # and a deployment that has never been configured still has every answer.
    # Plans have to exist before anyone can be on one — and the free plan is the
    # floor every lapsed subscription falls back to, so a deployment without it
    # would have nothing to refuse a family down to.
    planned = sum([await plans_repo.seed_default(db, plan) for plan in DEFAULT_PLANS])
    if planned:
        log.info("seeded %s subscription plans", planned)

    # Scoring, the streak rule and the badges were family documents until they
    # became the deployment's. A family that had already tuned them keeps what
    # they tuned; see `adopt_family_rules`.
    adopted = await defaults_repo.adopt_family_rules(db)
    if adopted:
        log.info("adopted %s tuned rule sets as deployment defaults", adopted)

    switches = sum([await system_repo.seed_default(db, item) for item in DEFAULT_SETTINGS])
    if switches:
        log.info("seeded %s system settings", switches)

    # Who Koda can be. Seeded here for the reason the menu is: a deployment
    # should not need a second command before the assistant has a teacher, and
    # an empty roster would leave every child with no character at all.
    characters = sum([await personas_repo.seed_default(db, row) for row in DEFAULT_PERSONAS])
    if characters:
        log.info("seeded %s Koda characters", characters)

    roles = sum(
        [await platform_roles_repo.seed_default(db, role) for role in DEFAULT_PLATFORM_ROLES]
    )
    if roles:
        log.info("seeded %s platform roles", roles)

    log.info("connected to %s", cfg.mongodb_db)
    yield
    await database.close()


def _configure_logging(cfg) -> None:
    """Make the service's own loggers actually appear.

    Without this they do not. Uvicorn configures `uvicorn.*` and nothing else,
    and the root logger defaults to WARNING — so every `log.info` under `koda.*`
    was written, formatted and thrown away. Two things had been quietly missing
    the whole time: the request access log in `middleware/requests.py`, and the
    console mail driver, whose entire job is to put a reset link somewhere a
    developer can read it.

    `force=True` because uvicorn has already installed a root handler by the
    time the factory runs; without it `basicConfig` is a no-op and this comment
    would be describing a fix that does nothing.
    """
    logging.basicConfig(
        level=logging.INFO if cfg.is_dev else logging.WARNING,
        format="%(levelname)s [%(name)s] %(message)s",
        force=True,
    )
    # The service's own loggers stay at INFO in production too: an access log
    # and a failed send are what you read an incident from.
    logging.getLogger("koda").setLevel(logging.INFO)


def create_app() -> FastAPI:
    cfg = settings()
    _configure_logging(cfg)
    app = FastAPI(
        title="Koda API",
        version="0.1.0",
        summary="Sync, accounts and roles for Koda — see docs/BACKEND.md",
        lifespan=lifespan,
        # The schema is the one thing here that answers without a token, so it
        # is only served in development. In production it would hand anyone a
        # map of every route and body shape for nothing.
        docs_url=f"{API_PREFIX}/docs" if cfg.is_dev else None,
        openapi_url=f"{API_PREFIX}/openapi.json" if cfg.is_dev else None,
        redoc_url=None,
    )

    # Only needed when the app is served from another origin; same-origin
    # deployments go through the Express /v1 proxy and never preflight.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_middleware(RequestContextMiddleware)

    errors.install(app)

    for router in (
        health.router,
        auth.router,
        admin_roles.router,
        admin_users.router,
        art.router,
        billing.router,
        defaults.router,
        devices.router,
        family.router,
        learners.router,
        menu.router,
        personas.router,
        profile.router,
        push.router,
        skill_registrations.router,
        sync.router,
        system.router,
        skills.router,
    ):
        app.include_router(router, prefix=API_PREFIX)

    return app


app = create_app()
