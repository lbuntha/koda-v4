"""Feature router registry. Add a feature = add its folder + one line here;
main.py spreads ALL_ROUTERS and never needs editing."""

from .auth.router import router as auth_router
from .family.router import router as family_router
from .content.router import router as content_router
from .events.router import router as events_router
from .analytics.router import router as analytics_router
from .ai.router import router as ai_router
from .admin.router import router as admin_router
from .menus.router import router as menus_router
from .settings.router import router as settings_router
from .placement.router import router as placement_router

ALL_ROUTERS = [
    auth_router,
    family_router,
    content_router,
    events_router,
    analytics_router,
    ai_router,
    admin_router,
    menus_router,
    settings_router,
    placement_router,
]
