"""Mutable documents: the settings half of sync.

Everything a person edits — skill toggles, lesson wording, scoring rates,
progress — is one small JSON blob under one key, which is exactly how the app
already stores it. One collection holds every kind, so a new setting needs no
backend change at all.
"""

from typing import Any

from pydantic import Field

from app.models.common import Model

# Kinds the server will accept. A closed list, because a typo in a client should
# not silently create a new kind that nothing ever reads back.
DOC_KINDS = {
    "skill",  # one per skill: enabled, features, settings, store listing
    "lessonContent",  # per skill/lesson wording overrides
    "progress",  # XP, level, streak — merged, not overwritten
    "levels",  # stars per completed level
    "goals",  # one learner's daily goal — set by a parent, or by a student
    "preferences",  # sound, voice, theme
    "nav",  # a family's sidebar, overriding the bundled default
    "art",  # a family's own SVG, layered over the bundled collection
    "childSettings",  # what a parent decides for one child: caps, help, cadence
}

#: Kinds that take more than being signed in to write.
#:
#: Everything else here is a device recording what happened on it. Scoring is
#: not: re-pricing XP changes what every star already earned was worth, which is
#: why it is the owner's, and why the check is here as well as in the UI — a
#: hidden page is a hint, not a rule.
#: Kinds that take more than being signed in to write.
#:
#: Scoring, the streak rule and the badges used to be here. They are not family
#: documents any more — one operator sets them for every family, so they live in
#: the `defaults` collection behind `system:write` instead.
KIND_PERMISSIONS = {
    # A child's goal is set *for* them: `learner:update` is a parent's, and a
    # student's over their own record, but never a child's over their own.
    "goals": "learner:update",
    # Same right, and for the same reason, one step further: a time cap a child
    # could lift is not a cap. The child's device still *reads* this — it is
    # where every rule in it is enforced — but reading is the pull, not a write.
    "childSettings": "learner:update",
}

#: Kinds a signed-in learner may only write under their own key.
#:
#: `learner:update` says a student may set a goal; it does not say whose. Two
#: learners in one family — a student and their younger sibling — share a
#: permission but not a record, and the key is the only thing that distinguishes
#: them. An adult is unaffected: they have no learner id to be held to.
LEARNER_OWNED_KINDS = {"goals", "childSettings"}

#: Art bodies are markup rather than settings, so they need a ceiling the other
#: kinds do not. 64 KB is a generous illustration and a firm "that is a mistake"
#: for anything larger — the client sanitises before saving, and a file this big
#: is usually an embedded bitmap that should not be an SVG at all.
MAX_ART_BYTES = 64 * 1024

# Counters that only ever go up. On these, a conflict is resolved by taking the
# larger value rather than the later write: two devices playing the same child
# should never subtract XP from each other.
#
# Day-scoped figures are deliberately *not* here. A streak breaks and a daily
# count rolls over at midnight, so taking the larger of two values would make
# both permanent: a child who stopped playing a fortnight ago would keep a
# fourteen-day flame forever. Those fields travel with the day key they were
# counted for, so the later write is the right one.
MONOTONIC_PROGRESS_FIELDS = ("xp", "level", "problemsSolved")


class Mutation(Model):
    """One document, as a device wants it to be."""

    op_id: str = Field(alias="opId")
    kind: str
    key: str
    learner_id: str | None = Field(default=None, alias="learnerId")
    body: dict[str, Any] = Field(default_factory=dict)
    # The revision this edit was made against. `0` means "I have never seen this
    # document" — a fresh install, which must not clobber an existing one.
    base_rev: int = Field(default=0, alias="baseRev")
    deleted: bool = False


class SyncDoc(Model):
    kind: str
    key: str
    learner_id: str | None = Field(default=None, alias="learnerId")
    body: dict[str, Any] = Field(default_factory=dict)
    rev: int
    server_seq: int = Field(alias="serverSeq")
    deleted: bool = False


class Conflict(Model):
    """The server's copy, when it was not what the device edited."""

    op_id: str = Field(alias="opId")
    doc: SyncDoc


class ChangesOut(Model):
    cursor: int
    docs: list[SyncDoc]
    has_more: bool = Field(default=False, alias="hasMore")
