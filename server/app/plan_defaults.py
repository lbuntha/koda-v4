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
#: One entry today, on purpose. A feature is only real once something refuses
#: without it, and shipping a list of switches that nothing enforces is how a
#: plan comes to promise things it does not deliver.
#:
#: **Adding the next one is two edits**: an entry here, and a check at whatever
#: it gates — the plan editor, the family's plan card, and the admin screens all
#: read this list and need no change. Splitting the live voice coach out of
#: `ai.koda` and selling it separately is that shape of change.
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
]

FEATURE_IDS = frozenset(feature["featureId"] for feature in PLAN_FEATURES)

#: What a fresh install starts with. Every number here is an operator's to change.
DEFAULT_PLANS: list[dict] = [
    {
        "planId": FREE_PLAN,
        "name": "Free",
        "description": "One child, and the whole course. Koda's AI help is not included.",
        "priceCents": 0,
        "currency": "USD",
        "learnerLimit": 1,
        "features": [],
        "order": 10,
    },
    {
        "planId": "family",
        "name": "Family",
        "description": "Up to three children, and Koda answers.",
        "priceCents": 500,
        "currency": "USD",
        "learnerLimit": 3,
        "features": ["ai.koda"],
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
