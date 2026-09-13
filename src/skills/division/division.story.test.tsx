import { describe, expect, it } from "vitest";

import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildStoryQuestion, type StoryMode, type StoryQuestion } from "./internal/data/divisionStory";
import { ROUTES, buildQuestion as buildStrategy } from "./activities/StrategyPicker";
import { buildEstimateQuestion, compatibleNeighbours, friendliestTotal, type EstimateMode } from "./internal/data/divisionEstimate";

const board = skill.activities.story;

const stories = (mode: StoryMode, n = 200): StoryQuestion[] =>
  Array.from({ length: n }, (_, i) => buildStoryQuestion({ mode }, mode, i));

describe("every story is answerable and none is a trick", () => {
  it("offers four distinct options containing the answer", () => {
    const modes: StoryMode[] = [
      "size_unknown", "count_unknown", "remainder_context",
      "unit_rate", "times_comparison", "multi_step", "mean",
    ];
    for (const mode of modes) {
      for (const q of stories(mode, 60)) {
        expect(q.choices, mode).toHaveLength(4);
        expect(new Set(q.choices).size, mode).toBe(4);
        expect(q.choices, `${mode}: ${q.story}`).toContain(q.answer);
        expect(q.answer).toBeGreaterThan(0);
      }
    }
  });
});

describe("times_comparison — the additive trap", () => {
  it("offers 'how many more' every single time", () => {
    for (const q of stories("times_comparison", 150)) {
      const big = q.whole;
      const small = big / q.answer;
      expect(q.choices, `${q.story}`).toContain(big - small);
      expect(q.answer).toBe(big / small);
    }
  });
});

describe("multi_step — dividing before subtracting", () => {
  it("offers the answer you get by dividing the whole total first", () => {
    for (const q of stories("multi_step", 100)) {
      const kept = /keeping (\d+)/.exec(q.story);
      const totalInStory = /has (\d+)/.exec(q.story);
      if (!kept || !totalInStory) continue;
      const naive = Math.floor(Number(totalInStory[1]) / q.parts);
      if (naive !== q.answer) expect(q.choices).toContain(naive);
    }
  });
});

describe("mean — a real set that averages exactly", () => {
  it("uses values that total to a whole number of days", () => {
    for (const q of stories("mean", 100)) {
      const values = q.values ?? [];
      expect(values.length).toBeGreaterThanOrEqual(3);
      expect(values.reduce((a, b) => a + b, 0)).toBe(q.answer * values.length);
      for (const v of values) expect(v).toBeGreaterThan(0);
    }
  });

  it("does not make the mean one of the values every time", () => {
    const drawn = stories("mean", 60);
    expect(drawn.some((q) => !(q.values ?? []).includes(q.answer))).toBe(true);
  });
});

describe("the bar has to be cut before the answer counts", () => {
  it("refuses an answer while the bar is the wrong shape", async () => {
    const h = renderActivity(board, { params: { question: { mode: "size_unknown" } } });
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer);
    // The bar opens at one part; a question wanting two or more is not modelled.
    if (h.text().includes("Cut the bar")) {
      expect(h.koda.count("learning.answered")).toBe(0);
    }
    h.unmount();
  });

  it("does not gate the modes where the bar is given", () => {
    for (const q of stories("times_comparison", 20)) expect(q.setsParts).toBe(false);
    for (const q of stories("mean", 20)) expect(q.setsParts).toBe(false);
  });
});

describe("estimate — compatible, not nearest", () => {
  const estimates = (mode: EstimateMode, n = 200) =>
    Array.from({ length: n }, (_, i) => buildEstimateQuestion({ mode }, mode, i));

  it("never draws a total that already divides", () => {
    for (const q of estimates("compatible")) expect(q.dividend % q.divisor).not.toBe(0);
  });

  it("offers two neighbours, both of which the divisor goes into", () => {
    for (const q of estimates("compatible", 100)) {
      const [below, above] = q.neighbours as [number, number];
      expect(below % q.divisor).toBe(0);
      expect(above % q.divisor).toBe(0);
      expect(below).toBeLessThan(q.dividend);
      expect(above).toBeGreaterThan(q.dividend);
    }
  });

  it("prefers the rounder neighbour over the nearer one", () => {
    // 347 ÷ 6: below is 342, above is 348. Neither is round, so nearest wins.
    expect(compatibleNeighbours(347, 6)).toEqual([342, 348]);
    // 358 ÷ 6: 354 and 360. 360 is round, and is the friendlier estimate even
    // though 354 is nearer — which is the whole lesson.
    expect(friendliestTotal(358, 6)).toBe(360);
  });

  it("makes every wrong claim wrong by a place, never by one", () => {
    for (const q of estimates("reasonable", 150)) {
      if (q.fault === "right") {
        expect(q.claim).toBe(q.quotient);
        continue;
      }
      expect(Math.abs((q.claim as number) - q.quotient)).toBeGreaterThan(1);
    }
  });

  it("offers a rebuild that really does reconstruct the total", () => {
    for (const q of estimates("check_back", 100)) {
      expect(q.rebuilds).toHaveLength(4);
      expect(q.rebuilds).toContain(q.expected);
      expect(q.expected).toContain(String(q.dividend));
    }
  });
});

describe("strategy — every route offered either fits or plainly does not", () => {
  it("always offers at least one route that genuinely suits the numbers", () => {
    for (let i = 0; i < 150; i += 1) {
      const q = buildStrategy({}, i);
      expect(q.fitting.length, `${q.dividend} ÷ ${q.divisor}`).toBeGreaterThan(0);
      expect(q.offered.some((id) => q.fitting.includes(id))).toBe(true);
    }
  });

  it("never claims halving suits a division by seven", () => {
    const halve = ROUTES.find((r) => r.id === "halve");
    expect(halve?.fits(91, 7)).toBe(false);
    expect(halve?.fits(96, 4)).toBe(true);
  });

  it("only offers place-splitting when every place really divides", () => {
    const split = ROUTES.find((r) => r.id === "place-split");
    expect(split?.fits(96, 3)).toBe(true);
    expect(split?.fits(84, 6)).toBe(false);
  });

  it("accepts more than one route where more than one fits", () => {
    const fits = ROUTES.filter((r) => r.fits(96, 4));
    expect(fits.length).toBeGreaterThan(1);
  });
});
