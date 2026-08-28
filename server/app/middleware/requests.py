"""Request id and access logging.

Every response carries `X-Request-Id`, and every line the service logs about a
request carries the same value — which is what makes a support report ("it broke
at 14:02") findable later.
"""

import logging
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

log = logging.getLogger("koda.api.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, header: str = "X-Request-Id"):
        super().__init__(app)
        self.header = header

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(self.header) or uuid4().hex[:16]
        request.state.request_id = request_id

        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000

        response.headers[self.header] = request_id
        log.info(
            "%s %s → %s in %.1fms [%s]",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )
        return response
