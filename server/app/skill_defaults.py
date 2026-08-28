"""Bundled skill registrations used to initialise Mongo on deployment."""

import json
from importlib.resources import files
from typing import Any


def load_defaults() -> list[dict[str, Any]]:
    resource = files("app").joinpath("skill_defaults.json")
    return json.loads(resource.read_text(encoding="utf-8"))
