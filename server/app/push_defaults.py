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

import re
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
        # Announced by a job rather than by the publish that causes it: telling
        # every family on the deployment is not work to do inside a request.
        "learn.skill_published",
        # The three account and operator kinds the catalog declared from the
        # start and nothing ever sent. Each needed a call site rather than a
        # phase: an invite redeemed, a plan request answered, a word to staff.
        "family.invite_redeemed",
        "plan.request_decided",
        "system.broadcast",
        # Written and sent by hand from Notification Settings → Announce.
        "system.announcement",
        # Phase 2: a child away longer than the operator's threshold, once per gap.
        "learn.absence",
        # Phase 3: access and control.
        "family.child_device_joined",
        "learn.time_limit",
        # Phase 4: progress, judged on the server by `services/mastery.py`.
        "learn.mastered",
        "learn.stuck",
    }
)

#: Every kind this build can also send by email.
#:
#: The same rule as `SENDS`, one channel over: an email switch appears on a
#: screen in the same commit as the code that sends it. Phase 1 of the parent
#: notifications plan was the account notices and an operator's announcement.
#: Phase 2 adds the weekly summary, the absence message, the daily digest and
#: new skills — each of whose jobs now visits every family, not only the ones
#: with a browser, so an email-only family is reached.
EMAIL_SENDS: frozenset[str] = frozenset(
    {
        "device.new_signin",
        "family.invite_redeemed",
        "plan.request_decided",
        "system.announcement",
        "learn.weekly_summary",
        "learn.absence",
        "learn.daily_digest",
        "learn.skill_published",
        "family.child_device_joined",
        "learn.stuck",
    }
)

#: At most this many courtesy pushes about learning ring one parent a day.
#:
#: Counted over `COUNTED_KINDS`, and enforced only on `CAPPED_KINDS` — the
#: bottom of the priority order (stuck > time limit > mastered > absence). A
#: stuck child or a spent time limit is always worth the tap; a third
#: congratulation that day waits in the bell instead of ringing.
DAILY_CAP = 2
COUNTED_KINDS: frozenset[str] = frozenset({"learn.stuck", "learn.time_limit", "learn.mastered", "learn.absence"})
CAPPED_KINDS: frozenset[str] = frozenset({"learn.mastered", "learn.absence"})

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
        #: The email version. `settingId` None: an account kind answers to the
        #: email master alone, the way its push half answers to `push.enabled`.
        "email": {
            "subject": "New sign-in to your Koda account",
            "body": (
                "{device} just signed in to your family's Koda account.\n\n"
                "If that was you, there's nothing to do. If it wasn't, open Koda and "
                "sign it out under Settings:\n{app_link}"
            ),
            "settingId": None,
            "default": True,
        },
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
        "email": {
            "subject": "{name} joined your family on Koda",
            "body": (
                "{name} accepted your invite and is now part of your family on Koda.\n\n"
                "See who is in your family:\n{app_link}"
            ),
            "settingId": None,
            "default": True,
        },
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
        "email": {
            "subject": "Your Koda plan request was {decision}",
            "body": "Your request to change plan was {decision}.\n\nSee your plan:\n{app_link}",
            "settingId": None,
            "default": True,
        },
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
        "body": '{learner} practised {practice} this week — {rounds_done}, {time}.',
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        #:
        #: `{rounds_done}` and `{time}` carry their nouns ("12 rounds", "38
        #: minutes") for the reason `{practice}` does. What was mastered and the
        #: next step wait until the server can judge mastery itself.
        "placeholders": ['learner', 'practice', 'rounds_done', 'time'],
        #: One email per parent for the whole family, rather than one per child:
        #: `{summary}` is a line per child who practised.
        "email": {
            "subject": "Your family's week on Koda",
            "body": "Here's how the week went.\n\n{summary}\n\nSee each child's progress:\n{app_link}",
            "placeholders": ["summary"],
            "settingId": "email.weeklySummary",
            "default": True,
        },
        #: Filled by the sender but gone from the shipped wording. Accepted when
        #: an operator saves, so an edit made against the old body still saves.
        "accepts": ["days"],
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
        "kindId": "learn.skill_published",
        "title": 'New on Koda',
        # The name and nothing else. A tagline is the skill's marketing copy,
        # and the honest thing a notification can say about a new subject is
        # that it exists and where to find it.
        "body": "{skill} has just been published — open Koda to try it.",
        #: What a sender may substitute. Anything else an operator types is
        #: left visible rather than guessed at, so a typo shows up in the
        #: preview instead of on somebody's lock screen.
        "placeholders": ['skill'],
        # Courtesy, not account: it is news rather than a fact about somebody's
        # own account, so it waits for quiet hours to end like the rest.
        "class": "courtesy",
        "email": {
            "subject": "New on Koda: {skill}",
            "body": "{skill} has just been published. Open Koda to try it:\n{app_link}",
            "settingId": "email.skillPublished",
            # Off: one push per skill is news; an email per skill is a newsletter
            # nobody asked for. A parent can still ask.
            "default": False,
        },
        "label": "New skill published",
        "settingId": "push.skillPublished",
        # On, unlike the reminders. A family cannot ask for a subject nobody has
        # told them exists, and one notification per published skill is not a
        # cadence anybody organises an evening around — the reasoning the weekly
        # summary already ships on.
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
    {
        # An operator's own words, sent when they press Send, to families,
        # staff or both. The wording is two placeholders because the words are
        # the operator's; an edit here is a frame around every announcement.
        "kindId": "system.announcement",
        "title": "{title}",
        "body": "{message}",
        "placeholders": ["title", "message"],
        # Courtesy, not account: it is news, so a parent can switch it off and
        # §9's unopened run applies to it like any other courtesy kind.
        "class": "courtesy",
        #: Sent only when the operator ticks "also send by email" on Announce.
        "email": {
            "subject": "{title}",
            "body": "{message}\n\nOpen Koda:\n{app_link}",
            "settingId": "email.announcements",
            "default": True,
        },
        "label": "Announcements",
        "settingId": "push.announcements",
        "familyDefault": True,
    },
    {
        # A child away longer than the operator's threshold (Events → Schedules,
        # seven days out of the box). Once per gap: the claim is keyed on the
        # last day practised, so nothing repeats until a new gap begins.
        "kindId": "learn.absence",
        "title": "{learner} hasn't practised in {away}",
        "body": "A 5-minute round is an easy way back in.",
        "placeholders": ["learner", "away"],
        "email": {
            "subject": "{learner} hasn't practised in {away}",
            "body": (
                "It's been {away} since {learner}'s last round on Koda.\n\n"
                "A short round is the easiest way back in:\n{app_link}\n\n"
                "Taking a break on purpose? That's fine — this is only sent once."
            ),
            "placeholders": ["learner", "away"],
            "settingId": "email.absence",
            "default": True,
        },
        "class": "courtesy",
        "label": "Hasn't practised for a while",
        "settingId": "push.absence",
        # On, by the parent's own choice in the plan: a real gap is exactly what
        # a parent who hands over the tablet wants to hear about, once.
        "familyDefault": True,
    },
    {
        # Email only — it is not in `SENDS`, so it never rings a phone. A note of
        # the day at the hour a parent picks, and only on a day with practice.
        "kindId": "learn.daily_digest",
        "title": "Today on Koda",
        "body": "{summary}",
        "placeholders": ["summary"],
        "email": {
            "subject": "Today on Koda for {family}",
            "body": "Here's what happened today.\n\n{summary}\n\nSee each child's progress:\n{app_link}",
            "placeholders": ["summary"],
            "settingId": "email.dailyDigest",
            "default": False,
        },
        "class": "courtesy",
        "label": "Daily digest",
        "settingId": None,
        "familyDefault": False,
    },
    {
        # A child's device joining with a code — which child, on what. An account
        # kind: the parent handed out the code and is the one who would know if
        # this was not them.
        "kindId": "family.child_device_joined",
        "title": "{learner} is on a new device",
        "body": "{device} joined as {learner}. Not expected? Sign it out in Settings.",
        "placeholders": ["learner", "device"],
        "email": {
            "subject": "{learner} joined Koda on a new device",
            "body": (
                "{device} just joined your family's Koda account as {learner}.\n\n"
                "If you set this up, there's nothing to do. If you didn't, open Koda and "
                "sign it out under Settings:\n{app_link}"
            ),
            "settingId": None,
            "default": True,
        },
        "class": "account",
        "label": "Child joined on a new device",
        "settingId": None,
        "familyDefault": True,
    },
    {
        # Sent by the server when a child's device reports the daily limit spent.
        # Push only; the digest carries it for a parent who reads email instead.
        "kindId": "learn.time_limit",
        "title": "{learner} finished today's time",
        "body": "{minutes} used. Koda opens again tomorrow.",
        "placeholders": ["learner", "minutes"],
        "class": "courtesy",
        "label": "Daily time limit reached",
        "settingId": "push.timeLimit",
        "familyDefault": True,
    },
    {
        # A lesson becoming secure. One push per child per day: several landing
        # together are one message ("Count On and Make Ten").
        "kindId": "learn.mastered",
        "title": "{learner} mastered {lessons}",
        "body": "Right on more than one day, so it's secure now.",
        "placeholders": ["learner", "lessons"],
        "class": "courtesy",
        "label": "Mastered something",
        "settingId": "push.mastered",
        "familyDefault": True,
    },
    {
        # Going wrong more often than right, on more than one day. Once per lesson
        # per week, so a hard fortnight is two messages rather than a nag a day.
        "kindId": "learn.stuck",
        "title": "{learner} could use a hand",
        "body": "{lesson} is tricky right now. Sit with them for one round — see what helps.",
        "placeholders": ["learner", "lesson"],
        "email": {
            "subject": "A tip for {learner}'s {lesson}",
            "body": (
                "{learner} has found {lesson} hard on more than one day. That's normal when an idea is new.\n\n"
                "What usually helps: sit with them for one round, and let them talk through what they're doing.\n\n"
                "See exactly where it's going wrong:\n{app_link}"
            ),
            "settingId": "email.stuck",
            "default": True,
        },
        "class": "courtesy",
        "label": "Stuck on something",
        "settingId": "push.stuck",
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
    "title": "Koda",
    # Email-only: the frame and the links every email carries.
    "parent": "Dara",
    "family": "The Riveras",
    "app_link": "https://learn-with-koda.web.app",
    "kind_label": "Announcements",
    "unsubscribe_link": "https://learn-with-koda.web.app/v1/notifications/unsubscribe?token=…",
    "rounds_done": "12 rounds",
    "time": "38 minutes",
    "lessons": "Count On",
    "lesson": "Take Away",
    "minutes": "30 minutes",
    "summary": "• Mia: practised on 4 days — 12 rounds, 38 minutes\n• Leo: practised on 2 days — 5 rounds, 14 minutes",
}

#: Longest a notification may be. A lock screen truncates well before this;
#: the caps exist so an operator cannot paste an essay into a place that shows
#: one line of it and hides the rest.
TITLE_MAX = 60
BODY_MAX = 160

#: The switch above every kind, whatever its class. Named here rather than
#: spelled in three modules.
MASTER = "push.enabled"

#: The email channel's master — `push.enabled`'s twin. Sign-in, verification and
#: password emails are not notifications and do not answer to it.
EMAIL_MASTER = "email.enabled"

#: What every notification email is wrapped in, before an operator edits it.
#:
#: One frame for every kind, so the greeting and the way out are written once.
#: `accountFooter` replaces `footer` on an account notice, which has no
#: unsubscribe: being able to stop "a new device signed in" is not a feature.
EMAIL_FRAME: dict[str, str] = {
    "body": "Hi {parent},\n\n{message}\n\n— Koda",
    "footer": (
        "You're getting this because {kind_label} emails are on for your Koda account.\n"
        "Stop these emails: {unsubscribe_link}"
    ),
    "accountFooter": "This is a notice about your Koda account, so it is always sent.",
}

#: What each part of the frame may use.
EMAIL_FRAME_PLACEHOLDERS: dict[str, list[str]] = {
    "body": ["parent", "message"],
    "footer": ["kind_label", "unsubscribe_link", "app_link"],
    "accountFooter": ["app_link"],
}

#: What a part of the frame cannot be saved without. A body with no `{message}`
#: sends every parent the same empty letter; a footer with no
#: `{unsubscribe_link}` is an email nobody can stop.
EMAIL_FRAME_REQUIRED: dict[str, str] = {"body": "message", "footer": "unsubscribe_link"}

#: Filled into every email whatever its kind.
EMAIL_COMMON_PLACEHOLDERS = ["parent", "family", "app_link"]

#: An email is read on a screen with room, but a subject is still one line.
EMAIL_SUBJECT_MAX = 120
EMAIL_BODY_MAX = 4000

_PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")


def placeholders_for(kind: str, channel: str = "push") -> list[str]:
    """What an operator may write into this kind's wording on this channel."""
    definition = BY_KIND.get(kind, {})
    names = list(definition.get("placeholders", []))
    if channel == "email":
        # An email may fill different things from its push — the weekly summary
        # is one letter for the family, not one per child.
        names = list((definition.get("email") or {}).get("placeholders", names))
        names += [name for name in EMAIL_COMMON_PLACEHOLDERS if name not in names]
    return names


def unknown_placeholders(text: str, allowed: list[str]) -> list[str]:
    """Placeholders in `text` that nothing will fill, for refusing a save.

    Only `{lowercase_words}` count. `{0}` or an unclosed brace is not a
    placeholder anybody meant, and `fill` already leaves it alone.
    """
    return sorted({name for name in _PLACEHOLDER.findall(text) if name not in allowed})
