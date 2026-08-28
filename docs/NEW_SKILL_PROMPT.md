# The standard prompt for a new skill

Paste the block below into Claude Code, fill the four bracketed fields, and it produces a
registered, playable skill.

It is written from the two skills that exist. Every rule in it is something one of them
either needed or got wrong first — a bespoke top bar, a non-standard feedback message, XP
that never reached the learner. Keep it in sync with the contract: if `plugins/types.ts` or
`plugins/kit/` changes, this changes.

---

```
Build a new Koda skill plugin.

SKILL: [name, e.g. "Subtraction Steps"]
TEACHES: [what a child can do afterwards, in one sentence]
AGES: [e.g. 5-7]
LESSONS: [2-4 lesson titles, easiest first]

Read these first — they are the contract, not documentation:
- src/plugins/types.ts                    SkillPlugin, KodaSDK, ActivityProps, Lesson
- src/plugins/kit/                        the shared round: chrome, loop, scoring
- src/plugins/addition/                   the reference skill — copy its shape exactly
- docs/PLUGINS.md §7                      adding a skill, and the standards rule

Create src/plugins/<id>/ containing:
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
  index.ts        export const plugin: SkillPlugin — copy addition/index.ts
  internal/       optional, and private: nothing outside the folder may import it

Then register it in TWO places and nowhere else:
  src/plugins/registry.ts     one import, one entry in PLUGINS
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
  step header, feedback message and completion modal. Report an answer with
  `round.submit({ correct, given, expected, title, message })` — a wrong answer
  keeps the same question, which is what makes "right on the second try"
  different from "right first time" in the log.

RULES — these are what the architecture is for:

1. Metadata and curriculum are JSON. Only the activity is code.
2. Import nothing from another plugin folder. Reuse goes through
   "otherPlugin/activity" from a lesson, or through `kit/`. A cross-folder import
   is the one failure that ends modularity.
3. Touch the host only through the injected `koda` — including sound, haptics and
   speech. Never import from `utils/`. `themeSystem`, `components/ui` and
   `lucide-react` are fine.
4. Reuse an existing conceptKey when the skill teaches something an existing lesson
   already teaches — grep every lessons.json first. Mastery aggregates on conceptKey
   across plugins, so a new name for an old idea splits a child's record in two.
5. No XP anywhere in your skill. Not per question, not per lesson. One rate lives in
   Settings and `scoreRound` applies it; stars come from first-try accuracy.
6. Style through themeSystem tokens only. Check light AND dark. Never encode state in
   colour alone.
7. Every feature declared in the manifest must actually be read with
   koda.config.isEnabled(); every setting with koda.config.get(). A flag nothing
   reads is a lie in Plugin Lab.
8. Standards: copy published codes exactly, most-relevant first, only what the lesson
   is assessed on. Empty is a real answer when no code exists — then trajectoryLevel
   must be set. See docs/PLUGINS.md §7.

WHAT THE HOST GIVES YOU — `{ params, level, koda, lesson }`:
  params  the lesson's params merged over the activity's defaultParams
  lesson  { id, title, concept, levelNumber } — display only, for the chrome
  koda    sound, haptics, speech, progress, config, learning, log, ui

  Gotchas that cost time in the two skills that exist:
  - XP reaches the learner only through `koda.progress.awardXp`. `onComplete`
    records the result; it awards nothing. The hook does both for you.
  - koda.config is read at mount, not reactive. A Plugin Lab toggle applies on the
    next round; do not build for live updates.
  - Pass `expected` on the answer, or a slip is classified `unknown` instead of
    `off_by_one`.

VERIFY before saying it is done:
  npx tsc --noEmit -p tsconfig.json   clean
  npm run build                        clean
  - Plugin Lab lists the skill, its features toggle, its settings render
  - Every lesson opens from the Learn page and from a Plugin Lab preview
  - A perfect round shows three gold stars; a round with one mistake shows two
    gold and one hollow, and pays the two-star share of the XP in Settings
  - The Activity trail in Plugin Lab shows this skill's rows
  - Disabling the skill removes its lessons from the Learn page
  - Correct in light and dark, and on a narrow window
```

---

## What the kit already gives you

| Piece | What it owns |
|---|---|
| `useSkillRound` | index, attempts, first-try count, feedback, the five learning calls, scoring, XP |
| `SkillRound` | top bar, step header, feedback message, completion modal |
| `SkillRoundTopBar` | identity, progress, standing, voice, settings, fullscreen, sound, exit |
| `scoreRound` | stars from first-try accuracy, XP and coins from Settings |
| `PracticeStepHeader` | "Step 2 of 5", the framing tag, read-aloud and hint buttons |
| `PracticeRoundCompleteModal` | stars earned, rewards, what to do next |

A skill that writes any of these itself has gone wrong. Addition is 209 lines because it
writes none of them.

## The one skill that does not follow this

`counting` predates the kit. It uses the top bar, the step header, the completion modal and
`scoreRound`, but still runs its own round loop across fifteen level types. Read `addition`
for the pattern, not counting.
