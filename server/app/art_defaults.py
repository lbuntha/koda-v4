"""The bundled SVG snapshot used to initialise an empty Mongo database."""

import json
from importlib.resources import files
from typing import Any


def load_defaults() -> list[dict[str, Any]]:
    resource = files("app").joinpath("art_defaults.json")
    return json.loads(resource.read_text(encoding="utf-8"))
