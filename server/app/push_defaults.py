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

#: Every kind this build has a call site for.
#:
#: The catalog is the design; this is what the code actually does, and the two
#: are allowed to differ while a phase is in flight. What is not allowed is
#: drawing a parent a switch for a kind nothing sends: somebody turns on
#: "Practice reminder", waits a week, and concludes notifications are broken —
#: which is a worse first impression than the feature being visibly absent.
#:
#: A kind is added here in the same commit as its sender, so the list cannot
#: quietly claim more than the build does. `routers/push.py` hides what is not
#: in it, and `services/push.py` refuses to send it.
SENDS: frozenset[str] = frozenset(
    {
        "device.new_signin",
        "learn.goal_met",
        "learn.weekly_summary",
        # Phase 4. Both ship *off* for families — the operator switch above
        # them says only that this deployment is willing — so appearing here
        # makes the switch visible, not the notification inevitable.
        "learn.practice_reminder",
        "learn.streak_ending",
        # The three account and operator kinds the catalog declared from the
        # start and nothing ever sent. Each needed a call site rather than a
        # phase: an invite redeemed, a plan request answered, a word to staff.
        "family.invite_redeemed",
        "plan.request_decided",
        "system.broadcast",
    }
)

DEFAULT_KINDS: list[dict[str, Any]] = [
    {
        "kindId": "device.new_signin",
        "title": 'New sign-in to Koda',
        "body": "{device} just signed in. If that wasn't you, sign it out in Settings.",
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['device'],
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
        "title": 'Invite accepted',
        "body": '{name} has joined your family on Koda.',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['name'],
        "class": "account",
        "label": "Invite accepted",
        "settingId": None,
        "familyDefault": True,
    },
    {
        "kindId": "plan.request_decided",
        "title": 'Your plan request',
        "body": 'Your request to change plan was {decision}.',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['decision'],
        "class": "account",
        "label": "Plan request decided",
        "settingId": None,
        "familyDefault": True,
    },
    {
        "kindId": "learn.weekly_summary",
        "title": "{learner}'s week",
        # `{practice}` carries its own noun — "1 day", "4 days" — rather than
        # being a bare number with "days" written after it in the template. A
        # child who practised once is the most likely case there is, and
        # "practised on 1 days this week" is the sentence that gets a product
        # laughed at. `{days}` stays a number for `streak_ending`, where it is
        # only ever plural.
        "body": '{learner} practised {practice} this week.',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['learner', 'practice'],
        "class": "courtesy",
        "label": "Weekly summary",
        "settingId": "push.weeklySummary",
        "familyDefault": True,
    },
    {
        "kindId": "learn.goal_met",
        "title": "{learner} met today's goal",
        "body": '{rounds} rounds of {skill}. Nicely done.',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['learner', 'rounds', 'skill'],
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
        "title": 'Time to practise',
        # "hasn't had a go today yet" was true and said nothing: a parent whose
        # child has been away nine days read the same sentence on each of them.
        # `{away}` is how long it has been, with its noun attached — "a day",
        # "3 days", or "a while" for a child who has not started yet.
        "body": "It's been {away} since {learner} practised.",
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['learner', 'away'],
        "class": "courtesy",
        "label": "Practice reminder",
        "settingId": "push.practiceReminder",
        "familyDefault": False,
    },
    {
        "kindId": "learn.streak_ending",
        "title": "{learner}'s streak ends today",
        "body": '{days} days so far — one round keeps it going.',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['learner', 'days'],
        "class": "courtesy",
        "label": "Streak ending",
        "settingId": "push.streakEnding",
        "familyDefault": False,
    },
    {
        "kindId": "system.broadcast",
        "title": 'Koda',
        "body": '{message}',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['message'],
        "class": "operator",
        "label": "Broadcast to staff",
        "settingId": None,
        "familyDefault": True,
    },
]

#: `kindId` -> its definition. A send names a kind, and an unknown one is a bug
#: in the caller rather than something to guess at.
BY_KIND: dict[str, dict[str, Any]] = {item["kindId"]: item for item in DEFAULT_KINDS}

#: What a placeholder is filled with when there is nothing real to fill it.
#:
#: For previewing wording — in the editor as somebody types, and in the test
#: send. Chosen to look like a real notification rather than like a template:
#: "Mia met today's goal" tells an operator what a parent will see in a way
#: that "{learner} met today's goal" cannot.
SAMPLES = {
    "device": "Chrome on Mac",
    "learner": "Mia",
    "rounds": "6",
    "skill": "Counting",
    "days": "4",
    "practice": "4 days",
    # The noun travels with the number here for the reason it does in the job
    # that fills it for real: a sample reading "1 days" teaches an operator that
    # their copy is broken when it is not.
    "away": "3 days",
    # The noun travels with the number here for the reason it does in the job
    # that fills it for real: a sample reading "1 days" teaches an operator that
    # their copy is broken when it is not.

    "name": "Sam",
    "decision": "approved",
    "message": "Koda is down for maintenance until 6pm.",
}

#: Longest a notification may be. A lock screen truncates well before this;
#: the caps exist so an operator cannot paste an essay into a place that shows
#: one line of it and hides the rest.
TITLE_MAX = 60
BODY_MAX = 160

#: The switch above every kind, whatever its class. Named here rather than
#: spelled in three modules.
MASTER = "push.enabled"
