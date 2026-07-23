"""Data-driven navigation: MENUS (grouped items) and ROLES (which menu keys each
role may access). Seeded on startup; a user's sidebar is resolved from these."""

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


class Menu(Document):
    key: str          # unique menu id, e.g. "overview"
    section: str      # main-menu id, e.g. "management"
    section_label: str  # main-menu label, e.g. "Management"
    label: str        # item label, e.g. "Overview"
    icon: str         # icon name resolved on the frontend, e.g. "LayoutDashboard"
    order: int = 0

    class Settings:
        name = "menus"
        indexes = [IndexModel("key", unique=True)]


class RoleDef(Document):
    key: str          # "admin" | "teacher" | "parent" | "student"
    label: str
    # Menu keys this role can access. ["*"] means every menu ("rights" of the role).
    menu_keys: list[str] = Field(default_factory=list)

    class Settings:
        name = "roles"
        indexes = [IndexModel("key", unique=True)]
