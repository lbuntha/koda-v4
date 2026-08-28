"""Request-scoped dependencies that are not security.

Authentication, permissions and tenancy moved to `app.security` — one package
for everything that decides whether a request may happen. What is left here is
the database handle, which every router needs and nothing guards.
"""

from typing import Annotated

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app import db as database
from app.security import AUTHENTICATED, CurrentPrincipal, principal, require

__all__ = ["AUTHENTICATED", "CurrentPrincipal", "Db", "get_db", "principal", "require"]


def get_db() -> AsyncIOMotorDatabase:
    return database.db()


Db = Annotated[AsyncIOMotorDatabase, Depends(get_db)]
