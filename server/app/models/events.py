"""The learning event wire format — the Python side of `src/lib/learning/events.ts`.

Two rules make this model unusual, and both are deliberate:

1. **Unknown fields are kept, not rejected.** A tablet on an older build must
   never be locked out by a newer server, and a tablet on a *newer* build must
   not have its extra fields dropped on the floor. Anything not named here rides
   along in `extra`.
2. **Nothing is computed here.** A skill reports facts; the rollup derives every
   statistic. If the server started calculating accuracy from `given`/`expected`
   it would eventually disagree with the client that already did.
"""

from typing import Any, Literal

from pydantic import ConfigDict, Field, model_validator

from app.models.common import Model
from app.models.sync import Conflict, Mutation

EventType = Literal[
    "lesson_started",
    "question_presented",
    "answer_submitted",
    "support_used",
    "lesson_completed",
    "lesson_abandoned",
]

# The fields the rollup reads. Everything else is carried but not interpreted.
KNOWN_FIELDS = {
    "id",
    "ts",
    "type",
    "sessionId",
    "learnerId",
    "seq",
    "skillId",
    "activityId",
    "lessonId",
    "conceptKey",
    "levelNumber",
    "standards",
    "ageBand",
    "appVersion",
    "tzOffsetMinutes",
    "localDay",
    "entry",
    "correct",
    "attempt",
    "responseMs",
    "errorKind",
    "supportsUsed",
    "questionsAnswered",
    "correctFirstTry",
    "durationMs",
}


class LearningEvent(Model):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    # Identity. `id` is the client's — it is what makes a replayed batch a no-op.
    id: str
    ts: str
    type: EventType
    session_id: str = Field(alias="sessionId")
    learner_id: str = Field(alias="learnerId")
    seq: int = 0

    # What the work was.
    skill_id: str = Field(alias="skillId")
    activity_id: str | None = Field(default=None, alias="activityId")
    lesson_id: str | None = Field(default=None, alias="lessonId")
    concept_key: str = Field(alias="conceptKey")
    level_number: int | None = Field(default=None, alias="levelNumber")
    standards: list[str] = Field(default_factory=list)

    # When, in the learner's own day — mastery counts days practised, and a
    # server bucketing by UTC would move an evening session into tomorrow.
    local_day: str | None = Field(default=None, alias="localDay")
    tz_offset_minutes: int | None = Field(default=None, alias="tzOffsetMinutes")
    app_version: str | None = Field(default=None, alias="appVersion")

    # Answer-shaped fields, present on the events that have them.
    correct: bool | None = None
    attempt: int | None = None
    response_ms: int | None = Field(default=None, alias="responseMs")
    error_kind: str | None = Field(default=None, alias="errorKind")
    supports_used: int | None = Field(default=None, alias="supportsUsed")
    questions_answered: int | None = Field(default=None, alias="questionsAnswered")
    correct_first_try: int | None = Field(default=None, alias="correctFirstTry")
    duration_ms: int | None = Field(default=None, alias="durationMs")

    @model_validator(mode="after")
    def _keep_the_rest(self):
        # Whatever the model did not name is still the child's record.
        extras = {k: v for k, v in (self.__pydantic_extra__ or {}).items() if k not in KNOWN_FIELDS}
        object.__setattr__(self, "_extra", extras)
        return self

    @property
    def extra(self) -> dict[str, Any]:
        return getattr(self, "_extra", {})


class PushIn(Model):
    schema_version: int = Field(default=1, alias="schemaVersion")
    device_id: str | None = Field(default=None, alias="deviceId")
    sent_at: str | None = Field(default=None, alias="sentAt")
    events: list[LearningEvent] = Field(default_factory=list, max_length=500)
    # Imported here rather than in models/sync.py to keep one request model.
    mutations: list["Mutation"] = Field(default_factory=list, max_length=200)


class PushOut(Model):
    accepted: int
    duplicates: int
    cursor: int
    conflicts: list["Conflict"] = Field(default_factory=list)


class ConceptTotalsOut(Model):
    concept_key: str = Field(alias="conceptKey")
    skill_ids: list[str] = Field(default_factory=list, alias="skillIds")
    questions_answered: int = Field(default=0, alias="questionsAnswered")
    correct_first_try: int = Field(default=0, alias="correctFirstTry")
    supports_used: int = Field(default=0, alias="supportsUsed")
    lessons_completed: int = Field(default=0, alias="lessonsCompleted")
    lessons_abandoned: int = Field(default=0, alias="lessonsAbandoned")
    total_response_ms: int = Field(default=0, alias="totalResponseMs")
    errors: dict[str, int] = Field(default_factory=dict)
    practised_on: list[str] = Field(default_factory=list, alias="practisedOn")
    last_seen_ts: str | None = Field(default=None, alias="lastSeenTs")


class ProfileOut(Model):
    learner_id: str = Field(alias="learnerId")
    concepts: list[ConceptTotalsOut]
    events_stored: int = Field(alias="eventsStored")
