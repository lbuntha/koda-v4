"""Subscription plans, and the features a plan can include.

Two halves, and the split is the whole design:

**Features are code.** Each one has enforcement behind it somewhere — a route
that refuses, a proxy that returns 402 — so the list of features that *exist* is
a release, not a row. Inventing `ai.telepathy` from an admin screen would create
something nothing honours.

**Plans are data.** A plan is only ever a price, a child limit and a set of
those features, so an operator can edit one, or add a fourth for a school, and
every plan they can express is one the code already knows how to enforce.

Deliberately not a payment integration. Nothing here talks to a card processor:
a subscription is a grant with an end date, and it lapses when that date passes.
That keeps the entitlement model — the part the app must get right — independent
of who eventually takes the money, and it is what lets a family be given a month
by hand today.
"""

#: The plan a family has until somebody says otherwise.
FREE_PLAN = "free"

#: Every feature a plan may include.
#:
#: Short on purpose. A feature is only real once something withholds without it,
#: and shipping a list of switches that nothing honours is how a plan comes to
#: promise things it does not deliver.
#:
#: **Adding one is two edits**: an entry here, and a check at whatever it gates —
#: the plan editor, the family's plan card, and the admin screens all read this
#: list and need no change. Splitting the live voice coach out of `ai.koda` and
#: selling it separately is that shape of change.
#:
#: The two differ in where they are answered, which is worth knowing before
#: adding a third. `ai.koda` is *refused*: the tutor proxy returns 402 and the
#: learner route refuses a fourth child, so the device merely explains. There is
#: nothing to refuse for `course.premium` — every lesson is bundled with the app
#: and a round is played offline against no server — so the device is where it is
#: answered, the way the learning path's own padlocks are. See
#: `src/lib/premiumLessons.ts`.
PLAN_FEATURES: list[dict] = [
    {
        "featureId": "ai.koda",
        "label": "Ask Koda",
        "description": (
            "Koda's AI help — written answers, spoken guidance, the voice coach "
            "and reading a child's drawing."
        ),
        "order": 10,
    },
    {
        "featureId": "course.premium",
        "label": "The full course",
        "description": (
            "Every lesson of every skill. Without it a learner keeps the free "
            "lessons each skill opens with — how many is the operator's to set, "
            "per skill, in Skill Manager."
        ),
        "order": 20,
    },
]

FEATURE_IDS = frozenset(feature["featureId"] for feature in PLAN_FEATURES)

#: What a fresh install starts with. Every number here is an operator's to change.
DEFAULT_PLANS: list[dict] = [
    {
        "planId": FREE_PLAN,
        "name": "Free",
        # Not "the whole course": a skill may be set to charge for its later
        # lessons, and a plan description that contradicts the padlock a child
        # is looking at is worse than a vaguer one.
        "description": "One child, and the lessons each skill opens with.",
        "priceCents": 0,
        "currency": "USD",
        "learnerLimit": 1,
        "features": [],
        "order": 10,
    },
    {
        "planId": "family",
        "name": "Family",
        "description": "Up to three children, every lesson, and Koda answers.",
        "priceCents": 500,
        "currency": "USD",
        "learnerLimit": 3,
        "features": ["ai.koda", "course.premium"],
        "order": 20,
    },
]

#: What an operator may change on a plan.
#:
#: Not `planId`: a subscription row points at it, so renaming one would strand
#: every family on it. Not the free plan's existence: it is the floor every
#: lapsed subscription falls back to.
EDITABLE_PLAN_FIELDS = frozenset(
    {"name", "description", "priceCents", "learnerLimit", "features", "order"}
)

#: A subscription with one of these is being honoured, if its period still runs.
LIVE_STATUSES = frozenset({"active", "trialing"})
