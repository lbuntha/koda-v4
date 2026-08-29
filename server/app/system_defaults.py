"""The system settings a deployment ships with — the admin's switchboard.

Global, not per family. Everything else in this service is scoped to one
family; these are the deployment's own answers, and they are a **ceiling**: a
family may switch a thing off for themselves, but nothing they do can switch on
what the admin has switched off. That is why the client is told the effective
values on every load, and why the routes that matter check them again.

Kept in code rather than in the database, for the same reason the menu is: a
setting needs something behind it, which is a release, not a row. The database
holds the *values*; this holds what a value means.
"""

#: Types a setting's value may take.
#:
#: `bool` is the switchboard. `text` exists because "disable this" is not the
#: only thing an operator needs to say to everybody at once — see
#: `system.notice`. `secret` is the same row with one rule attached: its value
#: is never in a response a browser can ask for, only its hint. That rule is
#: what lets a credential live in this collection beside the switches instead of
#: in a second one.
SETTING_TYPES = ("bool", "text", "secret")

DEFAULT_SETTINGS: list[dict] = [
    # ---- Ask Koda. The assistant, and the one credential it needs.
    # ----
    # ---- One master and four capabilities, rather than a single "AI" flag or
    # ---- four flags with nothing above them. The master is the question an
    # ---- operator actually asks — "is Koda running here at all" — and the
    # ---- four below it are what a deployment pays for separately, which is
    # ---- why they stayed separate. `KODA_CAPABILITIES` is what joins them.
    {
        "settingId": "ai.enabled",
        "group": "Ask Koda",
        "label": "Ask Koda",
        "description": (
            "The assistant itself. Off stops every kind of help below it, "
            "whatever those switches say and whatever a family has paid for."
        ),
        "type": "bool",
        "value": True,
        "order": 5,
    },
    {
        "settingId": "ai.chat",
        "group": "Ask Koda",
        "label": "Socratic chat",
        "description": "Koda's written replies while a learner works through a problem.",
        "type": "bool",
        "value": True,
        "order": 10,
    },
    {
        "settingId": "ai.speech",
        "group": "Ask Koda",
        "label": "Spoken guidance",
        "description": "Gemini text-to-speech. Off falls back to the browser's own voice.",
        "type": "bool",
        "value": True,
        "order": 20,
    },
    {
        "settingId": "ai.liveVoice",
        "group": "Ask Koda",
        "label": "Live voice coach",
        "description": "The real-time spoken conversation. The most expensive call in the app.",
        "type": "bool",
        "value": True,
        "order": 30,
    },
    {
        "settingId": "ai.whiteboard",
        "group": "Ask Koda",
        "label": "Whiteboard analysis",
        "description": "Reading a learner's drawing and responding to it.",
        "type": "bool",
        "value": True,
        "order": 40,
    },
    {
        # Appearance, not a capability — nothing is switched off here, Koda just
        # stops wearing its tile. It sits in this group because an operator
        # looking for it will look under the button it belongs to, not under a
        # "theming" heading that would exist for this one row.
        "settingId": "ui.kodaBackdrop",
        "group": "Ask Koda",
        "label": "Koda sits on a tile",
        "description": (
            "A soft rounded panel behind the floating Koda. On a busy page it is "
            "what keeps the character readable; off, Koda stands on the page itself."
        ),
        "type": "bool",
        "value": True,
        "order": 44,
    },
    {
        "settingId": "ai.geminiApiKey",
        "group": "Ask Koda",
        "label": "Gemini API key",
        "description": "What the tutor calls Gemini with. Blank falls back to the deployment's GEMINI_API_KEY.",
        "type": "secret",
        "value": "",
        "order": 45,
    },
    # ---- Artwork. A different job with different keys: the Art page drawing
    # ---- an SVG has nothing to do with a child asking Koda a question, and
    # ---- putting them under one heading made both harder to find.
    {
        "settingId": "ai.artGeneration",
        "group": "Artwork",
        "label": "Draw artwork from a prompt",
        "description": "The Art page asking a model for an SVG. Off leaves pasting markup by hand, which is unaffected.",
        "type": "bool",
        "value": True,
        "order": 46,
    },
    {
        "settingId": "ai.openaiApiKey",
        "group": "Artwork",
        "label": "ChatGPT (OpenAI) API key",
        "description": "Used when artwork is drawn by ChatGPT. Blank falls back to the deployment's OPENAI_API_KEY.",
        "type": "secret",
        "value": "",
        "order": 47,
    },
    {
        "settingId": "ai.anthropicApiKey",
        "group": "Artwork",
        "label": "Claude (Anthropic) API key",
        "description": "Used when artwork is drawn by Claude. Blank falls back to the deployment's ANTHROPIC_API_KEY.",
        "type": "secret",
        "value": "",
        "order": 48,
    },
    {
        "settingId": "ai.artProvider",
        "group": "Artwork",
        "label": "Default art model",
        "description": "Which model draws artwork when nobody picks: 'gemini', 'chatgpt' or 'claude'. Each uses its own key.",
        "type": "text",
        "value": "gemini",
        "order": 49,
    },
    # ---- Account and sync. The levers an operator reaches for on a bad day.
    {
        "settingId": "account.signupOpen",
        "group": "Accounts & sync",
        "label": "Open signup",
        "description": "Whether a new family may create an account. Off does not affect anyone already signed in.",
        "type": "bool",
        "value": True,
        "order": 50,
    },
    {
        "settingId": "sync.enabled",
        "group": "Accounts & sync",
        "label": "Sync",
        "description": "Devices uploading rounds and settings. Off leaves every app working offline — nothing is lost, it queues.",
        "type": "bool",
        "value": True,
        "order": 60,
    },
    {
        "settingId": "system.readOnly",
        "group": "Accounts & sync",
        "label": "Maintenance mode",
        "description": "Refuse every write while keeping the app readable. For a migration, not a punishment.",
        "type": "bool",
        "value": False,
        "order": 70,
    },
    {
        "settingId": "system.notice",
        "group": "Accounts & sync",
        "label": "Notice to everyone",
        "description": "Shown at the top of the app on every device. Blank shows nothing.",
        "type": "text",
        "value": "",
        "order": 80,
    },
]

#: `settingId` -> its definition, for validating a write without a database hit.
BY_ID = {item["settingId"]: item for item in DEFAULT_SETTINGS}

#: The switch that governs the assistant as a whole.
KODA_MASTER = "ai.enabled"

#: What it governs. Everything a child experiences as "Koda helping", and
#: nothing else — drawing artwork on the Art page is not Koda answering a child.
KODA_CAPABILITIES = frozenset({"ai.chat", "ai.speech", "ai.liveVoice", "ai.whiteboard"})


def with_master_applied(values: dict) -> dict:
    """The switchboard as it is actually enforced, master included.

    Composed here, once, rather than by each caller remembering to ask two
    questions. `GET /system` is the only thing every client and the tutor proxy
    both read, so applying it there means a capability can never read `true`
    anywhere while the assistant is off — the failure this is written to
    prevent, because it looks like a bug in the app rather than an operator's
    decision.

    The stored rows are untouched: switching Koda back on has to restore exactly
    the capabilities that were on before, so the master hides them, never
    overwrites them.
    """
    if values.get(KODA_MASTER, True) is not False:
        return values
    return {
        key: (False if key in KODA_CAPABILITIES else value) for key, value in values.items()
    }
