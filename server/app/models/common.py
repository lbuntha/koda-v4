"""Shapes shared by every model. Storage details stay out of here."""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict


class Model(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


def now() -> datetime:
    return datetime.now(UTC)
