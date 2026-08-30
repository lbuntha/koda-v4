# Build plan — the first skill

> **Historical.** This plan is finished: counting shipped, and the folder it describes as
> `src/plugins/` is now `src/skills/`. Paths and type names below are as they were written,
> not as they are — kept as the record of how the first skill was built. For building a new
> skill today, read [NEW_SKILL_PROMPT.md](./NEW_SKILL_PROMPT.md) and
> [PLUGINS.md](./PLUGINS.md), which are current.

Companion to [PLUGINS.md](./PLUGINS.md). That document is the contract; this one is
**a complete worked skill, file by file**, then the order to build it in.

If you read only one section, read §1 — it is the whole thing a developer produces.

---

## 1. A complete skill, end to end

> **Built vs. target.** M1–M4 are done: counting is a registered plugin and runs through
> the host. What is **not** done is the activity split — today the whole game is a single
> activity, `CountingQuest.tsx`. The multi-activity layout below is the target state, and it
> depends on the kit existing first (§3). Names come from the `GameMode` union already in
> `internal/data/countingAssets.ts`, not invented here.

**What exists today**

```
src/plugins/counting/
├── manifest.json           ✅ metadata, 5 features, settings
├── lessons.json            ✅ 15 lessons, generated from FLOWING_LEVELS
├── activities/
│   └── CountingQuest.tsx   ✅ one activity — wraps the whole 3,053-line game
├── internal/               ✅ the implementation, moved here
└── index.ts                ✅
```

**The target, once the kit exists**

```
src/plugins/counting/
├── manifest.json
├── lessons.json
├── activities/                    ← one per GameMode, sharing the kit's round loop
│   ├── TouchOrbit.tsx             #  levels 1–3   → "counting/touch-orbit"
│   ├── SubitizingRush.tsx         #  levels 4–6   → "counting/subitizing-rush"
│   ├── TenFrameRocket.tsx         #  levels 7–9   → "counting/tenframe-rocket"
│   └── FroggySkip.tsx             #  levels 10–12 → "counting/froggy-skip"
├── internal/
└── index.ts
```

Levels 13–15 carry **no `mode`** in `FLOWING_LEVELS` — they teach place value and are the
clearest candidates to move to a `base-ten` plugin rather than gain a counting activity.

### 1.1 `manifest.ts` — who this skill is

```ts
import type { PluginManifest } from "../types";
import type { PluginFeature } from "../../lib/pluginStore";

export const manifest: PluginManifest = {
  id: "counting",                 // canonical, kebab-case. Used in every log + ref.
  name: "Counting Quest",
  version: "1.0.0",
  description: "One-to-one correspondence, subitizing and quantity comparison.",
  category: "core",
  author: "Koda Math Lab",
  iconName: "Sparkles",
  status: "draft",                // draft → beta → published. See PLUGINS.md §8.
  audience: ["grade_1"],
};

/** Toggleable behaviours. Rendered automatically by Plugin Lab. */
export const features: PluginFeature[] = [
  { id: "tactile_pop",    name: "Tactile bounce & pop",  description: "Elastic scale on tap.",           isEnabled: true, tag: "Visual" },
  { id: "haptic_feedback",name: "Haptic vibration",      description: "Vibration synced to the tap.",     isEnabled: true, tag: "Haptic" },
  { id: "audio_speech",   name: "Spoken counter",        description: "Says 'one, two, three' on tap.",   isEnabled: true, tag: "Audio" },
  { id: "counting_badges",name: "1-to-1 badges",         description: "Numbers touched items so a child cannot double-count.", isEnabled: true, tag: "Cognitive" },
];

/** Defaults. Plugin Lab renders controls for these before the skill ever runs. */
export const settings = {
  speechRate: 1.0,
  popScaleFactor: 1.2,
  showItemCountBadges: true,
};
```

### 1.2 `activities/TouchOrbit.tsx` — what the skill can DO

An **activity** is one interaction engine. It is the unit of reuse: any lesson, in any unit,
in any skill, may reference `"counting/touch-orbit"`.

```tsx
import { useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillShell, SkillTopBar, SkillPrompt, RoundComplete } from "../../kit";
import { useSkillRound } from "../../kit/round";
import { TappableSet } from "../../kit/manipulatives";

export interface TouchOrbitParams {
  range: [number, number];
  layout: "row" | "scattered" | "circle";
  itemSet: string;              // emoji key, e.g. "flowers"
}

export function TouchOrbit({ params, level, koda, onComplete }: ActivityProps<TouchOrbitParams>) {
  const round = useSkillRound({ questions: buildQuestions(level, params) });
  const [tapped, setTapped] = useState<number[]>([]);

  const handleTap = (index: number) => {
    if (tapped.includes(index)) return;          // 1-to-1: never count twice
    const next = [...tapped, index];
    setTapped(next);

    // Every host capability arrives through `koda` — never a direct import.
    koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback")) koda.haptics.tap();
    if (koda.config.isEnabled("audio_speech")) {
      koda.speech.say(String(next.length), { rate: koda.config.get("speechRate", 1) });
    }

    if (next.length === round.question.total) {
      koda.sound.play("success");
      koda.log("CHECK_ANSWER", `Counted ${next.length} correctly`);
      round.answer({ correct: true });
    }
  };

  return (
    <SkillShell onExit={koda.ui.exit}>
      <SkillTopBar level={level} progress={round.progress} />
      <SkillPrompt text={round.question.prompt} onSpeak={koda.speech.say} />

      {/* the only genuinely counting-specific part */}
      <TappableSet
        count={round.question.total}
        layout={params.layout}
        itemSet={params.itemSet}
        tapped={tapped}
        showBadges={koda.config.get("showItemCountBadges", true)}
        onTap={handleTap}
      />

      <RoundComplete
        result={round.result}
        onDone={async (r) => {
          await koda.progress.awardXp(r.xpEarned);   // XP is a HOST api
          onComplete(r);
        }}
      />
    </SkillShell>
  );
}
```

Note what is **absent**: no `import { playSound }`, no `PluginManagerAPI`, no app state, no
plugin id passed by hand. That is what keeps the skill self-contained.

### 1.3 `lessons.ts` — what the skill TEACHES

A lesson binds an activity to configuration. It does **not** decide where it sits in the
course.

```ts
import type { Lesson } from "../types";

export const lessons: Lesson[] = [
  {
    id: "count-in-a-row",
    title: "Count in a Row (1 to 10)",
    concept: "one-to-one-correspondence",
    activity: "counting/touch-orbit",          // this skill's own activity
    params: { range: [1, 10], layout: "row", itemSet: "flowers" },
    xpReward: 50,
    difficulty: "Easy",
    icon: "🌸",
  },
  {
    id: "count-scattered",
    title: "Count Scattered Objects (1 to 10)",
    concept: "tracking-scattered-objects",
    activity: "counting/touch-orbit",          // same engine, different params
    params: { range: [1, 10], layout: "scattered", itemSet: "apples" },
    xpReward: 50,
    difficulty: "Easy",
    icon: "🍎",
  },
  {
    id: "dice-patterns",
    title: "Quick Dice Patterns (1 to 6)",
    concept: "subitizing",
    activity: "counting/subitizing-rush",
    params: { max: 6 },
    xpReward: 60,
    difficulty: "Medium",
    icon: "🎲",
  },
];
```

**The lesson that used to be counting L8 does not live here.** "Making 10" teaches number
bonds, so it lives in `plugins/number-bonds/lessons.ts` and references
`"number-bonds/ten-frame"` — even though the learner meets it inside a counting unit. See
PLUGINS.md §2.

### 1.4 `index.ts` — the entire public surface

```ts
import type { SkillPlugin } from "../types";
import { manifest, features, settings } from "./manifest";
import { lessons } from "./lessons";
import { TouchOrbit } from "./activities/TouchOrbit";
import { SubitizingRush } from "./activities/SubitizingRush";

export const plugin: SkillPlugin = {
  manifest,
  features,
  settings,
  lessons,
  activities: {
    "touch-orbit": {
      id: "touch-orbit",
      name: "Tap to Count",
      defaultParams: { range: [1, 10], layout: "row", itemSet: "flowers" },
      component: TouchOrbit,
    },
    "subitizing-rush": {
      id: "subitizing-rush",
      name: "Instant Recognition",
      defaultParams: { max: 6 },
      component: SubitizingRush,
    },
  },
};
```

Nothing outside the folder may import past this file.

### 1.5 The two edits outside the folder

```ts
// src/plugins/registry.ts
import { plugin as counting } from "./counting";
export const PLUGINS: SkillPlugin[] = [counting];
```

```ts
// src/curriculum/course.json
export const COURSE: Unit[] = [
  {
    id: "u1", title: "Unit 1: Subitizing & Dot Matrix", icon: "🌱",
    lessons: [
      "counting/count-in-a-row",
      "counting/count-scattered",
      "comparing/two-groups",       // another skill, mid-unit. This is fine.
      "counting/quick-dice-patterns",
    ],
  },
];
```

**That is a complete skill.** Five files, plus two lines elsewhere.

The `GameMode` seams, for reference:

| Levels | `mode` in `FLOWING_LEVELS` | Activity |
| --- | --- | --- |
| 1–3 | `touch_orbit` | tap-to-count |
| 4–6 | `subitizing_rush` | instant recognition |
| 7–9 | `tenframe_rocket` | ten-frame |
| 10–12 | `froggy_skip` | number-line skip counting |
| 13–15 | *(none)* | place value — belongs in `base-ten` |

---

## 2. Build order

Nine milestones. Each leaves the app running and has a check you can perform. Work can stop
at any milestone without leaving a half-migration behind.

### Rules for the whole job

- **No behaviour changes**, except where a milestone explicitly fixes a bug (M6, M7).
- **Never move and rewrite in the same step.** `CountingGameApp.tsx` is wrapped first (M4)
  and split last, so any regression is attributable.
- **Every milestone ends green:** `npm run lint` clean, `npm run build` clean, counting
  reachable from the Learn menu.
- **Commit per milestone.** The repo has zero commits today — fix that before M1.

---

### M1 — The contract ✅ done

| | |
| --- | --- |
| Files | `A src/plugins/types.ts` |
| Accept | `tsc --noEmit` passes with the file present and unreferenced |

Types only, no runtime. Cannot break the build.

### M2 — The SDK ✅ done

| | |
| --- | --- |
| Files | `A src/plugins/sdk/createKodaSDK.ts`, `A src/plugins/sdk/index.ts` |
| Size | ~200 lines |

Binds one `pluginId` to the host's services. Plain TypeScript, no React, so it is
unit-testable on its own.

**Accept**
- `createKodaSDK({ pluginId: "counting", host })` returns an object matching `KodaSDK`.
- `koda.log()` writes a row whose `pluginId` is always `"counting"`, whatever the caller passes.
- `koda.progress.awardXp()` returns a Promise though the host callback is synchronous.

### M3 — The host ✅ done

| | |
| --- | --- |
| Files | `A host/PluginProvider.tsx`, `A host/PluginHost.tsx`, `A registry.ts` |
| Size | ~150 lines |

The piece that can actually *mount* a plugin.

**Accept**
- `resolveActivity("counting/quest")` returns the component; an unknown ref renders a
  visible fallback rather than crashing.
- A disabled plugin resolves to `undefined` and the host renders nothing.

### M4 — Counting as a plugin ✅ done (folder moved to `internal/`)

| | |
| --- | --- |
| Files | `M src/counting/** → src/plugins/counting/internal/**` (move only) |
| | `A manifest.ts`, `A lessons.ts`, `A activities/CountingQuest.tsx`, `A index.ts` |

The 3,053-line `CountingGameApp` is wrapped by a thin activity and otherwise **untouched**.
This proves the contract without touching game logic.

**Accept**
- Learn menu opens counting; a full round is playable end to end.
- `git diff` shows **zero** logic changes inside `CountingGameApp.tsx` — path updates only.

### M5 — Put the skill back inside the shell

| | |
| --- | --- |
| Files | `D App.tsx:339-406` (the early-return block), `M App.tsx` |
| Size | ~30 lines |

**Accept**
- `#root > div` carries `bg-canvas` while counting is open — today it is `bg-slate-950`.
- The sidebar is reachable from inside a lesson.
- The modals duplicated in the deleted block are gone, not copied.

### M6 — Route the skill through `koda` — fixes 2 bugs

| | |
| --- | --- |
| Files | `M internal/CountingGameApp.tsx` — 10 call sites |
| | `:65` import · `:296 :300 :313 :314` sound/haptics/speech · `:687 :705 :706 :717 :740 :1495` logs |

**Accept**
- No `import ... pluginStore` remains under `plugins/counting/`.
- Every log row carries `pluginId: "counting"` — fixes the mislog against
  `"step-header-tagger"` at `:717`.
- Toggling a feature in Plugin Lab changes behaviour in the running lesson.

### M7 — Theme the skill — fixes light mode

| | |
| --- | --- |
| Files | `M internal/**` — 6 × `bg-slate-950` / `text-slate-100` → tokens |

**Accept**
- With the app in light mode the counting shell computes to `#F8FAFC`, not `#020617`.
- Body text clears 4.5:1 against its surface in both themes, **measured**.

### M8 — Plugin Lab reads the registry

| | |
| --- | --- |
| Files | `M src/components/PluginSettingsPanel.tsx` |
| Size | ~120 lines |

Generalize the page; remove the counting special-casing. No new UI — the existing panels
become a loop.

**Accept**
- Adding a plugin to `registry.ts` makes it appear in Plugin Lab with **zero** edits to the panel.
- No string literal `"counting-mastery"` remains in it.
- Feature toggles and settings controls render from the manifest alone.

### M9 — Release gating

| | |
| --- | --- |
| Files | `M types.ts` (`status`, `audience`), `A host/useAvailablePlugins.ts` |
| Size | ~60 lines |

**Accept**
- A `draft` plugin is absent from sidebar, dashboard and routes, but present in Plugin Lab.
- Flipping to `published` makes it appear in all three with no other change.
- A parent disabling it in Settings hides it again without a rebuild.

---

## 3. Out of scope for this job

| Not doing | Why |
| --- | --- |
| Splitting `CountingGameApp` into the kit | Its own project. Doing it here makes regressions ambiguous. |
| The curriculum/course split | Only pays off once a second skill exists. M4 keeps lessons in the counting folder. |
| Routing (`/skill/:id/:lesson`) | Independent of plugins. Do it any time, but not mid-migration. |
| The second skill | Blocked on the kit, which is blocked on counting migrating first. |
| Accounts / per-child profiles | Stage 7 gating is per install (localStorage) until auth exists. |
| Runtime / third-party loading | Needs a frozen SDK. Do not freeze one validated against a single skill. |

---

## 4. Risks

- **M4 is the dangerous one.** Moving a 3,053-line file plus five data modules will surface
  import cycles. Mitigation: move only, no edits, land as its own commit.
- **No tests exist.** Every acceptance check above is manual or a typecheck. A Vitest harness
  around `createKodaSDK` (M2) is the cheapest place to start — pure TypeScript, no DOM.
- **The repo has zero commits.** Nothing here is revertible until that changes. Blocker for M1.
- **`src/counting` may be touched by external sync.** A folder already vanished mid-session;
  confirm the sync target before moving files.

---

## 5. Smallest useful slice

**M1–M4** gets counting mounted through the registry with the SDK live — about a third of the
work, every later milestone still available.

**M1–M4 + M8–M9** gives the complete develop → manage → publish loop working end to end for
one skill. That is the thing worth proving before skill two exists.
