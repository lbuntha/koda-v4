"""Default menus + roles, and an idempotent seeder. Runs on startup so the
menu-driven sidebar always has data; existing rows are never overwritten."""

from ..models.menu import Menu, RoleDef

# Menus grouped into main-menu sections. Add entries here to register menus.
DEFAULT_MENUS = [
    {"key": "overview", "section": "general", "section_label": "General", "label": "Overview", "icon": "LayoutDashboard", "order": 1},
    {"key": "dashboard", "section": "parent", "section_label": "", "label": "Dashboard", "icon": "LayoutDashboard", "order": 1},
    {"key": "children", "section": "parent", "section_label": "", "label": "Children", "icon": "Users", "order": 2},
    {"key": "parent_settings", "section": "parent", "section_label": "", "label": "Settings", "icon": "Settings", "order": 3},
    {"key": "users", "section": "people", "section_label": "People", "label": "User Management", "icon": "Users", "order": 3},
    {"key": "access", "section": "system", "section_label": "System", "label": "Menus & Access", "icon": "SlidersHorizontal", "order": 4},
    {"key": "menus", "section": "system", "section_label": "System", "label": "Menu Designer", "icon": "ListTree", "order": 5},
    {"key": "studio", "section": "studio", "section_label": "Studio", "label": "Interactive Studio", "icon": "Palette", "order": 6},
    {"key": "assets", "section": "studio", "section_label": "Studio", "label": "SVG Assets", "icon": "PenTool", "order": 7},
    {"key": "mascots", "section": "studio", "section_label": "Studio", "label": "Mascot Studio", "icon": "Sparkles", "order": 8},
    {"key": "curriculum", "section": "studio", "section_label": "Studio", "label": "Curriculum", "icon": "BookOpen", "order": 9},
    {"key": "assignments", "section": "studio", "section_label": "Studio", "label": "Assignments", "icon": "ClipboardList", "order": 10},
    {"key": "analytics", "section": "people", "section_label": "People", "label": "Learning progress", "icon": "BarChart3", "order": 9},
    {"key": "notifications", "section": "people", "section_label": "People", "label": "Notifications", "icon": "Bell", "order": 11},
    {"key": "settings", "section": "system", "section_label": "System", "label": "System Settings", "icon": "Settings", "order": 10},
]

# Roles and the menu keys each may access. ["*"] = all (admin default).
DEFAULT_ROLES = [
    {"key": "admin", "label": "Admin", "menu_keys": ["*"]},
    {"key": "teacher", "label": "Teacher", "menu_keys": ["analytics", "studio", "assets", "mascots", "curriculum", "assignments"]},
    {"key": "parent", "label": "Parent", "menu_keys": ["dashboard", "children", "parent_settings"]},
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
        elif r["key"] == "admin":
            # Older installations may have an explicit admin menu list instead of
            # the current "*" wildcard. Preserve that customized list, but make
            # newly seeded management screens reachable by existing admins.
            if "*" not in existing.menu_keys and "mascots" not in existing.menu_keys:
                existing.menu_keys.append("mascots")
                await existing.save()
        elif r["key"] == "parent":
            if "parent_settings" not in existing.menu_keys:
                existing.menu_keys.append("parent_settings")
            if "settings" in existing.menu_keys:
                existing.menu_keys.remove("settings")
            await existing.save()
        elif r["key"] == "teacher":
            missing = [key for key in r["menu_keys"] if key not in existing.menu_keys]
            if missing:
                existing.menu_keys.extend(missing)
                await existing.save()
