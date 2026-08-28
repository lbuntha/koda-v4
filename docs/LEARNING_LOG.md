# The learning log

Every skill records what a learner did in the same shape, so the app can tell
what a child has mastered and what they should do next — including *which skill*
to open next.

This document is the contract. If you are building a skill (addition, shapes,
telling time), implementing the five calls in [Instrumenting a skill](#instrumenting-a-skill)
is all you have to do; everything else here is background.

---

## Why not just log what happened?

There is already a log — `koda.log(action, detail)` — and it is the wrong tool
for this. It records `TAP_ITEM · "tapped a rocket"`: fine for debugging a skill,
useless for teaching. You cannot compute a child's accuracy from a sentence.

The learning log is separate and structured, and it follows two rules that are
the whole reason it works across skills:

**1. A skill reports facts, never statistics.** You say "this answer was wrong,
on attempt 2". You never compute accuracy, response time, or attempt counts —
the SDK derives all of them. Counting and addition therefore *cannot* disagree
about what accuracy means, because neither of them calculates it.

**2. Mastery is keyed by concept, not by plugin.** A concept can be taught by
more than one skill (counting and addition both strengthen `make-ten`), and one
skill teaches many concepts. The recommender works on concepts, so adding a skill
never means teaching the recommender about it.

---

## Instrumenting a skill

Five calls. All on `koda.learning`.

```ts
// 1. The round begins. Pass the level if your skill navigates lessons itself.
koda.learning.startLesson("path", levelNumber);

// 2. Each question goes on screen. This starts the response clock —
//    send it even when the question is uninteresting, or you lose all timings.
koda.learning.present({
  questionId: "q_7_abc",     // your id; must match the one you answer with
  index: 3,                  // position in the round, 1-based
  taskKind: "add_within_10", // short machine key for what is being asked
  expected: "7",             // optional, enables error classification
  itemCount: 6,              // optional, the load the child was under
});

// 3. Every submitted answer, including repeat attempts at the same question.
koda.learning.answered({
  questionId: "q_7_abc",
  correct: false,
  given: "6",
  expected: "7",             // if you only know it at answer time
  errorKind: "off_by_one",   // optional; the SDK infers what it can
});

// 4. Whenever help is taken.
koda.learning.supportUsed("hint", 1);   // "hint" | "audio_replay" | "reveal" | "walkthrough"

// 5. The round ends.
koda.learning.completeLesson({ stars: 3, xpEarned: 100 });
koda.learning.abandonLesson();          // if they leave mid-round instead
```

Then ask what to do next:

```ts
const next = await koda.progress.nextStep();
// { kind: "advance" | "practise" | "review" | "new-skill" | "none",
//   kidMessage: "Nice work! Ready for the next one?",
//   reason: "Scored 100% first-try in the last round.",
//   lesson?, skill? }
```

`nextStep` is a **host** API, like XP. The answer ranges over every installed
skill, and may well be "leave this skill" — so a skill is in no position to
compute it.

### Where to put the calls

Instrument at the choke points, not at each branch. Counting has ~15 answer
branches across five game modes; all of them end at one `setQuizFeedback`, so
that is where `answered` is called. A new question type is then instrumented the
moment it shows feedback. The alternative — fifteen call sites — drifts apart one
at a time and you will not notice until the data is already wrong.

### What you must declare in JSON

The log cannot attribute events without this. In `lessons.json`:

```jsonc
{
  "id": "add-within-5",
  "conceptKey": "add-within-5",        // stable machine key for what is mastered
  "requires": ["counter", "make-ten"]  // concepts that should come first
}
```

And in `manifest.json`:

```jsonc
{
  "teaches":  ["add-within-5", "add-within-10", "counting-on"],
  "requires": ["counter"]              // what unlocks THIS skill
}
```

`requires` on the manifest is what makes "recommend the next skill" a data
question rather than a code one. Counting declares `teaches: ["counter", ...]`;
addition declares `requires: ["counter"]`; the moment a child masters `counter`,
addition is recommended. Nothing in the recommender mentions either skill.

---

## The events

Every event carries the same envelope, all of it stamped by the SDK:

| Field | Why it exists |
|---|---|
| `id` | idempotency — a re-sent batch must not double-count |
| `ts` | ISO 8601, UTC |
| `localDay`, `tzOffsetMinutes` | the learner's calendar day. "Practised on N separate days" is a mastery criterion, and UTC bucketing gets it wrong in both directions: a 9pm session in Los Angeles and the next morning's are two local days but one UTC day |
| `sessionId` | one app load — tells "kept going" from "came back" |
| `seq` | monotonic within a session. Timestamps collide at millisecond resolution, so a server sorting by `ts` alone will sometimes read an answer as preceding its question |
| `learnerId` | random per-device id, no PII. Without it a backend cannot tell two children on a shared tablet apart. A real account id replaces it later with no schema change |
| `appVersion` | on the event, not just the batch — the ring outlives releases, so one upload spans several builds |
| `pluginId`, `activityId` | which skill, which activity |
| `lessonId`, `levelNumber` | which lesson |
| `conceptKey` | what mastery is tracked against |
| `standards`, `ageBand` | roll up by curriculum code or age band |

| Event | When | Notable fields |
|---|---|---|
| `lesson_started` | round opens | `entry` — `path`, `picker`, `resume`, `recommendation`, `preview` |
| `question_presented` | question on screen | `taskKind`, `expected`, `itemCount` |
| `answer_submitted` | any answer | `correct`, `attempt`, `responseMs`, `errorKind`, `supportsUsed` |
| `support_used` | help taken | `support`, `hintLevel` |
| `lesson_completed` | round finished | `firstTryAccuracy`, `medianResponseMs`, `durationMs`, `stars` |
| `lesson_abandoned` | left mid-round | `questionsAnswered`, `correctFirstTry` |

`attempt`, `responseMs`, `supportsUsed` and every field on `lesson_completed`
are **derived** — you never send them.

### Error kinds

A closed, cross-skill taxonomy. Closed because a recommender has to compare
across skills: "off by one" must mean the same thing in counting and in addition
or the pattern cannot be read.

`off_by_one` · `off_by_more` · `reversed` · `guessed_fast` · `timed_out` ·
`miscounted_items` · `sequence_slip` · `place_value` · `unknown`

Two are inferred for you when you leave `errorKind` unset:

- **`guessed_fast`** — a wrong answer under 700ms. That is less time than a
  five-year-old needs to read the prompt and look at the set, so it tells you
  about engagement, not ability, and should not be remediated as a
  misconception. Applied only to *wrong* answers: a fast right answer is
  fluency, which is the goal.
- **`off_by_one` / `off_by_more`** — when both `given` and `expected` are
  numeric.

Send `errorKind` yourself when the numbers cannot tell the story: choosing the
wrong side of a comparison is `reversed`, not an off-by-one.

---

## What the log decides

### Mastery, per concept

| Status | Meaning |
|---|---|
| `not-started` | no first attempts recorded |
| `learning` | attempted, fewer than 8 first attempts |
| `practising` | enough evidence, accuracy between 50% and 85% |
| `struggling` | accuracy under 50%, or two abandoned rounds on thin evidence |
| `mastered` | ≥85% first-try unaided, ≥1 completed round, practised on ≥2 separate days |

Two details worth knowing:

- **Only first attempts count as evidence.** A retry of a question the child has
  already seen the answer to measures memory, not understanding. Counting it
  would inflate mastery exactly where a child is struggling most.
- **A correct answer after a hint is not an unaided correct answer.** It still
  counts as a question answered; it does not count towards `correctFirstTry`.

### Advancing is a lower bar than mastery

Deliberately. Mastery governs what a *skill* unlocks and requires evidence
across days. Advancing to the next lesson only requires the child to have just
done well (≥80% first-try in the round that ended). Holding both to the mastery
bar meant a perfect five-question round still said "one more round" — which
reads to a five-year-old as being told they failed.

Prerequisites are still checked against full mastery, so a strong round never
unlocks something the child has no foundation for.

### The order of the recommendation

1. **Struggling** → step back to an unmet prerequisite (`review`)
2. **Not secure, and the last round was not strong** → more of the same concept (`practise`)
3. **Ready** → next lesson in this skill (`advance`)
4. **Nothing left here, prerequisites met elsewhere** → a new skill (`new-skill`)
5. Otherwise `none`

Moving forward is the last branch, not the first: a struggling child is never
advanced, and one good round never sends a learner to a new skill on its own.

---

## Storage, and the backend that isn't here yet

Two JSON stores in `localStorage`:

- **`koda_learning_events_v1`** — a capped ring of 2,000 events (~65 rounds).
  Recent detail: which errors, how fast, how much help.
- **`koda_learning_profile_v1`** — per-concept cumulative counters, **never
  trimmed**. Without this, mastery would silently reset itself every few hundred
  questions as raw events aged out.

The wire format is the thing to know: `LearningEventBatch` is exactly the JSON a
server will be handed.

```jsonc
{
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "sentAt": "2026-08-17T12:23:15.283Z",
  "events": [ /* ... */ ]
}
```

`schemaVersion` rides on every batch so a server can accept events written by an
app version that predates it, instead of the first migration being a data loss.
`sentAt` is separate from each event's `ts` so a delayed upload is
distinguishable from a delayed answer.

To add a backend, implement one function:

```ts
import { setLearningSink } from "./lib/learning";

setLearningSink(async (batch) => {
  await fetch("/api/learning/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
});
```

Nothing above that line changes. The local ring stays the source of truth, so a
failed send is not a lost event.

`LearningLog.exportBatch()` returns the same body on demand — useful for seeding
the backend with history collected before it existed.


---

## When there is a login

Adding accounts makes learner identity easy, because it was designed for: the
account id replaces `learnerId` and nothing else in the schema changes. Three
things do **not** follow automatically.

### 1. Duplicate events — the server must enforce it

The client keeps the local ring as its source of truth and re-sends a batch it
never saw acknowledged, so **the same event will arrive twice**. That is
deliberate: it is how an event survives a dropped connection. Deduplication is
the server's job, and it is one line:

```sql
INSERT INTO learning_events (id, learner_id, ...) VALUES (...)
ON CONFLICT (id) DO NOTHING;
```

`id` is a UUID, generated per event and never reused, so it is a safe primary
key across every device. Without that constraint you get duplicates no matter
how the login works.

### 2. Duplicate learners

One account is one `learnerId`, so the same child on a tablet and a laptop
finally becomes one record — which is the real win, and impossible today.

The thing to decide is what happens to practice recorded *before* the login. The
events exist with an anonymous device id, and claiming them means re-stamping
them to the account. Do that automatically on every login and a shared family
tablet will attach one child's anonymous practice to whoever signs in first, so
this should be an explicit "is this you?" rather than a silent merge.

### 3. Ordering

`seq` restarts per session, so the ordering key is
`(learner_id, session_id, seq)` — not `ts`, which collides at millisecond
resolution.

### Question identity

`questionId` in the log is a UUID stamped by the SDK, **not** the id the skill
passed. A skill's id is only a correlation handle for matching `answered` to
`present`, and skills are in no position to be globally unique — counting's was
`q_<level>_<timestamp>`, so two children on level 1 in the same millisecond
produced the same id. Harmless on one device; on a shared table it merges two
children's questions into one row.

### Usage across users

Everything needed is on each event, so per-skill usage is a group-by:

```sql
-- who used which skill, and how much
SELECT plugin_id,
       COUNT(DISTINCT learner_id)                                    AS users,
       COUNT(*) FILTER (WHERE type = 'lesson_started')               AS plays,
       COUNT(*) FILTER (WHERE type = 'lesson_completed')             AS finished
FROM learning_events
GROUP BY plugin_id;
```

The app keeps the same counters locally in the profile's `skills` rollup — plays,
completions, abandons, questions, first-try accuracy, time and days — so they
survive events ageing out of the ring. A play is a **round opened**, not a round
finished: counting only completions would make a skill children keep bouncing
off look unused rather than difficult.

---

## Privacy

This is a child's record. The log is about the work, not the person: no names, no
free text a child typed, no audio, no identifiers beyond a per-load session id.
It stays in the browser until someone deliberately adds a sink.

Two consequences worth preserving:

- **Teacher previews are not recorded.** `PluginHost` is given no lesson context
  for a preview, and the SDK refuses to record events it cannot attribute — so
  previewing a lesson cannot pollute a child's record.
- **Clearing is total.** `LearningLog.clear()` wipes both stores. A partial wipe
  that left the profile behind would be worse than none.
