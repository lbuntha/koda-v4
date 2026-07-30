"""Default menus + roles, and an idempotent seeder. Runs on startup so the
menu-driven sidebar always has data; existing rows are never overwritten."""

from ..models.menu import Menu, RoleDef

# Menus grouped into main-menu sections. Add entries here to register menus.
DEFAULT_MENUS = [
    {"key": "overview", "section": "general", "section_label": "General", "label": "Overview", "icon": "LayoutDashboard", "order": 1},
    {"key": "users", "section": "people", "section_label": "People", "label": "Users", "icon": "Users", "order": 2},
    {"key": "kids", "section": "people", "section_label": "People", "label": "Kids", "icon": "Baby", "order": 3},
    {"key": "access", "section": "system", "section_label": "System", "label": "Menus & Access", "icon": "SlidersHorizontal", "order": 4},
    {"key": "menus", "section": "system", "section_label": "System", "label": "Menu Designer", "icon": "ListTree", "order": 5},
    {"key": "studio", "section": "studio", "section_label": "Studio", "label": "Interactive Studio", "icon": "Palette", "order": 6},
    {"key": "assets", "section": "studio", "section_label": "Studio", "label": "SVG Assets", "icon": "PenTool", "order": 7},
    {"key": "curriculum", "section": "studio", "section_label": "Studio", "label": "Curriculum", "icon": "BookOpen", "order": 8},
    {"key": "assignments", "section": "studio", "section_label": "Studio", "label": "Assignments", "icon": "ClipboardList", "order": 9},
    {"key": "analytics", "section": "people", "section_label": "People", "label": "Learning progress", "icon": "BarChart3", "order": 9},
    {"key": "notifications", "section": "people", "section_label": "People", "label": "Notifications", "icon": "Bell", "order": 11},
    {"key": "settings", "section": "system", "section_label": "System", "label": "Settings", "icon": "Settings", "order": 10},
]

# Roles and the menu keys each may access. ["*"] = all (admin default).
DEFAULT_ROLES = [
    {"key": "admin", "label": "Admin", "menu_keys": ["*"]},
    {"key": "teacher", "label": "Teacher", "menu_keys": ["analytics", "studio", "assets", "curriculum", "assignments"]},
    {"key": "parent", "label": "Parent", "menu_keys": []},
    {"key": "student", "label": "Student", "menu_keys": []},
]


async def ensure_seed() -> None:
    for m in DEFAULT_MENUS:
        if not await Menu.find_one(Menu.key == m["key"]):
            await Menu(**m).insert()
    for r in DEFAULT_ROLES:
        existing = await RoleDef.find_one(RoleDef.key == r["key"])
        if not existing:
            await RoleDef(**r).insert()
        elif r["key"] == "teacher":
            missing = [key for key in r["menu_keys"] if key not in existing.menu_keys]
            if missing:
                existing.menu_keys.extend(missing)
                await existing.save()
