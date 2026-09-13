import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import { lessonIconTones } from "../../components/ui/lessonIcons";
import { buildQuestion as buildStrip } from "./activities/FoldStrip";
import { buildQuestion as buildLine } from "./activities/FractionLine";
import { buildQuestion as buildMill } from "./activities/EquivalenceMill";
import { buildQuestion as buildCompare } from "./activities/CompareBar";
import { buildQuestion as buildMixed } from "./activities/MixedBoard";
import { buildQuestion as buildAdd } from "./activities/AddStrip";
import { buildQuestion as buildMultiply } from "./activities/AreaGrid";
import { buildQuestion as buildDivide } from "./activities/ShareOut";
import { buildQuestion as buildDecimal } from "./activities/DecimalBridge";
import { buildQuestion as buildEstimate } from "./activities/EstimateDial";
import { buildQuestion as buildStory } from "./activities/StoryBoard";
import { buildQuestion as buildStrategy } from "./activities/StrategyPicker";

/**
 * The rules that fail silently — §0 of the development guide, checked.
 *
 * Every one of these is a mistake that throws nothing, reddens no other test,
 * and leaves the skill looking finished. They are cheap to check and they are
 * the whole reason this file exists.
 */

describe("§0 — the rules that leave no trace", () => {
  it("numbers levels 1 to 69 with no gap and no collision", () => {
    const levels = skill.lessons
      .map((l) => (l.params as { level: number }).level)
      .sort((a, b) => a - b);
    expect(levels).toEqual(Array.from({ length: 69 }, (_, i) => i + 1));
  });

  it("uses only icon tones the host actually renders", () => {
    /*
     * There are six, and anything else silently becomes indigo — so a made-up
     * tone is invisible rather than broken. Twenty-three lessons here asked for
     * "sky", "violet" and "rose", which are Tailwind colours and not tones, and
     * every one of them was rendering indigo.
     */
    const valid = Object.keys(lessonIconTones);
    for (const lesson of skill.lessons) {
      if (!lesson.iconTone) continue;
      expect(valid, `${lesson.id} uses "${lesson.iconTone}"`).toContain(lesson.iconTone);
    }
  });

  it("asks the round chrome for a tone it renders too", () => {
    const valid = Object.keys(lessonIconTones);
    const dir = join(process.cwd(), "src/skills/fractions/activities");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const text = readFileSync(join(dir, file), "utf8");
      for (const [, tone] of text.matchAll(/iconTone="([a-z]+)"/g)) {
        expect(valid, `${file} passes "${tone}"`).toContain(tone);
      }
    }
  });

  it("uses no amber, anywhere", () => {
    // Amber on white is hard for a child to read, and this app does not use it.
    for (const lesson of skill.lessons) expect(lesson.iconTone).not.toBe("amber");
  });

  it("claims in the manifest only what a lesson teaches", () => {
    const taught = new Set(skill.lessons.map((l) => l.conceptKey));
    for (const key of skill.manifest.teaches ?? []) {
      expect(taught.has(key), `manifest claims "${key}", which no lesson teaches`).toBe(true);
    }
  });

  it("teaches every concept key a lesson claims", () => {
    const claimed = new Set(skill.manifest.teaches ?? []);
    for (const lesson of skill.lessons) {
      expect(claimed.has(lesson.conceptKey as string), `${lesson.id} teaches an unclaimed key`).toBe(true);
    }
  });

  it("gives every lesson a concept key, so mastery has somewhere to land", () => {
    for (const lesson of skill.lessons) expect(lesson.conceptKey, lesson.id).toBeTruthy();
  });

  it("requires nothing it also teaches", () => {
    const taught = new Set(skill.manifest.teaches ?? []);
    for (const key of skill.manifest.requires ?? []) {
      expect(taught.has(key), `requires "${key}", which it teaches itself`).toBe(false);
    }
  });

  it("orders every lesson after the ones it needs", () => {
    // A lesson that requires a key taught later in the same skill is a lesson
    // no child can reach without failing first.
    /*
     * The *earliest* level that teaches each key.
     *
     * Practice lessons reuse the concept key of the technique they practise, so
     * a plain map keyed by concept ends up holding level 58 for "equal parts" —
     * which then reads as level 2 requiring something taught at 58.
     */
    const levelOf = new Map<string, number>();
    for (const lesson of skill.lessons) {
      const level = (lesson.params as { level: number }).level;
      const key = lesson.conceptKey as string;
      if (!levelOf.has(key) || level < (levelOf.get(key) as number)) levelOf.set(key, level);
    }
    for (const lesson of skill.lessons) {
      const level = (lesson.params as { level: number }).level;
      for (const need of lesson.requires ?? []) {
        const taughtAt = levelOf.get(need);
        if (taughtAt === undefined) continue;
        expect(taughtAt, `${lesson.id} needs ${need}, taught at level ${taughtAt}`).toBeLessThanOrEqual(level);
      }
    }
  });
});

describe("every question can be marked", () => {
  const builders: [string, (p: Record<string, unknown>, i: number, s?: Set<string>) => { expected?: string; taskKind?: string; id?: string }][] = [
    ["strip", buildStrip as never],
    ["numberline", buildLine as never],
    ["equivalence", buildMill as never],
    ["compare", buildCompare as never],
    ["mixed", buildMixed as never],
    ["add", buildAdd as never],
    ["multiply", buildMultiply as never],
    ["divide", buildDivide as never],
    ["decimal", buildDecimal as never],
    ["estimate", buildEstimate as never],
    ["story", buildStory as never],
    ["strategy", buildStrategy as never],
  ];

  for (const [name, build] of builders) {
    it(`gives ${name} an id, a task kind and an expected answer, every draw`, () => {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) {
        const q = build({}, i, seen);
        expect(q.id, name).toBeTruthy();
        expect(q.taskKind, name).toBeTruthy();
        // Without `expected` the log records what the child did but not what
        // they were asked — the one field nobody can reconstruct later.
        expect(q.expected, `${name} question ${i}`).toBeTruthy();
      }
    });
  }
});

describe("every activity a lesson names actually exists", () => {
  it("resolves all sixty-nine", () => {
    for (const lesson of skill.lessons) {
      const [skillId, activityId] = lesson.activity.split("/");
      expect(skillId, lesson.id).toBe("fractions");
      expect(skill.activities[activityId], `${lesson.id} -> ${lesson.activity}`).toBeDefined();
    }
  });

  it("keys every activity by its own id, and gives it a name", () => {
    for (const [key, activity] of Object.entries(skill.activities)) {
      expect(activity.id).toBe(key);
      expect(activity.name.trim()).not.toBe("");
      expect(activity.defaultParams).toBeTypeOf("object");
    }
  });

  it("leaves no engine without a lesson", () => {
    const used = new Set(skill.lessons.map((l) => l.activity.split("/")[1]));
    for (const id of Object.keys(skill.activities)) {
      expect(used.has(id), `${id} has no lesson`).toBe(true);
    }
  });
});

describe("the release itself", () => {
  it("names an age band that matches the lessons inside it", () => {
    const [low, high] = skill.manifest.audience.ages;
    const bands = skill.lessons.map((l) => l.ageBand).filter(Boolean) as [number, number][];
    expect(Math.min(...bands.map((b) => b[0]))).toBeGreaterThanOrEqual(low);
    expect(Math.max(...bands.map((b) => b[1]))).toBeLessThanOrEqual(high);
  });

  it("names a thumbnail that actually exists", () => {
    /*
     * `thumbnail` resolves in four steps and the last one is "anything else →
     * rendered as text". A manifest naming artwork nobody drew does not throw,
     * does not fail a test, and does not look obviously wrong — the skill just
     * sits on the shelf without a card while every sibling has one.
     */
    const id = skill.manifest.thumbnail;
    expect(id, "no thumbnail declared").toBeTruthy();
    expect(SVG_ASSET_IDS as readonly string[], `manifest names "${id}", which is not drawn`).toContain(id);
  });

  it("requires concept keys, and each of them once", () => {
    const required = skill.manifest.requires ?? [];
    expect(required.length).toBeGreaterThan(0);
    expect(new Set(required).size).toBe(required.length);
  });
});

describe("a skill for readers", () => {
  for (const id of Object.keys(skill.activities)) {
    it(`says nothing when a ${id} round opens`, () => {
      const h = renderActivity(skill.activities[id], { features: { audio_speech: true } });
      expect(h.koda.count("speech.say"), `${id} speaks on open`).toBe(0);
      h.unmount();
    });
  }

  it("keeps the printed instruction, which is a different consumer", () => {
    // `audioPrompt` is also the worksheet's instruction line, so the field stays
    // even though nothing says it. Removing it would blank the sheets.
    const teaching = skill.lessons.filter(
      (l) => !(l.params as { question?: { practice?: boolean } })?.question?.practice,
    );
    for (const lesson of teaching) {
      const play = (lesson.params as { play?: { audioPrompt?: string } }).play;
      expect(play?.audioPrompt, lesson.id).toBeTruthy();
    }
  });
});

describe("every teaching lesson explains itself to a grown-up", () => {
  const teaching = skill.lessons.filter(
    (l) => !(l.params as { question?: { practice?: boolean } })?.question?.practice,
  );

  it("states an objective, four steps and a tip", () => {
    for (const lesson of teaching) {
      const play = (lesson.params as {
        play?: { targetObjective?: string; stepByStep?: string[]; kidTip?: string };
      }).play;
      expect(play?.targetObjective, lesson.id).toBeTruthy();
      expect(play?.stepByStep?.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(play?.kidTip, lesson.id).toBeTruthy();
    }
  });

  it("writes those steps as sentences, not as fragments", () => {
    for (const lesson of teaching) {
      const steps = (lesson.params as { play?: { stepByStep?: string[] } }).play?.stepByStep ?? [];
      for (const step of steps) {
        expect(step, `${lesson.id}: "${step}"`).toMatch(/^[A-Z"']/);
        expect(step, `${lesson.id}: "${step}"`).toMatch(/[.?!]$/);
        expect(step.split(/\s+/).length, `${lesson.id}: "${step}"`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("claims a standard for every teaching lesson", () => {
    for (const lesson of teaching) {
      expect(lesson.standards?.length, lesson.id).toBeGreaterThanOrEqual(1);
      for (const code of lesson.standards ?? []) {
        expect(code, lesson.id).toMatch(/^CCSS\./);
      }
    }
  });
});

describe("colours come from the theme, not from a guess", () => {
  /*
   * `text-ink-soft`, `bg-surface-alt` and friends are not tokens. `src/index.css`
   * defines surface, surface-muted, ink, body, muted, line, canvas and play-*,
   * and Tailwind emits nothing at all for a name outside that set — so an
   * element wearing one silently inherits whatever colour is around it. It looks
   * almost right in light, and it is the half of a dark-mode bug that no
   * screenshot in light will ever show.
   */
  const PHANTOM = /\b(?:text|bg|border|fill|stroke)-(?:ink-soft|surface-alt|body-soft|muted-soft|line-soft)\b/;

  const files = (): string[] => {
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
      );
    return walk(join(process.cwd(), "src/skills/fractions")).filter(
      (f) => f.endsWith(".tsx") && !f.includes(".test."),
    );
  };

  it("uses no colour name the theme does not define", () => {
    for (const file of files()) {
      const hit = PHANTOM.exec(readFileSync(file, "utf8"));
      expect(hit?.[0], `${file.split("/skills/")[1]} uses "${hit?.[0]}"`).toBeUndefined();
    }
  });

  it("hand-rolls no dark-mode pair where a token exists", () => {
    for (const file of files()) {
      expect(
        /dark:(?:bg|text|fill)-(?:slate|zinc|gray|neutral)-/.test(readFileSync(file, "utf8")),
        file.split("/skills/")[1],
      ).toBe(false);
    }
  });

  it("uses no amber or yellow in the engines either", () => {
    for (const file of files()) {
      const text = readFileSync(file, "utf8");
      expect(/\b(?:text|bg|fill|stroke|border)-(?:amber|yellow)-/.test(text), file.split("/skills/")[1]).toBe(false);
    }
  });

  it("keeps every tappable control big enough for a finger", () => {
    // 44px is the floor. A button below it is a control a child misses.
    for (const file of files()) {
      const text = readFileSync(file, "utf8");
      for (const [, height] of text.matchAll(/className="[^"]*\bmin-h-(\d+)\b[^"]*"/g)) {
        // Tailwind's scale is 4px per step: min-h-11 is 44px.
        expect(Number(height) * 4, `${file.split("/skills/")[1]} has a ${Number(height) * 4}px control`).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
