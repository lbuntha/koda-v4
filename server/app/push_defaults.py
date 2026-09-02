"""Every kind of notification this service can send, and nothing else.

A closed list, in code, for the reason the menu and the switchboard are in code:
a kind needs a sender, a wording and a call site behind it, which is a release
rather than a row. The database holds *whether* a kind is on — one system
setting per courtesy kind, seeded from `system_defaults.py` — and this holds
what a kind means.

Two classes, and the difference decides almost everything about how a kind
behaves:

* **account** — something happened *to the account*: a new device signed in, an
  invite was redeemed. These carry no preference and no setting of their own.
  They are the push equivalent of a password-reset email, and a product that
  lets you mute "a new device signed in" has built a worse thing than a noisy
  one. They answer to `push.enabled` and nothing else.
* **courtesy** — something happened *in the learning*: a goal met, a week
  summarised. Every one has an operator switch above it and a family preference
  below it, and the two reminder kinds ship off for families because they are
  the two that could quietly become a hook on a child's evening.

Nothing here reaches a learner-scoped device. That is enforced in the router
rather than described here, but it is the reason no kind names a child as its
audience.
"""

from typing import Any

#: What a kind may be. `operator` exists for the broadcast a deployment sends to
#: its own staff — it rides this pipe rather than growing a second one.
KIND_CLASSES = ("account", "courtesy", "operator")

DEFAULT_KINDS: list[dict[str, Any]] = [
    {
        "kindId": "device.new_signin",
        "class": "account",
        "label": "New device signed in",
        # No `settingId`: see the module docstring. An account kind is not
        # something an operator switches off one at a time.
        "settingId": None,
        # What a family gets before anybody chooses anything. Account kinds are
        # not switchable, so this is the whole answer for them.
        "familyDefault": True,
    },
    {
        "kindId": "family.invite_redeemed",
        "class": "account",
        "label": "Invite accepted",
        "settingId": None,
        "familyDefault": True,
    },
    {
        "kindId": "plan.request_decided",
        "class": "account",
        "label": "Plan request decided",
        "settingId": None,
        "familyDefault": True,
    },
    {
        "kindId": "learn.weekly_summary",
        "class": "courtesy",
        "label": "Weekly summary",
        "settingId": "push.weeklySummary",
        "familyDefault": True,
    },
    {
        "kindId": "learn.goal_met",
        "class": "courtesy",
        "label": "Goal met",
        "settingId": "push.goalMet",
        "familyDefault": True,
    },
    {
        # Ships off for families deliberately. The operator switch above it says
        # only that this deployment is *willing* to send reminders; a parent
        # still has to ask for them and choose the hour.
        "kindId": "learn.practice_reminder",
        "class": "courtesy",
        "label": "Practice reminder",
        "settingId": "push.practiceReminder",
        "familyDefault": False,
    },
    {
        "kindId": "learn.streak_ending",
        "class": "courtesy",
        "label": "Streak ending",
        "settingId": "push.streakEnding",
        "familyDefault": False,
    },
    {
        "kindId": "system.broadcast",
        "class": "operator",
        "label": "Broadcast to staff",
        "settingId": None,
        "familyDefault": True,
    },
]

#: `kindId` -> its definition. A send names a kind, and an unknown one is a bug
#: in the caller rather than something to guess at.
BY_KIND: dict[str, dict[str, Any]] = {item["kindId"]: item for item in DEFAULT_KINDS}

#: The switch above every kind, whatever its class. Named here rather than
#: spelled in three modules.
MASTER = "push.enabled"
