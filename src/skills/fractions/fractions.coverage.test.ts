import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { skill } from ".";
import { buildStripQuestion, type StripMode } from "./internal/data/fractionStrip";
import { buildLineQuestion, type LineMode } from "./internal/data/fractionLine";

/**
 * Every technique is driven by a test, and the count is the claim.
 *
 * "The engine works" is not a claim worth making — the modes differ in exactly
 * the place that matters, and a mode nobody drove is a screen that still shades
 * parts and still scores answers while teaching the wrong thing. This walks the
 * lessons rather than a hand-written list, so a mode added without a test fails
 * here rather than shipping quietly.
 */

const TEST_DIR = join(process.cwd(), "src/skills/fractions");
const suiteText = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith(".test.tsx") || f.endsWith(".test.ts"))
  .filter((f) => !f.startsWith("fractions.coverage"))
  .map((f) => readFileSync(join(TEST_DIR, f), "utf8"))
  .join("\n");

/** Every mode any lesson actually asks for. */
const modesInUse = (): { activity: string; mode: string; lesson: string }[] => {
  const out: { activity: string; mode: string; lesson: string }[] = [];
  for (const lesson of skill.lessons) {
    const q = (lesson.params as { question?: { mode?: string; modes?: string[] } })?.question;
    const activity = lesson.activity.split("/")[1];
    if (q?.mode) out.push({ activity, mode: q.mode, lesson: lesson.id });
    for (const m of q?.modes ?? []) out.push({ activity, mode: m, lesson: lesson.id });
  }
  return out;
};

describe("every technique the lessons use", () => {
  it("is named somewhere in the behaviour tests", () => {
    for (const { activity, mode, lesson } of modesInUse()) {
      expect(
        suiteText.includes(`"${mode}"`),
        `${lesson} uses ${activity}/${mode}, which no test names`,
      ).toBe(true);
    }
  });

  it("builds a question without throwing, for every mode", () => {
    for (const { activity, mode, lesson } of modesInUse()) {
      const build = activity === "strip" ? buildStripQuestion : buildLineQuestion;
      for (let i = 0; i < 30; i += 1) {
        expect(
          () => build({ mode } as never, mode as never, i),
          `${lesson} (${activity}/${mode}) threw on draw ${i}`,
        ).not.toThrow();
      }
    }
  });

  it("gives every question an id, a task kind and an expected answer", () => {
    for (const { activity, mode, lesson } of modesInUse()) {
      const build = activity === "strip" ? buildStripQuestion : buildLineQuestion;
      const seen = new Set<string>();
      for (let i = 0; i < 20; i += 1) {
        const q = build({ mode } as never, mode as never, i, seen) as {
          id: string; taskKind: string; expected: string;
        };
        expect(q.id, `${lesson} draw ${i}`).toBeTruthy();
        expect(q.taskKind, `${lesson} draw ${i}`).toBeTruthy();
        // Without `expected` the log records what the child did but not what
        // they were asked — the one field nobody can reconstruct later.
        expect(q.expected, `${lesson} draw ${i}`).toBeTruthy();
      }
    }
  });

  it("covers all eleven built so far, and says so when a twelfth arrives", () => {
    const strip: StripMode[] = ["equal_or_not", "name_unit", "which_whole", "build", "to_notation", "of_a_set"];
    const line: LineMode[] = ["place_unit", "place_any", "read_point", "makes_one", "improper"];
    const used = new Set(modesInUse().map((m) => `${m.activity}/${m.mode}`));
    expect([...used].sort()).toEqual(
      [...strip.map((m) => `strip/${m}`), ...line.map((m) => `numberline/${m}`)].sort(),
    );
  });
});

describe("the theme, because half of what breaks is invisible in one mode", () => {
  /*
   * `text-ink-soft` and `bg-surface-alt` are not tokens. Tailwind emits nothing
   * for a name it does not know, so an element wearing one simply inherits —
   * which looks almost right in light and can be unreadable in dark. Forty-eight
   * of them shipped in this session before anybody looked.
   */
  const PHANTOM = /\b(?:text|bg|border|fill|stroke)-(?:ink-soft|surface-alt|body-soft|muted-soft)\b/;

  it("uses no colour name the theme does not define", () => {
    const dir = join(process.cwd(), "src/skills/fractions");
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
      );
    for (const file of walk(dir).filter((f) => f.endsWith(".tsx") && !f.includes(".test."))) {
      const text = readFileSync(file, "utf8");
      const hit = PHANTOM.exec(text);
      expect(hit?.[0], `${file.split("/skills/")[1]} uses "${hit?.[0]}"`).toBeUndefined();
    }
  });

  it("hand-rolls no dark-mode colour pair where a token exists", () => {
    const dir = join(process.cwd(), "src/skills/fractions");
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
      );
    for (const file of walk(dir).filter((f) => f.endsWith(".tsx") && !f.includes(".test."))) {
      const text = readFileSync(file, "utf8");
      // `dark:` on a semantic surface means the token was not used.
      expect(/dark:(?:bg|text|fill)-(?:slate|zinc|gray|neutral)-/.test(text), file).toBe(false);
    }
  });
});
