"""Corrections to the app's wording, per language.

Read by every device, signed in or not. The sign-in screen is the first thing a
family reads, and it is shown before there is a session — a correction that
only reached signed-in devices would leave the front door wrong. Nothing here
is about a person: the rows are the app's own labels.

Written only with `content:write`, the right that already governs the shared
content library. A family role never holds it.
"""

import re
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from pydantic import field_validator

from app.deps import Db, require
from app.errors import AppError, NotFound
from app.models.auth import Principal
from app.models.common import Model
from app.repos import translations as repo

router = APIRouter(prefix="/translations", tags=["translations"])

CanEdit = Annotated[Principal, Depends(require("content:write"))]

#: BCP 47-ish: `km`, `en`, `pt-BR`.
LANG = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")
#: A catalog path: `signIn.headline`, `app.pwaStatus.update`.
KEY = re.compile(r"^[A-Za-z0-9_$-]+(\.[A-Za-z0-9_$-]+)*$")
PLURAL_FORMS = {"zero", "one", "two", "few", "many", "other"}
#: Longer than any label the app has; short enough that a paste of a whole
#: document is refused rather than shipped to every device.
TEXT_MAX = 2000


class TextIn(Model):
    text: str | dict[str, str]

    @field_validator("text")
    @classmethod
    def _check(cls, value: str | dict[str, str]) -> str | dict[str, str]:
        if isinstance(value, dict):
            if "other" not in value or not set(value) <= PLURAL_FORMS:
                raise ValueError("A plural message needs an 'other' form and only CLDR form names.")
            texts = list(value.values())
        else:
            texts = [value]
        for text in texts:
            if not text.strip():
                raise ValueError("A translation cannot be empty — reset it to use the built-in text.")
            if len(text) > TEXT_MAX:
                raise ValueError(f"Keep a translation under {TEXT_MAX} characters.")
        return value


def _check_ids(lang: str, key: str) -> None:
    if not LANG.match(lang) or not KEY.match(key) or len(key) > 200:
        raise AppError(400, "bad_key", "That is not a language code and message key.")


@router.get("")
async def overrides(db: Db, response: Response) -> dict[str, Any]:
    """`{updatedAt, overrides: {lang: {key: text}}}` — for any device, no session needed."""
    # Revalidated every time: a correction should reach the next page load,
    # and the payload is small.
    response.headers["Cache-Control"] = "no-cache"
    out: dict[str, dict[str, Any]] = {}
    for row in await repo.all_rows(db):
        out.setdefault(row["lang"], {})[row["key"]] = row["text"]
    return {"updatedAt": await repo.last_change(db), "overrides": out}


@router.put("/{lang}/{key}")
async def save(lang: str, key: str, body: TextIn, db: Db, p: CanEdit) -> dict[str, Any]:
    _check_ids(lang, key)
    row = await repo.put(db, lang, key, body.text, p.subject_id)
    return {"lang": lang, "key": key, "text": row["text"], "updatedAt": row["updatedAt"].isoformat()}


@router.delete("/{lang}/{key}", status_code=204)
async def reset(lang: str, key: str, db: Db, p: CanEdit) -> Response:
    """Back to the text the app ships with."""
    _check_ids(lang, key)
    if not await repo.remove(db, lang, key):
        raise NotFound("That message has no correction to remove.")
    return Response(status_code=204)
