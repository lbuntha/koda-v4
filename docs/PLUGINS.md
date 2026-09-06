# Koda skill architecture

A skill is **one complete subject** — its interactions, its lessons, its settings and its
telemetry — built and owned by one developer in one folder.

This document is the contract to build against. For the migration sequence that gets us
there, see [PLUGIN_BUILD_PLAN.md](./PLUGIN_BUILD_PLAN.md).

> **Status: partly built.** The contract, SDK, host, registry and the counting skill are in
> the repo and running — counting reaches the learner through `SkillHost`. **Not built:** the
> shared `kit/`, the activity split, `curriculum/course.ts`, routing, and release gating.
> Anything describing those is the target, not current behaviour.

---

## 1. What exists today

`src/lib/skillStore.ts` (657 lines) already provides a real skill layer:

| Capability | Where |
| --- | --- |
| Manifest metadata — id, version, category, author | `InstalledSkill` |
| Per-feature toggles | `SkillFeature[]`, stored in the deployment skill registry with a local offline cache |
| Per-skill settings bag | `settings`, e.g. `speechRate`, `hapticIntensity` |
| Telemetry | `SkillStoreAPI.logAction()` |
| Management UI | `src/components/skills/SkillManagerPage.tsx` (913 lines) |

Counting already consumes it, e.g. `CountingGameApp.tsx:300`:

```ts
SkillStoreAPI.isFeatureEnabled("counting-mastery", "haptic_feedback", true)
```

### What is missing

1. ~~**No `component` field.**~~ **Fixed.** `Skill.activities` supplies components and
   `SkillHost` mounts them; `App.tsx` no longer imports `CountingGameApp`.
2. **The skill still escapes the shell.** `SkillHost` renders outside `MainLayout`, so
   counting loses the sidebar and page padding, and hardcodes 6 dark surfaces that ignore the
   theme. (M5, M7.)
3. **Cross-skill logging.** `CountingGameApp.tsx:717` logs against `"step-header-tagger"`
   from inside counting, because the skill id is passed by hand at every call site.
4. **Curriculum is imported by name.** `Home.tsx` imports `FLOWING_LEVELS` directly from
   `src/skills/counting/internal/data/countingAssets.ts`. A second skill cannot contribute lessons without
   the dashboard importing it too.
5. **No routing.** `activeTab` is React state with no URL, so refreshing inside a lesson
   returns the learner to the dashboard.

---

## 2. Why a skill does not own levels

The obvious design — each skill ships its own curriculum — breaks immediately. The counting
skill's 15 levels already span five different skills:

| Level | Title | Actually teaches |
| --- | --- | --- |
| L1–L2 | Count in a Row / Scattered | counting |
| L3 | Comparing Two Groups | **comparing** |
| L4–L5 | Dice Patterns / Dot Groups | counting |
| L6–L8 | Part-Whole, Ten-Frame, Making 10 | **number bonds** (+ addition) |
| L9 | Teen Numbers (10 + Ones) | **base ten** |
| L10–L11 | Skip Counting by 2s, 5s, 10s | **multiplication** precursor |
| L13–L15 | Make a Ten / Hundred / Build Numbers | **base ten** |

A `number-bonds` skill would collide with counting L6–L8 on its first day. The overlap is
not an accident to be tidied up — teaching counting well *requires* touching number bonds.

**So capability and curriculum are separated:**

- A **skill** owns *activities* — interaction engines. It answers **how** a learner interacts.
- The **course** owns *order* — which lesson comes when. It answers **what** is taught, when.
- A **lesson** binds the two: it points at an activity and configures it.

Counting's "Making 10" lesson then *references* `number-bonds/ten-frame` instead of shipping
a second implementation. Nothing is owned twice, and no boundary has to be argued.

| Unit of… | Lives in | So that… |
| --- | --- | --- |
| Ownership | `skills/<skill>/` | one developer owns one folder, complete |
| Reuse | `skill.activities` | counting can *use* a ten-frame without owning it |
| Sequencing | `curriculum/course.ts` | lesson order changes without touching a skill |

---

## 3. The contract

Defined in [`src/skills/types.ts`](../src/skills/types.ts).

```ts
export interface Skill {
  manifest: SkillManifest;
  features: SkillFeature[];                        // existing skillStore shape
  settings: Record<string, unknown>;
  activities: Record<string, ActivityDefinition>;   // what this skill CAN DO
  lessons: Lesson[];                                // what this skill TEACHES
}

export interface ActivityDefinition<P> {
  id: string;                 // "touch-orbit" → referenced as "counting/touch-orbit"
  name: string;
  defaultParams: P;
  component: React.ComponentType<ActivityProps<P>>;
}

export interface ActivityProps<P> {
  params: P;                  // lesson config, merged over defaultParams
  level: number;
  koda: KodaSDK;              // the global API, pre-bound to this skill
  onComplete(result: SkillResult): void;
}

export interface Lesson {
  id: string;
  title: string;
  concept: string;            // what mastery is tracked against
  activity: string;           // "number-bonds/ten-frame" — MAY be another skill's
  params?: Record<string, unknown>;
}
```

A skill declares what it teaches, but **not where its lessons sit in the global order**.
That belongs to the course, so two skills can never fight over a lesson.

---

## 4. The global API

Everything the host offers arrives as one injected object. Koda already provides all of it —
it is just imported directly today, which is what couples skills to the app.

```ts
export interface KodaSDK {
  readonly skillId: string;

  sound:   { play(type: SoundType): void };
  haptics: { tap(): void; success(): void };
  speech:  { say(text: string, opts?: { rate?: number }): Promise<void>; stop(): void };

  // XP is a HOST api. A skill reports what was earned; it never owns the
  // running total, because that total is shared across all skills.
  progress: {
    awardXp(amount: number): Promise<void>;
    complete(result: SkillResult): Promise<void>;
    snapshot(): Promise<LearnerSnapshot>;   // a copy, never live state
    // What to do next, across every installed skill. A host API for the same
    // reason XP is: the answer may well be "leave this skill".
    nextStep(): Promise<Recommendation | undefined>;
  };

  // Learning telemetry. A skill reports facts; the SDK derives every number,
  // which is what makes the data comparable across skills.
  // Full contract: docs/LEARNING_LOG.md
  learning: {
    startLesson(entry?: LessonEntry, levelNumber?: number): void;
    present(q: { questionId: string; index: number; taskKind: string;
                 expected?: string; itemCount?: number }): void;
    answered(r: AnswerReport): void;
    supportUsed(support: SupportKind, hintLevel?: number): void;
    completeLesson(extras?: { stars?: number; xpEarned?: number }): void;
    abandonLesson(): void;
  };

  ai: {
    tutor(message: string, ctx?: object): Promise<string>;
    generateProblem(spec: object): Promise<unknown>;
    analyzeDrawing(png: string): Promise<string>;
  };

  config: {                                  // pre-bound to THIS skill's id
    get<T>(key: string, fallback: T): T;
    isEnabled(featureId: string): boolean;
  };

  log(action: SkillAction, detail: string): void;
  ui: { readonly theme: "light" | "dark"; exit(): void };
}
```

### Backed by what already exists

| Global call | Implementation |
| --- | --- |
| `koda.sound.play()` | `src/utils/audio.ts` → `playSound()` |
| `koda.haptics.tap()` | `src/utils/haptics.ts` → `triggerTapPopHaptic()` |
| `koda.speech.say()` | `POST /api/tutor/speech`, falls back to `speakWebSpeech()` |
| `koda.progress.awardXp()` | `App.tsx` → `setUserProgress` |
| `koda.ai.tutor()` | `POST /api/tutor/respond` |
| `koda.ai.generateProblem()` | `POST /api/tutor/generate-problem` |
| `koda.ai.analyzeDrawing()` | `POST /api/tutor/analyze-drawing` |
| `koda.config.isEnabled()` | `SkillStoreAPI.isFeatureEnabled()` |
| `koda.log()` | `SkillStoreAPI.logAction()` |

### Two rules that keep this cheap later

**Injected, never `window.Koda`.** A real global cannot be versioned, mocked in tests, scoped
per skill, or reached from an iframe. Injection reads identically for the developer and
keeps all four doors open.

**Async wherever a boundary could ever exist.** `awardXp()` returns a `Promise` although
today it is a synchronous `setState`. That single choice makes a later sandbox/RPC swap a
drop-in instead of a rewrite of every skill.

`koda.config.isEnabled()` and `koda.log()` take **no skill id** — the host binds it once. A
skill therefore cannot read another skill's flags or log under another skill's name, which
is the bug at `CountingGameApp.tsx:717` today.

### What a skill must never reach

Raw `localStorage` (namespace it under the skill id), direct `fetch` (proxy through the host
so the Gemini key never leaks), the DOM outside its own root, another skill's data, or app
state. **This list is the permissions model** — far cheaper to hold from the first skill
than to retrofit onto nine.

---

## 5. Folder layout

```
src/skills/
├── types.ts                  # the contract
├── registry.ts               # the ONE file you edit to add a skill
├── sdk/                      # createKodaSDK()
├── host/
│   └── SkillHost.tsx         # resolves "skill/activity" → component, binds the SDK
├── kit/                      # shared skill furniture — use it, do not rebuild it
│   ├── round/                #   useSkillRound, scoreRound, roundPraise, answerSound
│   ├── chrome/               #   SkillRound, SkillRoundTopBar, step header, finish screen
│   └── testing/              #   the contract suite every skill inherits
│
└── counting/                 # the reference skill — read this one
    ├── index.ts              # export const skill: Skill
    ├── manifest.json         # metadata, listing, features, settings defaults
    ├── lessons.json          # the lessons it contributes
    ├── counting.test.ts      # two lines: the inherited contract
    ├── activities/           # what it EXPORTS for anyone to reference
    │                         #   → "counting/orbit", "counting/subitize", …
    ├── assets/               # SVG this skill draws with — see below
    ├── audio/                # its recorded voice lines — see docs/VOICE.md
    ├── voice.json            # the phrases it says, for the recorder
    └── internal/             # private — nothing outside this folder imports it
```

`index.ts` is the **only** file the rest of the app may import from a skill.

### Artwork a skill owns

Drop `.svg` files in `assets/` and register them from `index.ts`:

```ts
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);
```

Then draw them with `<SvgAsset id="counting-rocket" />`. Ids are namespaced
`skillId-name`, so two skills may both ship a `star.svg`.

Art belongs in the skill when the skill is what makes it meaningful — counting's
eight countables are chosen so no two share a silhouette and all carry the same
optical weight, which is a *counting* requirement, not a house style. General
furniture a skill happens to use stays in `src/assets/svg`.

Nothing outside the skill folder globs into `assets/` — that would break the
rule above. Registration is a push from `index.ts`, and `registerSkillArt`
returns the ids so `Skill.assets` can declare them rather than leaving the
registration an invisible import side effect.

The art is seeded into the deploy-wide collection by `generate-art-seed.mjs`, so
an operator can retouch it on the *Art* page. The skill keeps its own copy, so
that edit is an override; deleting it there restores the shipped drawing.

`src/assets/svg/README.md` has the resolution order and the sanitiser rules
every asset has to survive.

### The voice a skill speaks with

Same shape, same reason. `koda.speech.say()` costs a network round trip per
utterance, which is fine for a tutor reply and wrong for counting — a child taps
and waits before hearing "three". So a skill's authored lines are recorded ahead
of time into its own `audio/` and registered from `index.ts`:

```ts
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/*", { query: "?url", import: "default", eager: true }),
);
```

Registered rather than fetched, so the lookup can answer synchronously and a tap
makes a sound with no await in front of it. Declare what the skill says in
`voice.json`, or put it in a lesson's `audioPrompt`, then `npm run voice:record`.
A phrase with no recording falls back to live TTS, so this is always optional.

`docs/VOICE.md` has the rest.

### The kit

Roughly 80% of a skill is not about its subject — it is round sequencing, scoring, stars,
hints, the progress bar, the feedback banner and the finish screen. If that lives inside a
skill folder, skills 2–9 each copy it. So it was extracted during the counting migration,
before skill two existed: reverse-engineering a kit from two divergent implementations is
the failure this avoided.

**What exists today**, exported from `src/skills/kit/index.ts` — importing from there is the
sanctioned alternative to a cross-folder import:

```
src/skills/kit/
├── round/
│   ├── useSkillRound.ts   the loop: index, attempts, first-try count, feedback,
│   │                      the five learning calls in order, scoring, XP
│   ├── scoreRound.ts      stars from first-try accuracy, XP from Settings, `perfect`
│   ├── roundPraise.ts     what the finish screen congratulates: level, streak,
│   │                      perfect round, daily goal, or stars — most notable wins
│   ├── hints.ts           the hint ladder: the lesson's own copy, composeHints
│   └── answerSound.ts     the recorded reaction, behind the learner's own switches
├── chrome/
│   ├── SkillRound.tsx             the shell: bar, header, feedback, finish screen
│   ├── SkillRoundTopBar.tsx       identity, progress, voice, settings, exit
│   ├── PracticeStepHeader.tsx     the question, read-aloud, hint
│   ├── SkillHint.tsx              the hint panel, shown and read aloud
│   ├── RoundCompleteModal.tsx     stars, XP, streak, goal, level progress
│   └── ActivityErrorBoundary.tsx  a throw costs the round, not the app
├── motion.ts   SPRING, stagger, idleFloat, useMotionOK — the shared vocabulary
└── testing/    describeSkillContract, describeActivitySmoke, renderActivity, fakeKoda
```

**Still to come** — a shared manipulatives layer, so two skills that both need a ten-frame
draw the same one:

```
manipulatives/  TappableSet → counting, comparing · DragBin → sorting, base-ten
                TenFrame → number bonds, addition · NumberLine → addition, subtraction
                BalanceScale → comparing, equations
answer/         ChoiceGrid, NumberPad
```

With the kit, an activity is mostly declaration — the skill draws what the child touches and
nothing else:

```tsx
// src/skills/<a future skill>/activities/BalanceCompare.tsx
export function BalanceCompare({ params, koda, onComplete, lesson }: ActivityProps<CompareParams>) {
  const round = useSkillRound({
    koda,
    totalQuestions: 5,
    levelNumber: lesson?.levelNumber ?? 1,
    nextQuestion: (index) => buildQuestion(params, index),
    onComplete,
  });

  return (
    <SkillRound koda={koda} lesson={lesson} round={round} fallbackTitle="Compare"
                prompt={round.question.prompt} onExit={koda.ui.exit} /* … */>
      {/* the only genuinely comparing-specific part */}
      <BalanceScale
        left={round.question.left}
        right={round.question.right}
        onSettle={(v) =>
          round.submit({ correct: v.correct, given: v.given, expected: round.question.expected,
                         title: v.correct ? "That balances!" : "Look again",
                         message: explain(round.question) })
        }
      />
    </SkillRound>
  );
}
```

The shell plays the answer sound, records the five learning events, scores the round, awards
the XP and draws the finish screen. None of that appears above, and none of it should.

---

## 6. Registry and course

```ts
// src/skills/registry.ts
export const SKILLS: Skill[] = [counting];

// Every activity from every skill, addressable as "skill/activity".
// This is the reuse surface — no cross-folder imports.
export const resolveActivity = (ref: string) => {
  const [skillId, activityId] = ref.split("/");
  return PLUGINS.find((p) => p.manifest.id === skillId)?.activities[activityId];
};
```

```ts
// src/curriculum/course.json — sequencing, and nothing else
export const COURSE: Unit[] = [
  {
    id: "u1", title: "Subitizing & Dot Matrix", icon: "🌱",
    lessons: [
      "counting/count-in-a-row",
      "counting/count-scattered",
      "counting/compare-groups",    // another skill, mid-unit. Fine.
      "counting/dice-patterns",
    ],
  },
  {
    id: "u2", title: "Ten-Frames & Place Value", icon: "⚡",
    lessons: [
      "number-bonds/part-whole",
      "number-bonds/making-10",     // the old counting L8. Now owned once.
      "base-ten/teen-numbers",
    ],
  },
];
```

Reordering the course, A/B-testing a sequence, or shipping a Grade 2 variant is a data change
here. No skill folder is touched.

---

## 7. Adding a new skill

> **`docs/SKILL_DEVELOPMENT.md` is the end-to-end walkthrough** — build order, the
> house rules, the traps, and the definition of done. This section stays the
> contract it all has to satisfy.

Start with [NEW_SKILL_PROMPT.md](NEW_SKILL_PROMPT.md). It routes to the compact
implementation guide and the specific references needed for a build. Counting is
the structural example; addition is the larger-skill completeness benchmark.
Use [SKILL_BUILD_TEMPLATE.md](SKILL_BUILD_TEMPLATE.md) when a release needs a
lesson-to-engine plan. Avoid loading historical build plans as default instructions.

### Curriculum standards — the rule

Each lesson carries its own `standards` array. Nobody validates it, so the rule is a
convention every skill follows rather than something the build enforces. Six lines:

1. **Copy the code, never invent it.** Take the exact published string —
   `CCSS.K.CC.B.4a`, not `K.CC.4a` or `CCSS.K.CC.B.4.a`. Format is
   `CCSS.<grade>.<domain>.<cluster>.<item>`, no spaces. A wrong code is worse than none,
   because a teacher will believe it.

2. **Check what an existing lesson used.** Before writing a code for "counting a row of
   objects", search `lessons.json` across the skills for a lesson teaching the same thing
   and reuse its codes. Two skills labelling one idea differently is the failure this rule
   exists to prevent, and grep is the only thing standing in the way.

3. **First is primary.** Skill Manager's lesson list shows `standards[0]` and nothing else, so
   put the code the lesson is chiefly about at the front. The rest are visible in the lesson
   detail panel. Order is meaning, not alphabetical.

4. **List what the lesson is assessed on, not what it brushes past.** The test: if a child
   fails this lesson, are they failing that standard? If not, leave it out. Three codes is a
   lot; one is normal.

5. **Empty is a real answer.** `"standards": []` means the framework has no code for this
   skill. Subitizing is the standing example — Quick Dice Patterns and Quick Dot Groups both
   ship empty, deliberately. Never reach for an approximate code just to fill the field.

6. **If it is empty, `trajectoryLevel` must not be.** A lesson may sit outside the official
   standards, but it may not sit outside both frameworks. The Clements & Sarama trajectory
   position carries the pedagogical claim when Common Core has nothing to say.

Two things are deliberately *not* in this list. There is no central table mapping concepts to
codes: skills own their own data, and the cost of that is drift you catch by reading, not by
tooling. And the codes drive nothing — they are displayed, never computed on. `conceptKey` is
the field that does the work, and unlike `standards` it must never be empty or invented,
because mastery tracking aggregates on it.

### 7.1 Tests and completion

Use [SKILL_DEVELOPMENT.md §11](SKILL_DEVELOPMENT.md#11-validation-matrix) for the
validation matrix and §14 for release checks. The shared contract/smoke tests do
not prove all modes or answer correctness. Add interaction, content, practice,
configuration, course and print checks as applicable; reuse the shared harness.

---

## 8. Lifecycle — from folder to learner

Only `draft` and `published` are supported (`ReleaseStatus` in
`src/skills/types.ts`). There is no beta status or beta opt-in stage.

| Stage | Status |
| --- | --- |
| Build and register code; append course units | `draft` |
| Build generates the server seed; server startup registers manifests | `draft` |
| Validate in Skill Manager preview and appropriate learner access | `draft` |
| Publish through Skill Manager when ready | `published` |
| Withdraw through Skill Manager if needed | `draft` |

Bundling a skill does not publish it. Visibility also depends on enabled state,
viewer access, audience and lesson age limits, and course placement. Check the
current resolver when diagnosing access rather than reimplementing it in a skill.

> **Distribution and publication are separate.** Activity code is still bundled so a lesson
> can run with no network. `npm run build` generates `server/app/skill_defaults.json`, and
> FastAPI registers those manifests in Mongo on startup. Mongo then owns `status`; Skill
> Manager publishes or moves a skill back to draft through `/v1/skills`. The browser keeps
> the last complete registry response only as an offline cache. A deploy refreshes code-owned
> metadata such as name and version but never overwrites an operator's publication choice.
> Each publication also records the operator id, display name and timestamp; returning to
> draft retains that last-publisher attribution and records who changed the status.
> The same Mongo record owns every durable field edited on the Skills page: enabled state,
> listing, feature flags, settings and lesson-content overrides. Local storage is an offline
> snapshot and coalescing outbox only; reconnecting uploads the last complete configuration.

---

## 9. Managing skills

`src/components/skills/SkillManagerPage.tsx`, rendered from `SettingsPage.tsx:188`, already
provides per-feature toggles, engine fine-tuning (speech rate, bounce scale, haptic
intensity), a live interaction sandbox, filterable action logs, and export/import of the
whole config as JSON.

Two changes make it a *skill* manager rather than a *counting* manager:

- **Read the registry.** `selectedSkillId` defaults to `"counting-mastery"`, the feature list
  reads `countingSkill.features`, and there is a literal "Reset Counting Defaults" button.
  Skill two would not appear.
- **Show release status**, so operators can distinguish draft skills from published ones.

---

## 10. Open decisions

- **Lazy loading.** `ActivityDefinition.component` can be a `React.lazy` import so each skill
  is its own chunk. Worth doing from the start — the bundle is already ~492 KB.
- **Runtime vs build-time.** This design is build-time. True third-party loading needs a
  frozen SDK, a loader, sandboxing, and a permissions model. Do not freeze an SDK validated
  against a single skill.
- **Two taxonomies.** `skillTreeRoadmap.ts` uses `stage_baseten` / `stage_fractions`;
  `types.ts` `TopicCategory` uses `base_ten_blocks` / `fraction_lab`, and each list has
  entries the other lacks. **Proposal: the skill id becomes canonical** (kebab-case, no
  prefix) and `TopicCategory` derives from the registry. Settle this before ids are baked in.
- **Versioning.** `manifest.version` exists but nothing reads it. Decide whether stored
  settings migrate when a skill's version changes.
- **Reclassify the fragment skills.** `step-header-tagger`, `feedback-drawer` and friends in
  `DEFAULT_PLUGINS` are UI fragments of counting, not skills. They should become `features` of
  the counting skill rather than peers of it.
