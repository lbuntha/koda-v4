# Building a Koda learning skill

Implementation guide for `src/skills/` learning activities. Start with
[NEW_SKILL_PROMPT.md](NEW_SKILL_PROMPT.md); use
[SKILL_BUILD_TEMPLATE.md](SKILL_BUILD_TEMPLATE.md) for a larger curriculum or a
lesson JSON example. These are app skills, not Codex `SKILL.md` packages.

## Read only what the task needs

Read this guide once. Code types and executable tests resolve API disagreements.
Inspect one relevant reference engine and expand only when it lacks the behavior
needed. Avoid reading entire skill directories or historical build plans.

Read the ranges, not the files. `types.ts` is 569 lines and a builder needs
about 150 of them; a production engine is 600–1,000 lines of animation and modes
around a contract that is 100. Opening whole files is most of the cost of a build.

| Need | Read |
|---|---|
| **The whole contract, minimal** | **`src/skills/kit/example/ExampleActivity.tsx`** — start here |
| Interfaces | `src/skills/types.ts`: `KodaSDK` (64), `ActivityProps` (231), `Lesson` (381), `Skill` (552) |
| Registration pattern | `src/skills/counting/index.ts` |
| Round lifecycle/chrome | `useSkillRound.ts` `UseSkillRoundOptions` (52) and its return (451); `kit/chrome/SkillRound.tsx` props only |
| Interaction example | The example above. A real engine under `counting/activities/` or `addition/activities/` only for behaviour it does not show |
| Practice | `src/skills/kit/practice.ts`, addition's practice tests |
| Hints | `src/skills/kit/round/hints.ts`, the selected engine's hint builder/tests |
| Artwork/theme | `docs/THEME.md`; `docs/PLUGINS.md` §5 for asset registration |
| Spoken content | `docs/VOICE.md`; inspect `src/voice/common/` before declaring shared phrases |
| Standards | `docs/PLUGINS.md` §7, curriculum standards |
| Print support | `WorksheetSource` in `types.ts`, `src/lib/worksheet.ts`, one reference adapter |
| Publication | `docs/PLUGINS.md` §8 |

## 0. The rules that fail silently

Everything here is a mistake that leaves no trace: nothing throws, no test goes
red, and the skill looks finished. Check them before saying a skill is done.

| Rule | What happens if you miss it |
|---|---|
| `requires` takes conceptKeys, not lesson ids | The prerequisite never matches, so the lesson unlocks out of order |
| `params.level` is distinct and contiguous from 1 | Lessons collide or gap; ordering silently misbehaves |
| Practice is `params.question.practice: true` | Titled "Practice" but scored and hinted as teaching |
| `iconTone` is one of amber, cyan, indigo, purple, pink, emerald | Anything else becomes indigo without complaint |
| Gate your own `speech.say` on `audio_speech` | The kit covers intro, hints and reactions only — your line still speaks |
| `assets/` stays flat | The glob misses subdirectories; nested art is absent, not broken |
| Every declared feature changes behaviour and has a test | A dead switch in the Skill Manager |
| Presentation applies to distractors too, not the answer alone | The answer is the item that looks different; the task is bypassed |
| `expected` on every question | The log records what the child did but not what was asked |
| Register in `registry.ts` **and** `course.json` | Built, tested, and invisible |
| `npm run voice:plan -- --skill <id>` reports 0 missing | Publishes with silent lessons |


## 1. Lessons configure engines

An engine owns an interaction; lessons configure it through modes and constraints.
Never branch on lesson/level number to select the teaching method. Map objectives,
prerequisites, modes, hints and practice before implementing a large curriculum.
Build the modes needed for the planned release; extend engines when later lessons
need new behavior. Counting shows the basic shape; addition shows a larger release.

A skill registers as many activities as it has interactions; counting has five.
Add a mode when lessons differ by configuration, and a second activity when the
screen itself differs — a different apparatus, or a layout the existing component
cannot express. Lessons name the one they use through `activity`.

Check the registry for reuse first. Lessons can reference `otherSkill/activity`;
code must not import another skill's internals. Shared implementation belongs in
`kit/`. Verify that reused engines support the intended copy, settings and modes.

## 2. Build order and files

1. Define the release's lesson-to-engine map and question constraints.
2. Build one complete playable engine with generator checks and a behavior driver.
3. Add lessons in contiguous `params.level` order; extend engines as needed.
4. Add practice coverage, hints, assets and supported worksheet adapters.
5. Finalize voice wording, course placement and release checks.

Required folder shape:

```text
src/skills/<id>/
  manifest.json          metadata, features, settings and settingsSchema
  lessons.json           { "lessons": [...] }
  index.ts               export const skill: Skill; activity/art/voice registration
  activities/*.tsx       interaction components
  <id>.test.ts           inherited contract and smoke tests
  voice.json             speech declarations per docs/VOICE.md
  audio/manifest.json    {} before recording
  internal/              helpers when needed
  assets/                skill-owned SVG when needed
```

Add behavior and pure-function tests where §11 calls for them. Do not create empty
helper files or unused assets. Activity defaults must open a playable question
without a lesson. Keep mode-specific ranges in the mode's defaults.

The host shallow-merges activity defaults and lesson params. Reference engines
normalize `{ ...params, ...params.question }`; `params.play` remains authored copy.
Do not overwrite valid defaults with `undefined`. See the template's complete JSON.

Run focused checks after meaningful edits. Run the full release checks once the
implementation is ready; repeat them only for changes or failures that warrant it.

## 3. Host boundary and round

Receive `{ params, level, koda, lesson, onComplete }` through `ActivityProps`.
Use `useSkillRound` for question sequencing, retries, scoring, XP and learning
calls; `SkillRound` owns chrome, feedback and completion. Draw the interaction.

- Supply questions with stable `id`, `taskKind`, `prompt` and `expected`.
- Submit one verdict per answer attempt with `round.submit({ correct, given,
  expected, title, message })`. Wrong answers retain the current question.
- Do not award XP or manually duplicate the hook's learning/completion calls.
- Use `koda.sound`, `haptics`, `speech`, `config`, `ai`, `log` and `ui` for host access.
  No direct app state, `utils/`, storage, audio constructors or speech APIs.
- Registration in `index.ts` uses the host art/voice registrars as counting does.
  `themeSystem`, shared UI primitives, `lucide-react` and `motion` are allowed.
- Feature/settings changes take effect on the next mount. Shared kit/SDK readers
  count; do not duplicate their work inside every engine.

## 4. Interaction and accessibility

Use one scene frame; additional outlines should convey meaning. Tap source then
destination for placement interactions; use real, labelled buttons. A refused
intermediate move shows a short explanation without submitting an answer or
recording a hint. Noninteractive objects should not appear as disabled controls.
Distinguish repeated control labels by position. Support keyboard access and
never convey state through color alone.

Use live-state hints: lesson `kidTip`, a contextual nudge, then worked guidance.
`composeHints` removes empty rungs; `SkillRound` owns hint state and reporting.
For answer-choice tasks, stop short of revealing the choice; for action-based
tasks, explain the action fully. Do not use a generic hint to explain a refused move.

## 5. Mobile and theme

Use `themeSystem` and shared primitives: `field()` for inputs, `bg-surface`,
`text-ink`, `border-line` for surfaces. Follow `docs/THEME.md` for color roles;
avoid raw slate surfaces and low-contrast amber/yellow foregrounds.

A lesson's `iconTone` is a closed set — amber, cyan, indigo, purple, pink,
emerald (`lessonIconTones` in `src/components/ui/lessonIcons.ts`). Anything else
resolves to indigo without complaint, so a made-up tone is a silent wrong colour,
not an error.

Fit 360×640 without page-level horizontal scrolling; a wide apparatus may scroll
inside its own container. Use the button scale's 44px coarse-pointer floor.
Centralize repeated apparatus sizes, as `additionLayout.ts` does. The shell owns
page padding, top chrome and global touch behavior. Use `rail:` (720px) for shell
shape changes only when a shared component does not already handle them.
Check light and dark in the real app. If a hidden child affects stack spacing,
conditionally render it instead of only hiding it with CSS.

## 6. Offline

Generate questions locally; bundle artwork. Activities must not fetch remote
assets or depend on AI/network responses to complete. Speech and telemetry use
the SDK's fallback/queue behavior. Speech availability still depends on installed
clips or device voices; verify it on the target device. See `docs/PWA.md` for cache
behavior when diagnosing offline failures.

After loading/enrolling online, switch the running app offline, reload, complete
a round, and open the lesson again. Test the actual app, including StrictMode,
rather than assuming a component harness establishes offline readiness.

## 7. Question generation

Use pure generators with declared constraints. Verify mathematical/content
correctness independently of the generator's reported answer. Include boundary
cases and sampled properties for each distinct specification.

Bound random search, then use a deterministic fallback where appropriate; throw
for impossible authoring specifications. Avoid repeats with bounded retries and
a round-local `seen` set. If the valid question space is exhausted, allow a repeat
rather than hang. Addition's `withoutRepeat` is the reference behavior, not a
strict uniqueness guarantee. Reset question state and round-local memory on replay.

Where a question draws distractors, apply presentation to the whole set, never to
the answer alone. Scale, opacity, colour treatment, rotation and occlusion applied
only to targets make the answer the one item that looks different, which a learner
solves without doing the task — and no test sees it, because the answer is still
correct. Difficulty belongs in the distractors' similarity and count.

## 8. Practice

The flag is `params.question.practice: true`, never the title. Use title
`Practice: <technique>`, concept `Practice Without Help`, and the conceptKey being
practised. Append practice in separate course units after teaching units.

Use `modeAt(setup, index, fallback)` (1-based index) to cycle supported modes.
Import `quietWhenPractising` from `kit/practice` to suppress activity speech;
pass no hints or teaching intro. Match reference handling of read-aloud controls,
explanations and resumable rounds. Test silence across a round, not just on mount.

Nine or ten questions is a useful default; practice ranking needs eight qualifying
answers. Speed excludes answers under 700ms, assisted answers and repeat attempts.
The host adds practice telemetry from the lesson flag. Verify Practice log entries;
see `src/lib/learning/practiceLog.ts` for the current calculation. Mixed practice
is deliberately excluded from the concept recommender.

## 9. Speech and assets

Say everything through `koda.speech.say()` so learner switches and the live coach's
speaker ownership are respected. Await completion when the action depends on the
line finishing; use `useSpokenFinish` for the reference timed-finish pattern.

Gate the skill's own speech on `audio_speech` yourself. The kit gates the lesson
intro, the hint line and the recorded answer reactions; a `speech.say()` an
activity calls directly is not covered, so a declared switch that only the kit
respects is a switch that does nothing. Counting is the reference.

Declare phrases that are actually spoken. Reuse common numbers/facts/neutral
praise; keep topic-specific reactions scoped to the skill. Register audio and
skill-owned SVG from `index.ts`, following counting. Artwork registers through a
flat `./assets/*.svg` glob, which does not match subdirectories — art in a nested
folder is silently absent rather than an error, so keep `assets/` flat and carry
grouping in the filename. Do not copy another skill's
recordings or assets by default. Finalize wording before recording; dry-run with
`npm run voice:plan -- --skill <id>`. Recording/provider details live in `VOICE.md`.

## 10. Curriculum and telemetry

Reuse a conceptKey for the same learning objective; introduce one for a genuinely
new objective. Search existing lessons first. A missing key prevents attributed
learning events. Declare external prerequisites in manifest `requires`; a lesson's
`requires` may use those or concepts taught earlier in the skill. Keep `teaches`
aligned with the curriculum.

Every presented question needs `expected`. Check multi-box answers together once
per attempt; a multi-step task may present separate questions when each step is
assessed separately. Let the SDK derive attempts, timing and error classification.
Do not file refused setup moves as answers or unsolicited help as support.

Copy published standards exactly, primary first, and only those actually assessed.
Use an empty array when none applies and provide a defensible `trajectoryLevel`;
do not invent a standard or borrow an unrelated counting trajectory for a new domain.
See `PLUGINS.md` §7 for the full standards rule.

## 11. Validation matrix

The shared structural suite is required but insufficient: `describeActivitySmoke`
opens only the first matching lesson per engine (or defaults if none exists).
It does not exercise every mode, finish rounds, or prove answer correctness.

| Check | Required evidence | Reference (under `src/skills/` unless prefixed `src/`) |
|---|---|---|
| Structure | `describeSkillContract(skill)` and `describeActivitySmoke(skill)` | `counting/counting.test.ts` |
| Interaction | Driver per engine, all shipped modes; wrong→right retry; refused moves if applicable; replay cleanup | `addition/addition.activities.test.tsx`, `kit/testing/renderActivity.tsx` |
| Content | Independent known answers and constraint/boundary checks; impossible/exhausted generation cases | `addition/internal/data/additionNumbers.test.ts` |
| Hints | Live question/progress values and appropriate reveal depth | `addition/addition.hints.test.ts` |
| Practice | Mode coverage, no help/speech, normal completion; resume if supported | `addition/addition.practice.test.tsx` |
| Configuration | Declared features/settings change observable behavior; shared controls may rely on shared coverage | `addition/addition.features.test.tsx` |
| Course | Every lesson placed once, ordered; teaching/practice units separate; disabled skill hidden | `addition/addition.course.test.ts`, `src/curriculum/practice.test.ts` |
| Print/art | Supported modes have self-contained questions, correct answer keys and meaningful figures; referenced assets exist | `addition/addition.figures.test.tsx`, `addition/addition.art.test.ts` |

Behavior drivers may read telemetry to choose a correct UI answer. Separately
check known answers/content against an independent expectation: trusting telemetry
alone lets a wrong answer key pass. Drive by accessible name. Prefer observable
invariants to tests that merely match source text or mirror implementation.

### 11.1 Worksheets

When a technique works on paper, register `worksheet` on its activity. Reuse the
round's generator via `build`, provide `prompt`, and explicitly implement `printed`
with self-contained text and answer. Preserve the unknown's position. Supply
`method` for useful screen-independent steps and `figure` where a frame, line or
other apparatus is essential. Use print-friendly lines and leave learner work blank.

Return `null` for unsupported modes; omit the adapter if the activity cannot
meaningfully print. Do not replace a visual task with different arithmetic just
to produce a worksheet. Verify through the worksheet path, including mixed modes.

## 12. Registration and release

Register in `src/skills/registry.ts`; append course units in
`src/curriculum/course.json` without shifting existing lessons. Supporting assets
may need additional files. `npm run build` generates
`server/app/skill_defaults.json`; never maintain this seed by hand.

Name the skill for its topic, supply a short tagline, thumbnail and consistent
author. Start at `status: "draft"`. Only `draft` and `published` are supported;
publication is managed in Skill Manager, separately from bundling code.

When a lesson is missing, inspect publication, enabled state, viewer access/age,
lesson ageBand and course placement. Use the actual preview and learner routes.
See `PLUGINS.md` §8 for server ownership and publication behavior.

`params.level` is local contiguous ordering; course levelNumber is global position;
learner-facing lessonNumber and XP level are different. Let the kit display them.

## 13. Frequent failures

Use the section for the failure instead of rereading every reference:

- Wrong ranges or repeated questions: §2 and §7.
- Missing learning records or duplicate awards: §3 and §10.
- Help or speech remains in practice: §8 and §9.
- A lesson is registered but invisible: §12.
- Structural tests pass but another mode fails: §11.

## 14. Completion

- Run `npm run lint`, `npm test`, `npm run build`; resolve failures relevant to the change.
- Confirm every lesson opens from Learn and Skill Manager preview with appropriate access.
- Check perfect and corrected rounds, XP, completion labels and Practice log entries.
- Verify features/settings, keyboard controls, 360px light/dark layouts and an offline round.
- Verify supported worksheets and that disabling the skill removes learner access.
- Report checks actually performed, limitations and draft/published status. A missing
  browser environment is an unperformed check, not a pass.

Documentation-only changes need link/example validation, not a full application build.
