# The standard prompt for a new skill

Paste the block below into Claude Code, fill the four bracketed fields, and it produces a
registered, playable skill.

Every rule in it is something a skill either needed or got wrong first — a bespoke top bar,
a non-standard feedback message, XP that never reached the learner. Keep it in sync with the
contract: if `src/skills/types.ts` or `src/skills/kit/` changes, this changes.

> **Counting is the reference skill.** It runs every one of its five activities on the kit's
> round loop, and its structural test file is two lines. Copy its shape.

---

```
Build a new Koda skill.

SKILL: [name, e.g. "Subtraction Steps"]
TEACHES: [what a child can do afterwards, in one sentence]
AGES: [e.g. 5-7]
LESSONS: [2-4 lesson titles, easiest first]

Read these first — they are the contract, not documentation:
- src/skills/types.ts                     Skill, KodaSDK, ActivityProps, Lesson
- src/skills/kit/                         the shared round: chrome, loop, scoring, praise
- src/skills/counting/                    the reference skill — copy its shape exactly
- src/skills/counting/counting.test.ts     what your test file should look like (2 lines)
- docs/PLUGINS.md §7                      adding a skill, and the standards rule

Create src/skills/<id>/ containing:
  manifest.json   id, name, version, description, tagline, thumbnail, category,
                  author, iconName, status, audience {ages, category}, teaches[],
                  requires[], features[], settings{}, settingsSchema[]
                  thumbnail is one string: an id from the SVG collection
                  (src/assets/svg — the Art page lists them) draws that artwork,
                  otherwise an emoji, an icon name, or an image URL
  lessons.json    one entry per lesson: id, title, concept, conceptKey, activity,
                  params, icon, iconName, iconTone, difficulty, pedagogyTip,
                  standards[], trajectoryLevel, ageBand
  activities/<Name>.tsx   the playable component
  index.ts        export const skill: Skill — copy counting/index.ts
  <id>.test.ts    describeSkillContract(skill); describeActivitySmoke(skill);
  internal/       optional, and private: nothing outside the folder may import it

Then register it in TWO places and nowhere else:
  src/skills/registry.ts      one import, one entry in SKILLS
  src/curriculum/course.json  a unit holding "<id>/<lesson-id>" refs, appended last
                              so existing level numbers do not shift

BUILD THE ACTIVITY ON THE KIT. It is not optional furniture — it is what makes two
skills one product:

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    nextQuestion: (index) => buildQuestion(params, index),   // yours
    onComplete,
  });

  <SkillRound koda={koda} lesson={lesson} round={round} ... >
    {/* the only part you draw: what the child touches */}
  </SkillRound>

  The hook owns the question index, attempts, first-try count, feedback, the five
  learning calls in the right order, scoring and XP. The shell owns the top bar,
  step header, feedback message and completion screen. Report an answer with
  `round.submit({ correct, given, expected, title, message })` — a wrong answer
  keeps the same question, which is what makes "right on the second try"
  different from "right first time" in the log.

RULES — these are what the architecture is for:

1. Metadata and curriculum are JSON. Only the activity is code.
2. Import nothing from another skill folder. Reuse goes through
   "otherSkill/activity" from a lesson, or through `kit/`. A cross-folder import
   is the one failure that ends modularity.
3. Touch the host only through the injected `koda` — including sound, haptics and
   speech. Never import from `utils/`. `themeSystem`, `components/ui` and
   `lucide-react` are fine. In particular, never call `playClip`, `playReaction`,
   `window.speechSynthesis` or `new Audio()` yourself: `koda.speech.say()` is
   what makes your skill go quiet while a child is talking to Koda, and a skill
   that goes around it talks over the conversation and into the open microphone.
4. Reuse an existing conceptKey when the skill teaches something an existing lesson
   already teaches — grep every lessons.json first. Mastery aggregates on conceptKey
   across skills, so a new name for an old idea splits a child's record in two.
5. No XP anywhere in your skill. Not per question, not per lesson. One rate lives in
   Settings and `scoreRound` applies it; stars come from first-try accuracy.
6. Style through themeSystem tokens only — `themeSystem.field()` for any input,
   `bg-surface` / `text-ink` / `border-line` for surfaces. Never a raw slate shade:
   that is a second definition of the surface and it is wrong in one theme.
   Check light AND dark. Never encode state in colour alone.
7. Every feature declared in the manifest must actually be read with
   koda.config.isEnabled(); every setting with koda.config.get(). A flag nothing
   reads is a lie in the Skill Manager.
8. Standards: copy published codes exactly, most-relevant first, only what the lesson
   is assessed on. Empty is a real answer when no code exists — then trajectoryLevel
   must be set. See docs/PLUGINS.md §7.

WHAT THE HOST GIVES YOU — `{ params, level, koda, lesson }`:
  params  the lesson's params merged over the activity's defaultParams
  lesson  { id, title, concept, levelNumber, totalLessons } — display only
  koda    sound, haptics, speech, progress, config, learning, log, ui

  Gotchas that have each cost a day:
  - XP reaches the learner only through `koda.progress.awardXp`. `onComplete`
    records the result; it awards nothing. The hook does both for you.
  - koda.config is read at mount, not reactive. A Skill Manager toggle applies on
    the next round; do not build for live updates.
  - Pass `expected` on the answer, or a slip is classified `unknown` instead of
    `off_by_one`.
  - `koda.speech.say()` resolves when the line has FINISHED, not when it started.
    If your activity says something the child must hear before the round reacts,
    await it — a fixed delay is a guess, and it was wrong on mobile.
  - A lesson with no conceptKey records no telemetry at all: the SDK refuses
    events it cannot attribute, so the learning log stays silently empty.

VERIFY before saying it is done:
  npx tsc --noEmit                     clean
  npm test                             clean — your two contract lines run here
  npm run build                        clean
  - The Skill Manager lists the skill, its features toggle, its settings render
  - Every lesson opens from the Learn page and from a Skill Manager preview
  - A perfect round shows three gold stars; a round with one mistake shows two
    gold and one hollow, and pays the two-star share of the XP in Settings
  - The finish screen names the right thing: a perfect round says so, a round
    that crossed a level says "Level N!", and the lesson line reads
    "Lesson 3 of 15" — "Level" on that screen means the learner's XP level
  - The Activity trail in the Skill Manager shows this skill's rows
  - Disabling the skill removes its lessons from the Learn page
  - Correct in light and dark, and on a narrow window
```

---

## What the kit already gives you

| Piece | What it owns |
|---|---|
| `useSkillRound` | index, attempts, first-try count, feedback, the five learning calls, scoring, XP |
| `SkillRound` | top bar, step header, feedback message, finish screen, the learner's standing |
| `SkillRoundTopBar` | identity, progress, standing, voice, settings, fullscreen, sound, exit |
| `scoreRound` | stars from first-try accuracy, XP from Settings, and whether the round was perfect |
| `roundPraise` | which achievement the finish screen congratulates — level, streak, perfect, goal, stars |
| `PracticeStepHeader` | the question, the framing tag, read-aloud and hint buttons |
| `composeHints`, `playCopy`, `SkillHint` | the hint ladder: the lesson's own tip, your rungs, the panel that reads them out |
| `PracticeRoundCompleteModal` | stars, XP won, streak, today's goal, level progress, what to do next |
| `playAnswerSound` | the recorded reaction to a right or wrong answer, behind the learner's own switches |
| `SPRING`, `stagger`, `idleFloat`, `useMotionOK` | the shared motion vocabulary — do not hand-tune a spring |
| `describeSkillContract`, `describeActivitySmoke` | the whole structural suite, inherited in two lines |

A skill that writes any of these itself has gone wrong.

## Hints

Pass `hints` to `SkillRound` and the Hint button appears; pass none and it does not. Three
rungs, gentlest first, built fresh on every render so they can describe what the child has
actually done:

```tsx
hints={composeHints(
  playCopy(params).kidTip,                    // 1. the lesson's own strategy
  `You have tapped ${tapped}. The next one is ${tapped + 1}.`,  // 2. this question, now
  `There are ${count} in the row — the last number you say is how many.`, // 3. worked
)}
```

`round.hint` owns which rung is showing, resets itself on the next question, and reports
each rung once as `supportUsed("hint", level)` — so the log can tell a nudge from a
walkthrough. Blank rungs are dropped, so a rung that only applies sometimes can be written
as an expression that is `undefined` the rest of the time.

Two rules the copy has to keep. **Say what is on screen**: the numbers in a hint come from
the live question and the child's own progress, never from an average case — build the
rungs in an exported pure function and test them, the way counting does. **Stop one step
short** where the child is choosing between answers, and go all the way where the answer is
produced by doing rather than by choosing.

The first rung is the lesson's `params.play.kidTip`, which means it is content: it ships in
`lessons.json`, is editable in the Skill Manager, and is read aloud, so write it to be
heard.

## Voice

**Your skill yields to Ask Koda automatically.** While the live voice coach is
running, `koda.speech.say()` returns without speaking and recorded praise stays
silent — the coach holds an open microphone, so anything your skill says is fed
back into the conversation as if the child had said it. You do not opt in and
there is nothing to wire; you only have to not go around the SDK. `docs/VOICE.md`
§ "Who has the speaker" has the mechanism and how to add another holder.


A skill's authored phrases are recorded once and played from disk — a child taps and hears
the word with no network in between. Put them in `audio/` with `npm run voice:record`, and
register them from `index.ts` the way counting does. An unrecorded phrase still speaks, just
slower, through live TTS; nothing breaks if you ship none.

## Why counting is the reference

It was the first skill and it once ran its own round loop across fifteen level types. It no
longer does: all five activities are on `useSkillRound`, its structural tests are the kit's
two lines, and its behaviour tests drive every activity through `expectStandardRound`. That
migration is what the kit is for, and it is why the pattern is worth copying rather than
described.
