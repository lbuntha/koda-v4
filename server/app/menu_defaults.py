"""The sidebar a fresh database starts with.

Kept here rather than in the CLI because startup seeds it too: a deployment
should not need a second command before the app has a menu, and an empty
`menu_items` collection would leave every family with the bundled fallback and
no way to change it.

Seeding is *create-if-absent*. An edited default survives a restart — otherwise
every deploy would quietly undo somebody's change. (Visibility is the exception:
`requires`/`roles` are re-applied on boot, because who may see a page is the
code's decision. See `repos/menu.reconcile_visibility`.)

`{lessons}` and `{art}` in a label or badge are replaced by the client with live
counts, so an entry can show a real number without the sidebar having to
hard-code the wording around it.
"""

DEFAULT_MENU: list[dict] = [
    {"itemId": "home", "label": "Home", "icon": "art:menu-home", "order": 10},
    {"itemId": "game", "label": "Learn", "icon": "art:menu-learn", "order": 20},
    # No Library or Trace rows. Books and Write & Draw are categories inside
    # Learn now, beside the lessons — one place for a child to go rather than
    # three. `prune_orphans` removes the old rows on the next boot.
    {"itemId": "profile", "label": "Profile", "icon": "art:menu-profile", "order": 25},
    {"itemId": "leaderboard", "label": "Leaderboard", "icon": "art:menu-leaderboard",
     "requires": "learner:read", "order": 26},
    # Family notifications are for adults; notification settings are an
    # operator feature and are grouped under Admin by `system:write`.
    {"itemId": "notifications", "label": "Notifications", "icon": "art:menu-notifications",
     "requires": "member:list", "order": 27},
    {"itemId": "notification-settings", "label": "Notification Settings", "icon": "art:menu-notification-settings",
     "requires": "system:write", "order": 28},
    {"itemId": "skills", "label": "Skills", "icon": "art:menu-skills", "badge": "Manage",
     "requires": "content:write", "order": 30},
    {"itemId": "subjects", "label": "Subjects", "icon": "art:menu-subjects",
     "requires": "content:write", "order": 35},
    # Corrections to the app's wording, per language. Same gate as Art: it
    # changes what every family on the service reads.
    {"itemId": "translations", "label": "Translations", "icon": "languages",
     "requires": "content:write", "order": 38},
    {"itemId": "assets", "label": "Art", "icon": "art:menu-art", "badge": "{art} SVG",
     "requires": "content:write", "order": 40},
    # Where library books are written, reviewed and published. Same gate as Art.
    {"itemId": "library-studio", "label": "Library Studio", "icon": "art:menu-library-studio",
     "requires": "content:write", "order": 42},
    # Where trace items and collections are made and published. Its own grant
    # (`trace:create`), which a Koda admin gives to chosen adults.
    {"itemId": "trace-studio", "label": "Trace Studio", "icon": "art:menu-trace-studio",
     "requires": "trace:create", "order": 43},
    {"itemId": "users", "label": "Users", "icon": "art:menu-users", "badge": "Manage",
     "requires": "user:manage", "order": 45},
    {"itemId": "roles", "label": "Roles", "icon": "art:menu-roles", "badge": "Access",
     "requires": "role:manage", "order": 50},
    {"itemId": "children", "label": "Children", "icon": "art:menu-children", "badge": "Family",
     "requires": "learner:create", "order": 52},
    # No Devices row. The device list is a section of Settings now — it is read
    # once when a tablet goes missing, not navigated to, and a permanent sidebar
    # row for it cost more attention than it was worth. `prune_orphans` deletes
    # the seeded row (and any family's override of it) on the next boot, which
    # is why removing it from this list is the whole change.
    {"itemId": "menu", "label": "Menu", "icon": "art:menu-menu", "badge": "Sidebar",
     "requires": "menu:manage", "order": 55},
    # Two rows, and the split is by *whose decision it is* rather than by
    # seniority. Admin holds what one person decides for everybody — the XP
    # rates, the badges, the plans, the deployment's switches. Settings holds
    # what belongs to the person looking at it: their screen, their sound, their
    # plan. Both are tabbed, so neither grows a sidebar row when a tab is added.
    #
    # Staff only. `system:write` is a platform right no family role holds and no
    # grant can hand out, so an owner running their own family never sees this
    # row — which is the point: Admin is for whoever runs the service.
    # Its own row rather than a sixth Admin tab, because it is the one feature
    # this product sells and the one an operator comes back to: whether Koda
    # answers at all, what kinds of help it gives, and the key it calls with.
    # Same right as Admin — it is a ceiling over every family, not a setting.
    {"itemId": "koda", "label": "Ask Koda", "icon": "art:menu-koda", "badge": "Assistant",
     "requires": "system:write", "order": 57},
    {"itemId": "admin", "label": "Admin", "icon": "art:menu-admin", "badge": "Manage",
     "requires": "system:write", "order": 58},
    {"itemId": "settings", "label": "Settings", "icon": "art:menu-settings", "order": 60},
]

# Every row wears drawn artwork (src/assets/svg/menu) rather than line
# glyphs. These are the glyphs they shipped with, so boot can move an untouched
# row onto its artwork by exact match and leave an icon somebody chose alone.
LEGACY_ICONS: dict[str, str] = {
    "home": "home",
    "game": "game",
    "profile": "user",
    "leaderboard": "leaderboard",
    "settings": "settings",
    "notifications": "bell",
    "notification-settings": "bell",
    "skills": "brain",
    "subjects": "list",
    "assets": "shapes",
    "library-studio": "pen",
    "trace-studio": "pencil",
    "users": "users",
    "roles": "shield",
    "children": "baby",
    "menu": "list",
    "koda": "sparkles",
    "admin": "sliders",
}
