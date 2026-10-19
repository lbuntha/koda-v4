"""Photos in Rebus puzzles, for anyone who is playing them.

A child who joined a group room as a guest has no account, so the library's
photo route (which needs one) cannot show them a picture. This one needs none,
and is safe to leave open for two reasons: a photo's address is the SHA-256 of
its bytes, which nobody can guess, and it only answers for a photo that a Rebus
puzzle actually shows. Anything else is "not found", whether it exists or not.
"""

from __future__ import annotations

import re

from fastapi import APIRouter
from fastapi.responses import Response

from app.deps import Db
from app.errors import NotFound
from app.repos import library as library_repo
from app.repos import rebus as repo
from app.routers.library import IMAGE_MAGIC

router = APIRouter(prefix="/rebus/images", tags=["rebus-images"])

IMAGE_ID = re.compile(r"[0-9a-f]{64}")


@router.get("/{image_id}")
async def get_image(image_id: str, db: Db) -> Response:
    if not IMAGE_ID.fullmatch(image_id) or not await repo.photo_in_use(db, image_id):
        raise NotFound("No such photo.", "image_not_found")
    row = await library_repo.get_image(db, image_id)
    if row is None or row.get("mime") not in IMAGE_MAGIC:
        raise NotFound("No such photo.", "image_not_found")
    return Response(
        content=bytes(row["data"]),
        media_type=row["mime"],
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )
