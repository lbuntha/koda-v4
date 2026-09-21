# Counting — Smart Guide rollout plan

**Skill id:** `counting` · **15 teaching lessons on 5 engines** · 5 practice lessons
excluded by design.

The offline coach shipped on one lesson (`count-in-a-row`) on 2026-09-19. This plan
takes it across the other fourteen without letting it become fourteen different
coaches — which is the only real risk here, and the one the user named: *"make sure
the smart guide is simple and easy to follow."*

> **Read first:** `src/skills/counting/internal/guide/countGuide.ts` — the signals and
> the ladder are documented there, and this plan does not repeat them.

---

## Status — built, 2026-09-19

All **15 teaching lessons on 5 engines** are coached. The 5 practice lessons are not,
and will not be: practice *is* the lesson with the scaffolding removed.

| Phase | |
|---|---|
| **P1** lift to the kit | done — `kit/round/useGuide.ts` |
| **P2** merge the two ladders | done — opt-in via `SkillRound`'s `guide` prop |
| **P3–P7** five engines | done — orbit, ten-frame, number line, Quick Looks, base-10 |
| **P8** voice pack | **not done, and deliberately** — see §6 |
| **P9** gate | lint exit 0 · **3,718 tests** · build clean (precache 3,450 KiB) |

Cross-skill gate (§5): **2,079 tests** across addition, subtraction, division,
fractions, multiplication, the kit and the UI kit, with **not one of their files
modified**. The merge stayed opt-in.

### What building it changed about the plan

- **The wording is not new copy.** Each engine already wrote three rungs off live
  state for the Hint button. Merging the ladders made those *the* words, so the work
  became tightening them rather than authoring a second set — which is also the only
  version of this that could stay consistent across five engines.
- **§1.1's contract test is real and it earns its place.** It caught Quick Looks
  shipping a 26-word rung on the first run. The limit is 16 words, checked for every
  engine in every mode.
- **Hop mode got fewer signals than the table promised**, because the Hop button is
  guarded: a child cannot overshoot or land badly, so stalling is all there is to see.
  Inventing a second signal would have meant inventing a mistake they cannot make.
- **The Hint button is a plain toggle.** The plan implied it would climb; between
  climbing, "Got it" and the page arrows the bubble would have carried four controls.
  Climbing is the coach's job instead.

---

## 0. Decisions taken before drafting

### 0.1 One ladder, not two

Today a lesson has two help systems: the Hint button (grey lightbulb, child pulls it)
and the coach (indigo bubble, Koda pushes it). Both are three rungs. Both are worded
separately. Across fifteen lessons that is two vocabularies a child has to learn, which
is the opposite of the goal.

**So they merge.** The coach's ladder becomes the skill's only ladder; the Hint button
stops owning a panel and becomes *"show me now"* — it raises the same bubble at rung 1
and climbs the same rungs.

```
Hint pressed      ->  bubble, rung 1        (child asked)
Stalled 7s        ->  bubble, rung 1        (Koda offered)
Still stuck       ->  rung 2 — the light
Still stuck       ->  rung 3 — walked through
```

One half of this is already done: the bubble carries the Hint button's own lightbulb
rather than a sparkle, so the mark a child presses and the panel that answers are the
same mark. What is left is the wiring.

**The constraint this creates.** `SkillHint`, `HintController` and the Hint button are
*shared kit* — addition, subtraction, division, fractions, multiplication and the rest
all use them. This merge must be **opt-in per round**: a round that mounts a guide
routes its Hint button into the guide; a round without one keeps `SkillHint` byte for
byte. Phase 2 does not get to touch another skill's behaviour, and §5 gates on that.

### 0.2 Quick Looks show the dots again, grouped

The three subitizing lessons flash a set and ask for a number. There is no "next object
to touch", so rungs 2 and 3 have nothing to point at. Instead:

- **Rung 2** re-flashes, slower. The engine already has a "Show me again" button and a
  `reveal` support kind, so this is wiring, not invention.
- **Rung 3** leaves the dots on screen and splits them into a five and some more —
  the strategy the lesson teaches, made visible rather than described.

Rung 3 never narrows the answer buttons. Lighting two of them would turn a counting
question into a coin toss, and the log would record it as a correct answer.

---

## 1. The simplicity contract

The rollout's real failure mode is not a bug, it is drift: fourteen lessons each
wording their help slightly differently until the coach has no voice. These are the
rules, and §1.1 makes them a test rather than an intention.

1. **One cue on screen, ever.** Never two panels, never a cue while feedback shows.
2. **One sentence, ≤ 16 words.** If it needs more, it is a page, not a sentence.
3. **Three rungs, same three, every engine:** say it → show it → walk it.
4. **One spoken vocabulary.** Every `say` string comes from the shared phrase bank
   (§6). The screen may name the lesson's own nouns; the voice may not.
5. **One place, one way out.** Bubble above the work, tail on it, "Got it".
6. **Silence is the default.** No cue before 5s of stillness, ever, on any engine.
7. **The coach never answers a question the child is choosing between.** Where the
   answer is produced by *doing* (tapping every object, filling a frame), rung 3 may
   say it. Where it is produced by *choosing*, rung 3 stops one step short.

### 1.1 `counting.guide.contract.test.ts` — the rules, enforced

One test file, run against every engine's `cueFor` over a sweep of states:

| Asserts | Catches |
|---|---|
| every cue ≤ 16 words, one terminator | an engine that starts explaining |
| every `say` is in the phrase bank | an unrecordable line, and vocabulary drift, in one check |
| every engine yields exactly 3 rungs | a fourth rung nobody else has |
| rung 1 never carries a target | a words-only rung that lights something |
| no cue on a *choosing* engine contains the expected answer | rule 7, mechanically |

Rule 4 is the load-bearing one: because the bank is finite and declared, "is this
recordable" and "does this sound like the same coach" become the same question.

---

## 2. Architecture — one engine, five adapters

What exists is already split the right way; it is just in the wrong folder.

| Piece | Today | After phase 1 |
|---|---|---|
| timing, ladder, pause, dismiss, logging | `counting/internal/guide/useCountGuide.ts` | `kit/round/useGuide.ts` |
| signals, wording, target | `counting/internal/guide/countGuide.ts` | stays — becomes the *orbit adapter* |
| the bubble | `components/ui/UIGuideBubble` + `kit/chrome/SkillGuide` | unchanged |

An engine supplies an adapter and nothing else:

```ts
export interface GuideAdapter<Q, S> {
  /** Odd moves this engine can see. Called on every interaction, including
   *  the ones the engine throws away — that is where the signal lives. */
  signalFor(question: Q, state: S, move: Move): GuideReason | null;
  /** What to say and what to light, for a rung. Pure, so §1.1 can sweep it. */
  cueFor(input: CueInput<Q, S>): GuideCue;
  /** What rung 2 points at, or -1. */
  targetFor(question: Q, state: S): number;
}
```

The kit owns *when*; the adapter owns *what*. That split is what keeps five engines
sounding like one coach.

---

## 3. The lesson table

14 lessons. `→` is the rung-2 target.

### Orbit — `TouchOrbit` (2 lessons, adapter exists)

| Lesson | Signals | → | Rung 3 |
|---|---|---|---|
| `count-scattered-objects` | stalled · recount · wandered | next untagged object | light follows; scene hushes |
| `comparing-two-groups` | stalled · recount · one group counted, other not | the uncounted group | both counts named, verdict withheld (rule 7) |

Wording already exists in `orbitHints` for both. Mostly a `guide` block and tests.

### Ten-frame — `TenFrameRocket` (3 lessons)

State is `frame: boolean[10]`, changed by `toggle(idx)`. The cleanest spotlight in the
skill: a cell is already a discrete, highlightable thing.

| Lesson | Signals | → | Rung 3 |
|---|---|---|---|
| `ten-frame-5-and-more` | stalled · filled bottom row while top has gaps · overfilled past target | next top-row gap | light walks cell to cell |
| `making-10` | stalled · answered past 10 | first empty cell | counts the gaps aloud, stops short of the number (choosing) |
| `teen-numbers` | stalled · second frame started before first is full | next cell in the unfinished ten | "one full ten and some more" made visible |

"Fill the top row first" is the taught strategy, so filling the bottom first is a real
signal and not pedantry.

### Number line — `FroggySkip` (3 lessons)

| Lesson | Signals | → | Rung 3 |
|---|---|---|---|
| `skip-counting-by-2s-and-5s` | stalled · overshot the target | the pad the next hop lands on | pad + Hop button lit, sum said aloud |
| `count-by-10s-up-to-100` | same | same | same |
| `find-the-missing-number` | stalled · wrong option chosen | the gap in the sequence | the step named, the number withheld (choosing) |

Hop mode has one button, so "wrong move" is only overshooting — fewer signals here, and
the plan should not invent more to make the table look even.

### Quick Looks — `SubitizingRush` (3 lessons)

Per §0.2. Reuses the existing "Show me again" and the `reveal` support kind.

| Lesson | Signals | Rung 2 | Rung 3 |
|---|---|---|---|
| `quick-dice-patterns` | stalled in `answering` · wrong choice | re-flash, slower | pattern held on screen, read as a domino |
| `quick-dot-groups` | same | re-flash, slower | split into a five and some more |
| `two-color-groups` | same | re-flash, slower | held on screen, one colour at a time |

### Base-10 — `Base10Foundry` (3 lessons)

This engine **already has a rejected-move channel**: `refused` per place column, drawn
through `SkillRound`'s `nudge`. Phase 7 routes that into the coach rather than adding a
second one beside it — two things saying "not that" is exactly the drift §1 forbids.

| Lesson | Signals | → | Rung 3 |
|---|---|---|---|
| `make-a-ten` | stalled · `refused` · ten ones sitting unbundled | the ones column | the bundle move walked through |
| `make-a-hundred` | stalled · `refused` · ten tens unbundled | the tens column | same, one place up |
| `build-numbers-with-hundreds-tens-ones` | stalled · `refused` · overshot a place | the place still short | each place named in turn |

---

## 4. Phases

Each phase is shippable and ends at a gate. **Gate = `npm run lint` · scoped vitest ·
360px pass in light and dark.** The full suite and `npm run build` run at P2, P8 and P9
only — they cost two minutes and the scoped run is 30 seconds.

| # | Phase | Ends when |
|---|---|---|
| **P0** | Baseline, recorded 2026-09-19 (below). | done |
| **P1** | Lift timing/ladder to `kit/round/useGuide.ts`; orbit becomes the first adapter. **No behaviour change.** | lesson 1's 19 tests pass untouched |
| **P2** | Merge the Hint button into the guide, opt-in per round (§0.1). | counting hint tests rewritten; **every other skill's hint tests pass unmodified** |
| **P3** | Orbit: scatter + compare. | 2 lessons, contract test green |
| **P4** | Ten-frame: 3 lessons. | cell spotlight working |
| **P5** | Number line: 3 lessons. | pad spotlight working |
| **P6** | Quick Looks: 3 lessons, per §0.2. | grouped reveal working |
| **P7** | Base-10: 3 lessons; `refused` routed into the coach. | the old `nudge` path is gone, not doubled |
| **P8** | Voice pack (§6): record the bank once. | `voice:plan` reports 0 missing |
| **P9** | Gate + publish: full suite, build, 360px sweep of all 15. | deployed |

### P0 — the baseline, 2026-09-19

Measured after the mobile pass, so a regression in any later phase is visible against a
real number rather than a memory:

| | |
|---|---|
| `npx vitest run src/skills/counting` | **9 files, 166 tests** |
| `npx vitest run src/components/ui/uiGuideBubble.test.tsx` | **9 tests** |
| `npm test` (full) | **226 files, 3692 tests** |
| `npm run lint` | exit 0 — note it runs the *root* `tsconfig.json`, which is the lenient one. Real strict checking needs a `tsconfig.check.json` copy of `tsconfig.app.json` with `types` set to `["vite/client","vitest/globals"]`; the repo has ~146 pre-existing errors under it, so compare against a baseline rather than expecting zero. |
| `npm run build` | clean, PWA precache 31 entries / 3441 KiB |
| Lessons carrying a `guide` block | **1 of 15** |
| Coach clips recorded | **0 of 18 declared** |

P1 and P2 carry all the risk and touch no lesson. P3–P7 are repetitive and low-risk.
**If the budget runs out, stopping after any phase leaves a working app** — lessons
without a `guide` block behave exactly as they do today.

---

## 5. What P2 must not break

The merge is the one change that reaches outside counting. Before it lands:

```bash
npx vitest run src/skills/addition src/skills/subtraction src/skills/division \
  src/skills/fractions src/skills/multiplication src/skills/kit
```

Those skills must pass **unmodified**. A diff to any of their test files during P2 is
the signal that the merge stopped being opt-in.

---

## 6. Voice pack — not done, and the reason matters

The 18 coach lines declared before the merge have been **removed** rather than
recorded. They were short stand-ins for wording the coach no longer uses: it now
speaks the hint ladder, and those rungs carry counts, nouns and how far the child has
got. That is not a set anybody can record.

So the spoken half takes the server-TTS path and then the browser's own voice —
**exactly as the hint panel always has**, on every skill in the app. Nothing regressed;
the coach simply inherited the voice behaviour of the thing it merged with.
`voice:plan --skill counting` reports **72 phrases, 0 missing**.

Making it instant is a real piece of work and it is a *copy* pass, not a recording run:
it means rewriting the ladder in a finite vocabulary so the lines are enumerable, then
passing them to `useGuide`'s `spoken` array, which exists and is unused. Worth doing —
the coach speaks at the moment a child has stopped, and that is the one place in this
skill where latency is the pedagogy — but worth doing deliberately, and not by
recording eighteen sentences that will be reworded again.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **The merge breaks another skill's hints.** The single largest risk in the plan. | Opt-in per round; §5's cross-skill run is P2's gate. |
| **Fourteen lessons drift into fourteen voices.** | §1.1's contract test, and the phrase bank being finite. |
| **The coach becomes chatty and children learn to wait for it.** | Rule 6's 5s floor; the patience already shortens only *within* a question and resets. Worth watching in the learning log: `supportUsed("walkthrough")` per question should fall as a child improves, and if it does not, the thresholds are wrong. |
| **Rung 3 gives away an answer that was meant to be chosen.** | Rule 7, enforced in §1.1 for the choosing engines. |
| **Voice cost spent twice.** | Record at P8, never before. |

---

## 8. Open, deliberately

- **Does the coach belong in other skills?** Addition and subtraction have the same
  shape of problem. The kit split at P1 makes it possible; nothing here commits to it.
- **Should a parent see how often it fired?** The data is already filed as
  `supportUsed("walkthrough", rung)`. Surfacing it belongs with the parent
  progress work, not here.
