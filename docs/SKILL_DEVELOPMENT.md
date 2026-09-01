# Building a skill

The end-to-end guide: what to read, what order to build in, and the mistakes
that have already been made so you do not make them again.

This is the practical walkthrough. It does not restate the contract — that lives
in the files below, and where they disagree with this page, they win.

| Read this | For |
|---|---|
| `src/skills/types.ts` | `Skill`, `KodaSDK`, `ActivityProps`, `Lesson` — the contract |
| `src/skills/kit/` | the shared round: chrome, loop, scoring, praise, hints |
| `src/skills/counting/` | the reference skill. Copy its shape, not its body |
| `docs/PLUGINS.md` §7 | adding a skill, and the curriculum-standards rule |
| `docs/NEW_SKILL_PROMPT.md` | the prompt that produces a registered, playable skill |
| `docs/VOICE.md` | everything the app says out loud |
| `docs/ADDITION_BUILD_PLAN.md` | a worked 52-lesson plan, phase by phase |

---

## 1. A technique is a lesson, not a component

The single most expensive mistake available here is building one component per
thing you teach. Fifty-two techniques is not fifty-two components — it is a
handful of **engines**, each owning one interaction, and fifty-two **lessons**
that configure them in JSON.

> An engine never asks which level it is. Mode is a lesson parameter.

`FrameFill` does not know that *Make 10* is level 19; it knows
`mode: "make_ten"`. That is what lets a fifty-third technique ship as data.

**Write an engine complete, with every mode it will ever have, the first time
you write it** — even when the lessons for half those modes arrive four phases
later. Addition's phases 6, 8 and 10 add nineteen lessons between them and touch
no `.tsx` at all, and that is only possible because the engines were finished
before their lessons existed.

A consequence to respect: `describeActivitySmoke` mounts every registered
activity, and an engine with no lesson yet is mounted on `defaultParams` alone.
**Those defaults must produce a playable question by themselves.**

---

## 2. Build order

1. **Groundwork.** The number generator and its tests, the size ladder, the
   colour roles, the artwork. Nothing is registered yet, so nothing can break.
2. **Scaffold plus the first engine.** `manifest.json`, `lessons.json`,
   `voice.json`, `audio/manifest.json` = `{}`, `index.ts`, the two-line contract
   test, one registry entry, one course unit.
3. **An engine at a time**, each complete, each with its behaviour driver.
4. **Lessons as JSON**, in level order.
5. **Voice script**, once the wording has stopped moving.
6. **Course placement and release**, last.

**Build in level order.** The contract test requires `params.level` to run
`1..n` with no gaps, so a phase always adds a contiguous block. Building in
engine order leaves a hole and fails.

Gate every step: `npx tsc --noEmit`, `npm test`, `npm run build`, and the lesson
opened in the real app. Not a harness — StrictMode double-mounts and
mobile-viewport bugs only show up there.

---

## 3. House rules

Each of these replaced something that was actually wrong on screen or in the log.

**One frame per question.** The scene is the only container. Addition shipped
with three frames nested — scene → bin → tile — and none of the inner ones said
anything the spacing and the operator were not already saying. The kit states
the principle itself: `SkillRound` draws no card around the question, because
boxes inside boxes is most of what makes a screen busy. An outline is allowed
only where it carries meaning — an empty group in *Adding Zero* has no objects
and no border would leave nothing on screen at all.

**Tap-to-place, never drag.** Tap the source, tap the destination. A
five-year-old's drag on a small touchscreen misses more often than it lands, and
pointer-drag cannot be driven by the test harness — a dragged interface is an
untested interface. Both halves are real buttons, so both get an `aria-label`.

**A refused move is not an answer, and not a hint.** Show a short transient line
saying why. Do not `submit` — the child has not answered — and do not open the
hint ladder, which files `supportUsed` against someone who never asked for help
and opens at the generic tip rather than the sentence that explains this
particular no.

**A tile nobody can press is not a button.** A disabled button announces as a
control that exists but is unavailable. Render it as a `div` with `role="img"`
and a label. It also keeps `h.buttons()` in the tests meaning "the child's
available moves".

**A group too big to draw is stated as its number.** Fourteen shapes beside one
shape is a blob beside a thing: a child cannot see "fourteen" in it, so the
shapes buy nothing and invite counting where the lesson is a rule.

**Never encode state in colour alone**, and never a raw slate shade — 
`themeSystem.field()` for any input, `bg-surface` / `text-ink` / `border-line`
for surfaces. Check light *and* dark. No amber or yellow: it fails against this
app's light surface.

---

## 4. Numbers

Every question generates fresh numbers, and every technique needs a *shape* of
number, not just a range: make-ten wants a pair that crosses ten, compensation
wants a second addend ending in 8 or 9, the place-value chart wants no carry and
partial sums wants one.

Put all of it in one module with declared constraints, and unit-test the
properties — 200 draws per spec, every one satisfying it. See
`src/skills/addition/internal/data/additionNumbers.ts`.

Four rules, each of which cost something:

1. **Constraints are hard.** One judge function, and everything returned passes
   through it — including values the module constructed itself. A constructor
   with a bug is exactly as wrong as a bad draw.
2. **Search is bounded.** Random draws, then a deterministic scan, then a throw.
   Never loop until you get lucky: that is a frozen tablet on the one spec
   nobody tried. An impossible spec is an authoring bug and should be loud.
3. **A mode's defaults belong to the mode.** Two silent bugs live in the
   alternative. Spreading a lesson's setup over a default writes `undefined` for
   every key the lesson omitted, so a mode meaning "start from four to nine"
   silently starts from one. And a range on `defaultParams` is inherited by
   *every* mode — count-all's `sumMax: 10` reached Adding One, whose declared
   range of 1 to 15 could then never exceed nine. Nothing failed; the lesson
   just did not teach what it said.
4. **No repeats inside a round.** Five questions that are all `3 + 4` is a
   broken round, and with small ranges it is not unlikely.

---

## 5. Speech

Read `docs/VOICE.md`. Three things matter while building:

- **Say everything through `koda.speech.say()`.** Never `playClip`, never
  `new Audio()`, never `window.speechSynthesis`. That method is where the app
  decides whether a skill may talk at all — the voice coach's floor, the
  learner's *Koda's Voice* switch, and the skill's own *Spoken voice* feature.
  Going around it talks over a live conversation and into an open microphone.
- **Declare only what something says.** A phrase in `voice.json` that nothing
  speaks is a clip nobody hears and an API call somebody paid for — the same
  failure as a feature flag nothing reads.
- **Reactions are per skill; clips are shared.** `"seven"` is `"seven"`, so a
  second skill saying it costs nothing. Praise is written for one subject and
  does not travel, so it is scoped by skill id.

`npm run voice:plan` shows every line, its file and its voice, with no key and
no cost.

---

## 6. Tests

**Structural — two lines, inherited.**

```ts
describeSkillContract(skill);   // manifest, lessons, refs, requires chain, settings
describeActivitySmoke(skill);   // every activity mounts and opens a round
```

That catches the class of bug that actually happens: a lesson pointing at a
renamed activity, a `requires` naming nothing, two lessons claiming one level, a
settings field describing a setting that does not exist. None are type errors —
they are strings inside JSON — and every one has shipped at least once.

**Behaviour — one driver per engine.** Only the skill knows what its buttons
mean; the kit asserts everything else. Two rules keep drivers stable:

- **Read the answer out of the telemetry, never recompute it.** A test that
  recomputes can drift from the activity; one that reads `learning.present`
  cannot, and a missing `expected` fails loudly instead of passing quietly.
- **Drive by accessible name.** If a driver cannot find a control, a screen
  reader cannot either. That is the bug, not the test.

**Pure functions for anything written *about* the screen.** Hint builders take
live state and return strings, exported and tested. A hint that says "you have
counted 3" while four objects carry a number is worse than no hint, and no
rendered test catches it.

---

## 7. Registering, and why a finished lesson can still be invisible

Three edits outside your folder, and no more: `src/skills/registry.ts`,
`src/curriculum/course.json` (appended last, so existing level numbers do not
shift), and a thumbnail SVG if you ship one.

**Two different numbers are both called "level".** `params.level` is the skill's
own ordering, which the contract test holds to `1..n`. The `levelNumber` a child
sees is the lesson's position in `course.json`. They agree only if the course
lists your lessons in `params.level` order.

**Four gates sit between a lesson and the Learn page**, and when a new lesson
does not appear it is almost always one of them rather than a bug:

| Gate | Where |
|---|---|
| `status: "draft"` | developer-only until you publish |
| Skill age range | `manifest.audience.ages` against the viewer |
| **Lesson age band** | `ageBand[0] > viewer.age + 1` hides it. The default viewer is age 6 |
| Not in the course | until its unit is appended, open it from a Skill Manager preview |

```js
localStorage.setItem("koda_viewer_v1", JSON.stringify({ age: 9, isDeveloper: true, showAllSkills: true }));
```

---

## 8. The traps

1. **A lesson with no `conceptKey`** files no telemetry at all — the SDK refuses
   events it cannot attribute, so the log stays silently empty.
2. **Reuse a `conceptKey` before inventing one.** Mastery aggregates on it
   across skills, so a new name for an old idea splits a child's record in two.
   `grep -r '"conceptKey"' src/skills/*/lessons.json` first.
3. **A missing `expected`** files every wrong answer as `unknown` instead of
   `off_by_one`.
4. **XP anywhere in a skill.** Never. One rate lives in Settings, `scoreRound`
   applies it, stars come from first-try accuracy.
5. **`koda.config` is read at mount, not reactive.** A Skill Manager toggle
   applies on the next round.
6. **`koda.speech.say()` resolves when the line has *finished*.** Await it where
   a child must hear it before the round reacts. A fixed delay is a guess, and
   it was wrong on mobile — `useSpokenFinish` exists for this.
7. **One `submit` per question.** Multi-box answers check once and submit once.
   Submitting per box files four answers for one question and wrecks first-try
   accuracy.
8. **A cross-folder import ends modularity.** Reuse goes through `kit/`, or a
   lesson referencing `"otherSkill/activity"`.
9. **A flag nothing reads is a lie in the Skill Manager.** Every declared
   feature must be checked with `config.isEnabled`, every setting with
   `config.get`.
10. **Standards: copy published codes exactly, or leave the array empty.** Empty
    is a real answer — then `trajectoryLevel` must not be. A wrong code is worse
    than none, because a teacher will believe it.

---

## 9. Done

- [ ] Imports nothing from another skill folder; touches the host only through `koda`.
- [ ] Built on `kit/` — `useSkillRound` for the loop, `SkillRound` for the chrome.
- [ ] Every lesson opens from the Learn page **and** a Skill Manager preview.
- [ ] A perfect round is three gold stars; one mistake is two gold and one hollow.
- [ ] The finish screen reads "Lesson N of M", and "Level" there means XP level.
- [ ] Correct in light **and** dark, and at 360px wide.
- [ ] Every feature toggles something; every setting is read.
- [ ] Disabling the skill removes its lessons from the Learn page.
- [ ] `tsc`, `npm test` and `npm run build` all clean.
