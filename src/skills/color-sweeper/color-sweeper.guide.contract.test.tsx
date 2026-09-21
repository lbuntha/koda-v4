import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDE_DEFAULTS } from "../kit";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildLens, lensHints } from "./activities/NeighborLens";
import { buildQuestion as buildBoard, nextStep, sweeperHints } from "./activities/SweeperBoard";
import { buildQuestion as buildLab, labHints } from "./activities/ClueLab";

const MAX_WORDS = 20;
const words = (text: string): number => text.trim().split(/\s+/).length;
const isPractice = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);
const teaching = skill.lessons.filter((lesson) => !isPractice(lesson));

const sample = (lesson: (typeof teaching)[number]) => {
  const params = lesson.params as Record<string, unknown>;
  const tip = ((params.play ?? {}) as { kidTip?: string }).kidTip;
  if (lesson.activity === "color-sweeper/board") {
    const question = buildBoard(params as never, 0, new Set());
    return { lesson: lesson.id, ladder: sweeperHints(question, tip, question.board.givens) };
  }
  if (lesson.activity === "color-sweeper/reason") {
    const question = buildLab(params as never, 0, new Set());
    return { lesson: lesson.id, ladder: labHints(question, tip) };
  }
  const question = buildLens(params as never, 0, new Set());
  return { lesson: lesson.id, ladder: lensHints(question, tip, { chosen: 0 }) };
};

const samples = teaching.map(sample);

describe("Color Sweeper Smart Guide copy", () => {
  it("gives every teaching technique three clean steps", () => {
    const failures = samples.flatMap(({ lesson, ladder }) => {
      if (ladder.length !== 3) return [`${lesson}: ${ladder.length} steps`];
      return ladder.flatMap((step, index) => {
        const count = words(step);
        return count > MAX_WORDS || step !== step.trim() || step.length < 12
          ? [`${lesson} step ${index + 1} (${count} words): ${step}`]
          : [];
      });
    });
    expect(failures).toEqual([]);
  });

  it("does not replace two techniques with one generic script", () => {
    const byGuide = new Map<string, string[]>();
    for (const { lesson, ladder } of samples) {
      const shape = ladder.join(" | ").replace(/\d+/g, "#");
      byGuide.set(shape, [...(byGuide.get(shape) ?? []), lesson]);
    }
    expect([...byGuide.values()].filter((lessons) => lessons.length > 1)).toEqual([]);
  });

  it("derives board guidance from the visible assignment, not the answer key", () => {
    for (const lesson of teaching.filter((item) => item.activity === "color-sweeper/board")) {
      const question = buildBoard(lesson.params as never, 0, new Set());
      const step = nextStep(question.board, question.board.givens);
      expect(step, lesson.id).not.toBeNull();
      expect(question.board.givens[step!.target], `${lesson.id} focuses outside the live board`).not.toBeUndefined();
    }
  });
});

describe("Color Sweeper Smart Guide behavior", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const perEngine = [...new Map(teaching.map((lesson) => [lesson.activity, lesson])).values()];

  it("covers the lens, deduction board and reason lab", () => {
    expect(perEngine.map((lesson) => lesson.activity).sort()).toEqual([
      "color-sweeper/board",
      "color-sweeper/neighbors",
      "color-sweeper/reason",
    ]);
  });

  for (const lesson of perEngine) {
    const engine = lesson.activity.split("/")[1];

    it(`${engine}: offers help after thinking time and through Hint`, () => {
      const automatic = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
        level: 1,
      });
      act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs + 100));
      expect(automatic.text()).toContain("Koda is helping");
      expect(automatic.koda.only("learning.supportUsed").some((call) => call.args[0] === "walkthrough")).toBe(true);
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

  it("turning off Smart guide stops interruptions but keeps asked-for help", () => {
    const lesson = perEngine.find((item) => item.activity === "color-sweeper/board")!;
    const h = renderActivity(skill.activities.board, {
      params: lesson.params as Record<string, unknown>,
      features: { guide_coach: false },
    });
    act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs * 3));
    expect(h.text()).not.toContain("Koda is helping");
    act(() => h.screen.getByRole("button", { name: /^Hint$/ }).click());
    expect(h.text()).toContain("Koda is helping");
    h.unmount();
  });

  it("keeps timed and asked-for guidance out of practice", () => {
    const lesson = skill.lessons.find(isPractice)!;
    const engine = lesson.activity.split("/")[1];
    const h = renderActivity(skill.activities[engine], {
      params: lesson.params as Record<string, unknown>,
    });
    act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs * 3));
    expect(h.text()).not.toContain("Koda is helping");
    expect(h.buttons().some((button) => /^Hint/.test(button))).toBe(false);
    h.unmount();
  });
});
