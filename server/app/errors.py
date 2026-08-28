"""One exception type, one response shape.

Routers raise `AppError`; nothing raises a bare `HTTPException`, so an error the
client sees always has a machine-readable `code` beside the sentence.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message
        super().__init__(message)


class Unauthorized(AppError):
    def __init__(self, message: str = "Sign in to continue.", code: str = "unauthorized"):
        super().__init__(401, code, message)


class Forbidden(AppError):
    def __init__(self, message: str = "You do not have access to that.", code: str = "forbidden"):
        super().__init__(403, code, message)


class NotFound(AppError):
    def __init__(self, message: str = "Not found.", code: str = "not_found"):
        super().__init__(404, code, message)


class PaymentRequired(AppError):
    """The account may do this, but its plan does not include it.

    Deliberately not `Forbidden`: 403 says "not for you", and a client that sees
    it should stop asking. This says "not on this plan", and the right response
    is to offer the upgrade — which is a different screen and a different
    sentence, so it needs a different status.
    """

    def __init__(self, message: str, code: str = "plan_required"):
        super().__init__(402, code, message)


class Conflict(AppError):
    def __init__(self, message: str, code: str = "conflict"):
        super().__init__(409, code, message)


def install(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
