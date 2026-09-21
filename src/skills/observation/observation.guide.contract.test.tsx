import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDE_DEFAULTS } from "../kit";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildHunt, objectHuntHints } from "./activities/ObjectHunt";
import { buildQuestion as buildDifference, differenceHints } from "./activities/SpotTheDifference";

const MAX_WORDS = 20;
const words = (text: string): number => text.trim().split(/\s+/).length;
const isPractice = (lesson: (typeof skill.lessons)[number]): boolean =>
  Boolean((lesson.params as { question?: { practice?: boolean } }).question?.practice);
const teaching = skill.lessons.filter((lesson) => !isPractice(lesson));

const samples = teaching.map((lesson) => {
  const params = lesson.params as Record<string, unknown>;
  const tip = ((params.play ?? {}) as { kidTip?: string }).kidTip;
  if (lesson.activity === "observation/spot-the-difference") {
    const question = buildDifference(params as never, 1);
    return { lesson: lesson.id, ladder: differenceHints(question, new Set(), tip) };
  }
  const question = buildHunt(params as never, 1);
  return { lesson: lesson.id, ladder: objectHuntHints(question, new Set(), tip) };
});

describe("Observation Smart Guide copy", () => {
  it("gives every teaching technique three short search steps", () => {
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

  it("does not replace distinct observation techniques with one script", () => {
    const byGuide = new Map<string, string[]>();
    for (const { lesson, ladder } of samples) {
      const shape = ladder.join(" | ").replace(/\d+/g, "#");
      byGuide.set(shape, [...(byGuide.get(shape) ?? []), lesson]);
    }
    expect([...byGuide.values()].filter((lessons) => lessons.length > 1)).toEqual([]);
  });

  it("narrows only to a quadrant, never to the hidden object", () => {
    for (const { ladder } of samples) {
      expect(ladder[1]).toMatch(/top|bottom/);
      expect(ladder[2]).toMatch(/area/);
    }
  });
});

describe("Observation Smart Guide behavior", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const perEngine = [...new Map(teaching.map((lesson) => [lesson.activity, lesson])).values()];

  for (const lesson of perEngine) {
    const engine = lesson.activity.split("/")[1];
    it(`${engine}: offers the same help after a stall and through Hint`, () => {
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

  it("keeps practice free of timed and asked-for guidance", () => {
    const lesson = skill.lessons.find(isPractice)!;
    const h = renderActivity(skill.activities["object-hunt"], {
      params: lesson.params as Record<string, unknown>,
    });
    act(() => vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs * 3));
    expect(h.text()).not.toContain("Koda is helping");
    expect(h.buttons().some((button) => /^Hint/.test(button))).toBe(false);
    h.unmount();
  });
});
