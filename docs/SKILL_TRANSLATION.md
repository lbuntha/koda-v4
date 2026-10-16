# Translating a skill

Counting is the reference. Follow the same five steps for any other skill.

## 1. Add the catalogs

```
src/skills/<skill>/locales/en.json   every line the activities show or say
src/skills/<skill>/locales/km.json   the same keys, in Khmer, plus `lessons`
```

- Use the same keys in both files. Write placeholders as `{name}`, and keep the same placeholders in every language.
- Plurals are objects: `{ "one": "{count} ten", "other": "{count} tens" }`. Khmer needs only `other`.
- If the skill joins lists, add `"listAnd": "{a} and {b}"` (Khmer: `"{a} និង {b}"`).
- **Keep English text identical to what the code said before.** Recorded voice clips are matched by exact text.
- Adding a language means adding a file, for example `locales/fr.json`. Nothing else changes.

## 2. Get a `t` for the skill

`src/skills/<skill>/internal/i18n.ts`:

```ts
import { skillLocales } from "../../kit/i18n";

export const { t, listAnd } = skillLocales("<skill>");
```

You don't need any registration code. `kit/i18n.ts` finds every `src/skills/*/locales/*.json` at app startup and registers it under `skills.<skill>.*`. That startup registration is why lesson titles are translated on the Learn page, and every line is listed on the admin **Translations** page, even before the skill has been opened.

## 3. Replace hard-coded strings

- In pure functions (hints, `promptFor`, `printedFor`, `methodFor`), call `t("orbit.promptRow", { thing })`.
- In each activity component, call `useT()` once at the top. That makes the component re-render when the family switches language.
- Number words, object names and anything else that varies by language belong in the catalog too. See `things.*` in counting and `numberWord()` in `internal/guide/countGuide.ts`.

## 4. Translate the lessons

`lessons.json` stays English and remains the source. Under `lessons` in `km.json`, add Khmer for each lesson id:

```json
"lessons": {
  "count-in-a-row": {
    "title": "…", "concept": "…", "pedagogyTip": "…",
    "kidTip": "…", "audioPrompt": "…", "targetObjective": "…",
    "shortDesc": "…", "category": "…",
    "steps": { "0": "…", "1": "…", "2": "…" }
  }
}
```

`withLessonEdits` applies these for every skill (`src/lib/lessonText.ts`). A missing field falls back to English. A teacher's wording edit in the Skill Manager still overrides the translation.

## 5. Test it

```ts
import { describeSkillLocales } from "../kit/testing";
import { skill } from ".";

describeSkillLocales("<skill>", {
  complete: ["km"],
  source: { dir: "src/skills/<skill>", helper: "t" },
});
```

This test fails on a missing Khmer line, a line English doesn't have, mismatched `{placeholders}`, or a `t("key")` in the code with no English entry. `counting.i18n.test.tsx` shows render-level checks too.

## Voice

- Khmer text is spoken only by a Khmer voice on the device. It never goes to the server voice and never gets an English voice. With no Khmer voice installed, the skill stays silent and the text still shows.
- The recorded praise reactions are English, so they play only when the app is in English.
- To record Khmer clips later, add them to the skill's `audio/manifest.json` keyed by the Khmer text. They take precedence automatically.

## Smart guide hints (admin setting)

Any skill can offer these two settings in its `manifest.json` (copy them from counting's):

- `coachMode`: `"once"` gives one hint per question, only after the child has been idle. `"ladder"` keeps helping and climbs a rung each time the child stays stuck.
- `coachIdleSeconds`: how long the child must be idle before the single hint (default 15).

A skill that doesn't declare `coachMode` keeps the `ladder` behaviour.
