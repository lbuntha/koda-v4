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
    {"itemId": "home", "label": "Home", "icon": "home", "order": 10},
    {"itemId": "game", "label": "Learn", "icon": "game", "order": 20},
    {"itemId": "profile", "label": "Profile", "icon": "user", "order": 25},
    {"itemId": "skills", "label": "Skills", "icon": "brain", "badge": "Manage",
     "requires": "content:write", "order": 30},
    {"itemId": "assets", "label": "Art", "icon": "shapes", "badge": "{art} SVG",
     "requires": "content:write", "order": 40},
    {"itemId": "users", "label": "Users", "icon": "users", "badge": "Manage",
     "requires": "user:manage", "order": 45},
    {"itemId": "roles", "label": "Roles", "icon": "shield", "badge": "Access",
     "requires": "role:manage", "order": 50},
    {"itemId": "children", "label": "Children", "icon": "baby", "badge": "Family",
     "requires": "learner:create", "order": 52},
    # No Devices row. The device list is a section of Settings now — it is read
    # once when a tablet goes missing, not navigated to, and a permanent sidebar
    # row for it cost more attention than it was worth. `prune_orphans` deletes
    # the seeded row (and any family's override of it) on the next boot, which
    # is why removing it from this list is the whole change.
    {"itemId": "menu", "label": "Menu", "icon": "list", "badge": "Sidebar",
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
    {"itemId": "koda", "label": "Ask Koda", "icon": "sparkles", "badge": "Assistant",
     "requires": "system:write", "order": 57},
    {"itemId": "admin", "label": "Admin", "icon": "sliders", "badge": "Manage",
     "requires": "system:write", "order": 58},
    {"itemId": "settings", "label": "Settings", "icon": "settings", "order": 60},
]
