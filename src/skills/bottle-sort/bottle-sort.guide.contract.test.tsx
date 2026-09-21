import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDE_DEFAULTS } from "../kit";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { bottleHints, buildQuestion as buildSort } from "./activities/BottleSort";
import { buildQuestion as buildPredict, predictHints } from "./activities/PredictThePour";

const MAX_WORDS = 20;
const words = (text: string): number => text.trim().split(/\s+/).length;
const isPractice = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);
const teaching = skill.lessons.filter((lesson) => !isPractice(lesson));

const samples = teaching.map((lesson) => {
  const params = lesson.params as Record<string, unknown>;
  const tip = ((params.play ?? {}) as { kidTip?: string }).kidTip;
  if (lesson.activity === "bottle-sort/predict") {
    const question = buildPredict(params as never, 1);
    return { lesson: lesson.id, activity: "predict", ladder: predictHints(question, tip) };
  }
  const question = buildSort(params as never, 1);
  return {
    lesson: lesson.id,
    activity: "sort",
    ladder: bottleHints(question.rack, { kidTip: tip, budget: question.budget, poured: 0, goal: question.goal }),
  };
});

describe("Bottle Sort Smart Guide copy", () => {
  it("gives every teaching technique three short, clean steps", () => {
    const failures = samples.flatMap(({ lesson, ladder }) => {
      if (ladder.length !== 3) return [`${lesson}: ${ladder.length} steps`];
      return ladder.flatMap((step, index) =>
        words(step) > MAX_WORDS || step !== step.trim() || step.length < 12
          ? [`${lesson} step ${index + 1} (${words(step)} words): ${step}`]
          : [],
      );
    });
    expect(failures).toEqual([]);
  });

  it("keeps each taught technique's full ladder distinct", () => {
    const byGuide = new Map<string, string[]>();
    for (const { lesson, ladder } of samples) {
      const shape = ladder.join(" | ").replace(/\d+/g, "#");
      byGuide.set(shape, [...(byGuide.get(shape) ?? []), lesson]);
    }
    expect([...byGuide.values()].filter((lessons) => lessons.length > 1)).toEqual([]);
  });

  it("teaches prediction without pointing out the correct choice", () => {
    for (const { activity, ladder } of samples) {
      if (activity !== "predict") continue;
      expect(ladder.join(" ")).not.toMatch(/choice\s+\d/i);
      expect(ladder[2]).toMatch(/count|build/i);
    }
  });
});

describe("Bottle Sort Smart Guide behavior", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const perEngine = [...new Map(teaching.map((lesson) => [lesson.activity, lesson])).values()];

  for (const lesson of perEngine) {
    const engine = lesson.activity.split("/")[1];
    it(`${engine}: offers help after a stall and through Hint`, () => {
      const automatic = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
      });
      act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs + 100));
      expect(automatic.text()).toContain("Koda is helping");
      automatic.unmount();

      const asked = renderActivity(skill.activities[engine], {
        params: lesson.params as Record<string, unknown>,
      });
      act(() => asked.screen.getByRole("button", { name: /^Hint$/ }).click());
      expect(asked.text()).toContain("Koda is helping");
      asked.unmount();
    });
  }

  it("never highlights a prediction answer", () => {
    const lesson = teaching.find((entry) => entry.activity === "bottle-sort/predict")!;
    const h = renderActivity(skill.activities.predict, { params: lesson.params as Record<string, unknown> });
    act(() => {
      h.screen.getByRole("button", { name: /^Hint$/ }).click();
      vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs + GUIDE_DEFAULTS.betweenMs * 3);
    });
    expect(h.screen.queryByLabelText(/Smart guide focus/i)).toBeNull();
    h.unmount();
  });

  it("keeps every practice lesson free of timed and asked-for guidance", () => {
    for (const lesson of skill.lessons.filter(isPractice)) {
      const h = renderActivity(skill.activities.sort, { params: lesson.params as Record<string, unknown> });
      act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs * 3));
      expect(h.text(), lesson.id).not.toContain("Koda is helping");
      expect(h.buttons().some((button) => /^Hint/.test(button)), lesson.id).toBe(false);
      h.unmount();
    }
  });
});
