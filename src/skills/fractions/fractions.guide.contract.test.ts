import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDE_DEFAULTS } from "../kit";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { addHints } from "./activities/AddStrip";
import { multiplyHints } from "./activities/AreaGrid";
import { compareHints } from "./activities/CompareBar";
import { decimalHints } from "./activities/DecimalBridge";
import { millHints } from "./activities/EquivalenceMill";
import { estimateHints } from "./activities/EstimateDial";
import { stripHints } from "./activities/FoldStrip";
import { lineHints } from "./activities/FractionLine";
import { mixedHints } from "./activities/MixedBoard";
import { divideHints } from "./activities/ShareOut";
import { storyHints } from "./activities/StoryBoard";
import { strategyHints } from "./activities/StrategyPicker";

/** A short spoken step: one idea a learner can hold while looking back. */
const MAX_WORDS = 20;
const words = (text: string): number => text.trim().split(/\s+/).length;

const LADDERS: Record<string, (question: never) => string[]> = {
  strip: stripHints,
  numberline: lineHints,
  equivalence: millHints,
  compare: compareHints,
  mixed: mixedHints,
  add: addHints,
  multiply: multiplyHints,
  divide: divideHints,
  decimal: decimalHints,
  estimate: estimateHints,
  story: storyHints,
  strategy: strategyHints,
};

const teaching = skill.lessons.filter(
  (lesson) => !(lesson.params as { question?: { practice?: boolean } }).question?.practice,
);

const samples = teaching.map((lesson) => {
  const engine = lesson.activity.split("/")[1];
  const build = skill.activities[engine]?.worksheet?.build as
    | ((params: never, index: number, seen: Set<string>) => never)
    | undefined;
  const setup = {
    ...(lesson.params as object),
    ...((lesson.params as { question?: object }).question ?? {}),
  };
  const question = build?.(setup as never, 1, new Set());
  return {
    lesson: lesson.id,
    engine,
    ladder: question ? LADDERS[engine]?.(question) : undefined,
  };
});

describe("Fractions Smart Guide copy", () => {
  it("covers every teaching technique with three ordered steps", () => {
    const missing = samples.filter((sample) => sample.ladder?.length !== 3);
    expect(missing.map((sample) => `${sample.lesson}:${sample.ladder?.length ?? 0}`)).toEqual([]);
  });

  it("keeps every step clear enough to read or hear once", () => {
    const unclear = samples.flatMap((sample) =>
      (sample.ladder ?? []).flatMap((step, index) => {
        const count = words(step);
        return count > MAX_WORDS || step !== step.trim() || step.length < 12
          ? [`${sample.lesson} step ${index + 1} (${count} words): ${step}`]
          : [];
      }),
    );
    expect(unclear).toEqual([]);
  });

  it("does not reuse one generic guide for two techniques", () => {
    const byGuide = new Map<string, string[]>();
    for (const sample of samples) {
      const shape = (sample.ladder ?? []).join(" | ").replace(/\d+/g, "#");
      byGuide.set(shape, [...(byGuide.get(shape) ?? []), sample.lesson]);
    }
    expect([...byGuide.values()].filter((lessons) => lessons.length > 1)).toEqual([]);
  });
});

describe("Fractions Smart Guide behavior", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const perEngine = [...new Map(teaching.map((lesson) => [lesson.activity.split("/")[1], lesson])).values()];

  it("reaches all twelve engines", () => {
    expect(perEngine).toHaveLength(12);
  });

  for (const lesson of perEngine) {
    const engine = lesson.activity.split("/")[1];

    it(`${engine}: offers the same guide automatically and through Hint`, () => {
      const automatic = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
        level: 1,
      });
      act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs + 100));
      expect(automatic.text()).toContain("Koda is helping");
      expect(
        automatic.koda.only("learning.supportUsed").some((call) => call.args[0] === "walkthrough"),
      ).toBe(true);
      automatic.unmount();

      const asked = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
        level: 1,
      });
      act(() => asked.screen.getByRole("button", { name: /^Hint$/ }).click());
      expect(asked.text()).toContain("Koda is helping");
      expect(asked.koda.only("learning.supportUsed").some((call) => call.args[0] === "hint")).toBe(true);
      asked.unmount();
    });
  }
});
