"""The four saved styles a question's guide is cast from.

A canvas never asks for a mascot. It asks for a *moment* — the question is being
read out, the child is working, the answer was wrong, the board is finished — and
the frontend turns that into a style name to look up:

    talking      -> "Talking Style"
    waiting      -> "Waiting Style"
    oops         -> "Oops Style"
    celebrating  -> "Happy Style"

Nothing saved under those names means every moment resolves to the same artwork
and only the motion changes, which is the difference between a character who
reacts and one who is a sticker with an animation on it. So the shelf ships with
them, built the same way the starter mascots are: real documents made of real
Mascot Studio parts, editable the moment an author opens the editor.

Two rules keep the seeding safe:

  - **Never touch a name the owner already uses.** An account that already has a
    "Talking Style" has one because somebody drew it. Seeding is for the gaps.
  - **Never re-create what was deleted.** Seeding runs once per account, marked
    by any cast style existing at all — otherwise deleting the one you dislike
    would hand it straight back on the next page load.

They are deliberately one character in four moods: the same soft pentagon body
at the same size, changing eyes, mouth and palette. A child has to read them as
Koda feeling something, not as four different mascots taking turns.
"""

from datetime import datetime, timezone
from typing import Any

from ...models.mascot_style import MascotStyle

STYLE_VERSION = 1

#: Placement in the 256x256 mascot canvas, shared with the starter mascots so a
#: cast style and a hand-built one line up part for part.
PLACEMENT = {
    "body": (128, 143, 1.25),
    "eyes": (128, 126, 0.72),
    "mouth": (128, 164, 0.6),
}

INK = "#0E0B55"
WHITE = "#FFFFFF"

#: role -> (style name, eyes, mouth, body animation, seconds, primary, secondary, accent)
#:
#: The body carries the mood in how it moves — waiting drifts, oops shivers,
#: happy bounces — because motion reads before a face does at 124px across a
#: classroom.
CAST: dict[str, tuple[str, str, str, str, float, str, str, str]] = {
    "talking": ("Talking Style", "eyes-even", "mouth-open", "float", 2.6, "#5B50ED", "#4338CA", "#F9A8D4"),
    "waiting": ("Waiting Style", "eyes-side", "mouth-line", "float", 4.2, "#6366F1", "#4F46E5", "#C7D2FE"),
    "oops": ("Oops Style", "eyes-down", "mouth-o", "wiggle", 1.1, "#FB7185", "#E11D48", "#FECDD3"),
    "celebrating": ("Happy Style", "eyes-happy", "mouth-smile-big", "bounce", 1.0, "#34D399", "#0D9488", "#FDE68A"),
}

BODY = "body-soft-pentagon"


def _layer(asset_id: str, category: str, animation: str = "none", duration: float = 1.5) -> dict[str, Any]:
    x, y, scale = PLACEMENT[category]
    return {
        "id": f"{asset_id}-cast",
        "assetId": asset_id,
        "category": category,
        "name": asset_id.split("-", 1)[1].replace("-", " ").title(),
        "x": x, "y": y, "scale": scale,
        "rotation": 0, "opacity": 1, "visible": True,
        "animation": animation, "duration": duration, "delay": 0,
    }


def cast_document(role: str) -> dict[str, Any]:
    """One member of the cast, as a document the studio can open and edit."""
    name, eyes, mouth, body_animation, body_seconds, primary, secondary, accent = CAST[role]
    now = datetime.now(timezone.utc).isoformat()
    return {
        "schemaVersion": 1,
        "starterVersion": STYLE_VERSION,
        "id": f"mascot-cast-{role}",
        "name": name,
        "slug": f"koda-cast-{role}",
        # Not a studio "purpose" — these are cast by role, and `custom` is what
        # the studio shows for a document it should not file under a mood.
        "purpose": "custom",
        "description": f"Koda while {role}. Edit and save to make it yours.",
        "tags": ["cast", role],
        "canvas": {"width": 256, "height": 256, "viewBox": "0 0 256 256"},
        "palette": {"primary": primary, "secondary": secondary, "accent": accent, "ink": INK, "white": WHITE},
        "layers": [
            _layer(BODY, "body", body_animation, body_seconds),
            # Blink is on the eyes and nowhere else: it is what stops a face
            # looking like a decal, and it costs one animated layer.
            _layer(eyes, "eyes", "blink", 4),
            _layer(mouth, "mouth"),
        ],
        "createdAt": now,
        "updatedAt": now,
    }


def style_id(role: str) -> str:
    return f"mascot-style-cast-{role}"


async def seed_cast_styles(owner_id: str) -> None:
    """Put the cast on this owner's shelf, once, without overwriting anything."""
    rows = await MascotStyle.find(MascotStyle.owner_id == owner_id).to_list()

    # Any cast style present — even one the author has since renamed or edited —
    # means this account has been seeded. Re-seeding on every list would undo a
    # deletion the author meant.
    already_seeded = any(row.style_id.startswith("mascot-style-cast-") for row in rows)
    if already_seeded:
        return

    taken = {row.name.strip().casefold() for row in rows}
    now = datetime.now(timezone.utc)

    for role in CAST:
        document = cast_document(role)
        # A name the owner already uses belongs to the owner. Skip the role
        # rather than shadowing their work with a second style of the same name.
        if document["name"].strip().casefold() in taken:
            continue
        await MascotStyle(
            owner_id=owner_id,
            style_id=style_id(role),
            name=document["name"],
            document=document,
            created_at=now,
            updated_at=now,
        ).insert()
