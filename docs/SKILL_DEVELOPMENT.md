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
| `docs/THEME.md` | the tokens, the primitives and the two widths |
| `src/skills/kit/practice.ts` | practice: the same engines with the help taken away |
| `src/voice/common/` | the shared voice: numbers, facts, subject-neutral praise |
| `src/lib/learning/practiceLog.ts` | what practice is measured on — pace, top speed, trend |
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
opened in the real app — at 360px, in dark as well as light, and once with the
network switched off. Not a harness: StrictMode double-mounts, mobile-viewport
bugs and anything that quietly needed a network only show up there.

---

## 3. The host, and what a skill may touch

Everything a skill needs from the app arrives as one injected object. Nothing
else is reachable, and that is the point: a skill that imports `playSound`,
`SkillStoreAPI` or app state has bound itself to this build of this app, and it
is also invisible to every switch a family has set.

| `koda.` | What it is for |
|---|---|
| `sound.play/isEnabled/setEnabled` | pops and chimes, behind the learner's Sound FX switch |
| `haptics.tap/success/pulse` | the vibration that matches a sound |
| `speech.say/stop/isEnabled` | anything said out loud — see §9 |
| `progress.awardXp/complete/snapshot/nextStep` | the learner's standing, shared across every skill |
| `config.get/isEnabled` | this skill's settings and feature flags, pre-bound to its id |
| `learning.*` | the five telemetry calls — see §10 |
| `ai.tutor/generateProblem/analyzeDrawing` | server-backed AI, proxied so no key reaches a skill |
| `log` | the Activity trail in the Skill Manager |
| `ui.theme/exit` | the current theme, and the way out of a round |

Three consequences worth stating outright:

- **XP reaches the learner only through `progress.awardXp`.** `onComplete`
  records a result; it awards nothing. The round hook does both for you, which
  is why a skill should never touch either directly.
- **`config` is read at mount, not reactive.** A Skill Manager toggle applies on
  the next round. Do not build for live updates.
- **`ai` and the voice coach are the only things here that need a network**, and
  both already fail soft — see §6.

`themeSystem`, `components/ui`, `lucide-react` and `motion` are fine to import.
`utils/` is not: it is the host's own drawer, and everything in it a skill
legitimately needs is already on `koda`.

---

## 4. House rules

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

**Two controls must never share an accessible name.** Where a control's natural
name can repeat — two chips both holding 5, two dials both rounding 47 — put its
position in the label. A screen-reader user otherwise cannot say which one they
mean or reach the second, and a test driver that presses by accessible name
silently hits the first every time, which surfaces as a flake rather than as the
accessibility bug it is.

**Never encode state in colour alone**, and never a raw slate shade — 
`themeSystem.field()` for any input, `bg-surface` / `text-ink` / `border-line`
for surfaces. Check light *and* dark, and at 360px. No amber or yellow: it fails
against this app's light surface. `docs/THEME.md` is the full contract — the
tokens, which primitive to reach for, and the one breakpoint that changes shape.

---

## 5. Mobile first, and 360px is the floor

The device this app is used on is a phone, often an old one, often held by a
five-year-old. A layout that works at 1280px and breaks at 360px is broken, not
"mostly working" — and the breakage is invisible from a desktop browser, which
is how it ships.

**One breakpoint changes shape**: `rail:` (720px), not Tailwind's `md`, because
768px runs through the middle of the devices this has to get right — an iPad
mini is 744px in portrait. Below `rail:` the app is a phone with a toolbar and a
bottom tab bar; above it, a sidebar rail. `docs/THEME.md` has the full contract.

Inside a round, the chrome is already responsive and already handles the phone —
the top bar is sticky and pads for the notch, the progress bar spans the width
below it, and the feedback strip sits where a thumb is not covering it. A skill
that adds its own top chrome is fighting all of that.

What the part you draw has to get right:

- **The play area fits 360×640 with no horizontal scroll on the page.** If a
  scene genuinely cannot shrink — a wide number line, a place-value chart — give
  it its own `overflow-x: auto` container. The page never scrolls sideways.
- **Touch targets are 44px, not 40.** The button scale already carries a
  `pointer-coarse:min-h-11` floor, so use `themeSystem.button` rather than a
  bespoke height. The variant keys off the input device, not the viewport: a
  tablet is a wide screen with fat fingers.
- **Tap-to-place, never drag** — see §4. This is a mobile rule before it is a
  testability one.
- **Never re-decide the shell.** No page padding of your own (`MainLayout` pads
  and centres), no bespoke `rail:` rules where a shared piece exists, and no
  `touch-action` or `overscroll-behavior` — the app sets those globally so a
  fast second tap counts instead of zooming.
- **Hiding with a class is not the same as not rendering.** `space-y-*` spaces a
  child it cannot see, so anything that disappears at one width inside a stack
  must return `null` — `useIsCompact()` in `lib/useBreakpoint.ts`.
- **A scene that scales, not one that reflows.** Every tappable size lives in
  one module per skill, as responsive steps —
  `src/skills/addition/internal/data/additionLayout.ts` is the worked example:
  `w-14 h-14 sm:w-20 sm:h-20 lg:w-[88px]`. Twelve engines picking their own
  sizes means a child meets a different finger target in every lesson of one
  skill, and an object still 88px wide on a 360px screen is a scene that has
  stopped fitting.

**Check it in the running app at 360px, not in a harness.** StrictMode's double
mount and mobile-viewport bugs only appear there, and the second is exactly the
class of bug this section exists to catch.

---

## 6. Offline is the default, not a fallback

Koda is used where the internet is unreliable. **Everything a child does works
with no network** — lessons, the course, the level picker, progress, XP and the
learning log are bundled JSON or `localStorage`, and a skill's artwork is inlined
into the bundle as markup rather than fetched. None of that is per skill, and
none of it is an error path: it is simply how the app is built.

Which means a skill has one job here — **do not be the thing that breaks it.**

- **An activity fetches nothing.** No `fetch`, no image URL, no font, no CDN.
  Generate your numbers locally (§7), draw with the SVG the bundle already
  carries, and let the host worry about the network.
- **Speech already degrades on its own.** `koda.speech.say()` plays a recorded
  clip if there is one, and falls through to the browser's local synthesis if
  there is not. Adding a skill downloads its clips deliberately
  (`lib/offlineSkill.ts`) so a child who enrolled on the sofa still hears Koda in
  the car; clips otherwise cache on first play. You get all of this by using the
  SDK and none of it by going around it.
- **Telemetry is local first.** `koda.learning.*` writes to the device ring and
  the durable rollup; a backend sink queues and retries. A round played on a
  train is recorded exactly like any other.
- **`koda.ai` is the one call that needs a network**, and it already falls back
  to a local Socratic response. The live voice coach is unavailable offline, by
  design. Never make a lesson's *progress* depend on either — a child must be
  able to finish a round with the aeroplane on.

If you ever do add something remote, the rule from everything else in this app
applies: **every fetch gets a deadline and a local answer.** A request with no
timeout is a spinner a child sits in front of on a bad connection, which is
worse than the answer you would have given them without it.

**Test it, because nothing else will**: DevTools → Network → Offline, reload,
and play a full round. `docs/PWA.md` lists what is precached and what each
network feature does without one.

---

## 7. Numbers

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

## 8. Practice, and the speed record

A skill is not finished at its last teaching lesson. Practice is the same
engines with the scaffolding taken away — several techniques mixed together, no
hints, no explanation, no voice — and it is a different act from being walked
through something, not a smaller lesson. It is also the only place the app can
honestly measure how *fluent* a child has become, so a skill that ships none
contributes nothing to the Practice log and shows no Practice section on its
path.

A practice lesson is JSON, like every other lesson:

```json
{
  "id": "practice-orbit",
  "title": "Practice: Touch and Count",
  "concept": "Practice Without Help",
  "conceptKey": "counter",
  "activity": "counting/orbit",
  "params": {
    "level": 16,
    "question": { "practice": true, "modes": ["row", "scatter", "compare"] }
  }
}
```

**`params.question.practice` is the flag, and the title is not.** The same field
is read in two places that must never disagree: `isPractice` in `kit/practice.ts`
turns the help off inside the round, and `isPracticeLesson` in the curriculum
decides where the lesson appears and how it is logged. A lesson *named* like
practice but not flagged is a teaching lesson that lies about itself, and the
course test asserts the two agree.

What an activity has to do to support practice, in three lines:

- `modeAt(setup, index, fallback)` picks this question's mode. It **cycles**
  `modes` rather than sampling, so a nine-question round over three modes covers
  all three — random selection leaves a child who drew badly practising one
  technique nine times and calling it mixed practice.
- `quietWhenPractising(say, practising)` wraps `koda.speech.say`. Returned as a
  function so the call site cannot forget the check.
- Pass no `hints` when practising. The Hint button disappears on its own at zero
  rungs, and a button with nothing behind it teaches a child that the app's
  controls are decorative.

**Wording.** Title it `Practice: <technique>` and set the concept line to
`Practice Without Help`. The flat lesson list needs that word — it is the only
thing telling the entry apart from the lesson that *teaches* the technique — but
the round chrome strips it (`withoutPracticeLabel`), because a screen that is
already practice does not need to say so twice above the question.

**`conceptKey` is the concept being practised**, not a new one. Practice is
deliberately kept out of the recommender for exactly this reason: one practice
lesson mixes several techniques under a single key, so a recommender reading it
as progress on that key reads it wrong.

**Place practice in its own unit**, appended after the teaching units. The Learn
page draws it as a separate section, and `curriculum/practice.test.ts` asserts no
unit mixes the two.

**What gets measured.** Every event from a practice round carries `practice:
true` (the host adds it from the flag), and `practiceLog.ts` reads speed off
those alone — a teaching round times how long Koda talked, not how long the
child thought. Three exclusions are worth knowing while authoring, because they
decide whether your questions can set a record at all:

| Not counted as speed | Why |
|---|---|
| An answer faster than 700ms | A tap that happened to land. Rewarding it teaches keypad-hammering |
| An answer with a support taken | Help is a signal, not a speed |
| Any attempt after the first | The answer is already on screen |

A learner is not ranked until eight practice answers, and "getting faster"
compares their most recent eight with their first eight. A round of five
questions therefore says almost nothing; nine or ten is the useful size.

---

## 9. Speech

Read `docs/VOICE.md`. Three things matter while building:

- **Say everything through `koda.speech.say()`.** Never `playClip`, never
  `new Audio()`, never `window.speechSynthesis`. That method is where the app
  decides whether a skill may talk at all — the voice coach's floor, the
  learner's *Koda's Voice* switch, and the skill's own *Spoken voice* feature.
  Going around it talks over a live conversation and into an open microphone.
- **Declare only what something says.** A phrase in `voice.json` that nothing
  speaks is a clip nobody hears and an API call somebody paid for — the same
  failure as a feature flag nothing reads.
- **Do not record what the app already says.** `"seven"` is `"seven"`, and
  `"Perfect!"` is as true of a story problem as of a ten-frame, so the digits,
  the number words, the shared place-value facts and subject-neutral praise live
  in `src/voice/common/` — a voice belonging to no skill, registered once from
  `main.tsx`. `npm run voice:record -- --skill <id>` skips whatever the pack
  already covers, so a new skill records only what is genuinely its own.

Two rules decide what the pack does for you, and they are worth knowing before
you write a phrase list:

- **Your own recording wins.** The pack fills gaps and never overwrites, in
  either registration order. Record `"seven"` in your skill's voice
  (`--force`) and yours is what plays.
- **Its praise is added to yours, not swapped for it.** A skill that has
  recorded no reactions still sounds finished on the day it ships; one that
  recorded `"Brilliant counting!"` keeps it *and* draws on the neutral pool,
  rather than repeating a single line after every answer for a whole round.

What has not changed: **one skill's words never reach another skill's round.**
Reactions are scoped by skill id, and the pack holds only lines that name no
subject — which is the test a phrase has to pass to go in it. `"Brilliant
counting!"` stays in counting.

`npm run voice:plan` shows every line, its file and its voice, with no key and
no cost.

---

## 10. What your skill records

The learning log is the product's memory: the recommender, the mastery status a
parent reads, and the Practice log all fold the same events. A skill reports
facts and never statistics — response time, attempt index, accuracy, medians and
error classification are all derived by the SDK, so two skills cannot disagree
about what "accuracy" means.

Five calls, in order, and `useSkillRound` already makes all five for you:

```
startLesson(entry)   → present(question) → [supportUsed(kind, level)]
                     → answered(report)  → completeLesson({ stars, xpEarned })
```

What you actually have to get right is the content of two of them:

- **`present` carries the prompt and the `expected` answer.** Without `expected`
  every wrong answer files as `unknown` instead of `off_by_one`, which is the
  difference between "she has the idea and slipped" and "she did not run the
  procedure".
- **`answered` reports one answer per question.** A multi-box answer checks once
  and submits once; submitting per box files four answers for one question and
  wrecks first-try accuracy.

And one thing that lives in `lessons.json` rather than in code:

- **`conceptKey` is the unit of mastery, and it is shared across skills.** Reuse
  an existing key before inventing one — `grep -r '"conceptKey"' src/skills/*/lessons.json`
  — because a new name for an old idea splits a child's record in two. A lesson
  with no key records **nothing at all**: the SDK refuses events it cannot
  attribute, so the log stays silently empty.

`docs/LEARNING_LOG.md` is the full schema, including what is deliberately not
stored.

---

## 11. Tests

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

## 12. Registering, and why a finished lesson can still be invisible

### What the skill is called, and what it looks like

**Name it for what it teaches.** `Counting`, `Addition`, `Fractions` — not
`<Topic> Quest`. That suffix is identical on every skill, so it carries no
information while costing the places the name is squeezed: the Today card's 10px
eyebrow, the compact row's meta line, the round bar's truncated title. It also
stops scaling — this app goes to grade 12, where the same scheme produces
"Quadratic Equations Quest" for a fifteen-year-old who reads it as an app for
their little brother. Koda is the character; a skill does not need to be one too.
The `tagline` does the inviting, and does it better.

| Field | What it is |
|---|---|
| `name` | code-owned. Re-seeded from your manifest on every boot, client and server |
| `tagline` | the one line under the name. Blank falls back to `description` |
| `thumbnail` | one string: an art id from the Art page, else an emoji, an icon name, or an image URL. Empty falls back to your first lesson's `iconName` on the category gradient |
| `author` | the byline in the Skill Manager list and on the Learn page. Free text, so spell it identically across your skills |

A deployment can rename a skill and reword its tagline from the Skill Manager's
**Listing** tab. A rename is stored as `title`, a separate field that wins over
`name` on every learner surface — never as an edit to `name`, which the next
deploy would overwrite. `skillTitle()` is the one place that decides, so a
rename cannot reach Home but miss the Learn page.

### The three edits

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

A practice lesson has a fifth thing to get right: without
`params.question.practice`, it is drawn in the teaching path rather than the
Practice section, keeps its help, and files no speed data.

```js
localStorage.setItem("koda_viewer_v1", JSON.stringify({ age: 9, isDeveloper: true, showAllSkills: true }));
```

---

## 13. The traps

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
11. **A practice lesson without `params.question.practice`** is a teaching
    lesson wearing the word: full scaffolding, wrong section of the path, and
    invisible to the Practice log.
12. **A skill with no practice lesson** produces no speed data at all. Mastery
    still works; "is she getting faster?" has no answer.
13. **A `fetch` anywhere in an activity** breaks the one promise the whole app
    keeps — that a child on a bad connection can still finish a round. §6.
14. **A scene checked only on a laptop.** 360px is where it breaks, and a
    desktop browser will never tell you. §5.

---

## 14. Done

- [ ] Imports nothing from another skill folder; touches the host only through `koda`.
- [ ] Built on `kit/` — `useSkillRound` for the loop, `SkillRound` for the chrome.
- [ ] Every lesson opens from the Learn page **and** a Skill Manager preview.
- [ ] Ships practice: flagged, in its own unit, and reaching the Practice log.
- [ ] Named for what it teaches, with a tagline, a thumbnail and an author.
- [ ] A perfect round is three gold stars; one mistake is two gold and one hollow.
- [ ] The finish screen reads "Lesson N of M", and "Level" there means XP level.
- [ ] Correct in light **and** dark, and at 360px wide with no sideways scroll.
- [ ] Plays a full round with the network off, including a second run of the same
      lesson.
- [ ] Every feature toggles something; every setting is read.
- [ ] Every question files `expected`, and one answer per question.
- [ ] Disabling the skill removes its lessons from the Learn page.
- [ ] `tsc`, `npm test` and `npm run build` all clean.
