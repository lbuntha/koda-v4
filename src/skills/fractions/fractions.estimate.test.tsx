import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  BENCHMARK_WORDS,
  benchmarkOf,
  buildEstimateQuestion,
  explainEstimate,
  isEstimateCorrect,
  nameOf,
  type EstimateMode,
  type EstimateQuestion,
} from "./internal/data/fractionEstimate";
import { estimateHints } from "./activities/EstimateDial";
import { valueOf } from "./internal/data/fractionNumbers";

/**
 * Judging, which has to be judgeable.
 *
 * The one way to ruin an estimation level is to ask a question whose honest
 * answer is "it is exactly between the two" and then mark one of them right.
 * These tests exist mostly to hold that line.
 */

const dial = skill.activities.estimate;

const MODES: EstimateMode[] = ["benchmark", "reasonable"];

const questions = (mode: EstimateMode, n = 200): EstimateQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildEstimateQuestion({ mode }, mode, i, seen));
};

/** Judge the question the way the level asks, from what is on the screen. */
const answerRight = async (h: ActivityHarness): Promise<void> => {
  const before = h.koda.count("learning.answered");
  await h.press(correctButton(h));
  expect(h.koda.count("learning.answered")).toBe(before + 1);
  const [last] = h.koda.only("learning.answered").slice(-1);
  expect(
    (last.args[0] as { correct: boolean }).correct,
    `marked wrong — screen: ${h.text().slice(0, 260)}`,
  ).toBe(true);
};

function correctButton(h: ActivityHarness): string {
  const claim = /Somebody says (\d+)\/(\d+) \+ (\d+)\/(\d+) = (\d+)\/(\d+)/.exec(h.text());
  if (claim) {
    const [, a, b, c, d, e, f] = claim.map(Number) as unknown as number[];
    const truth = a / b + c / d;
    const said = e / f;
    if (Math.abs(said - truth) < 1e-9) return "Yes, that looks about right";
    return said < truth ? "No — that is smaller than one of the pieces" : "No — that is more than the two together";
  }
  const one = /(\d+)\/(\d+) — nearest to what\?/.exec(h.text());
  expect(one, `no question on screen: ${h.text().slice(0, 200)}`).toBeTruthy();
  const value = Number(one![1]) / Number(one![2]);
  const gaps: [string, number][] = [
    [BENCHMARK_WORDS.nothing, Math.abs(value)],
    [BENCHMARK_WORDS.half, Math.abs(value - 0.5)],
    [BENCHMARK_WORDS.one, Math.abs(value - 1)],
  ];
  return gaps.sort((x, y) => x[1] - y[1])[0][0];
}

describe("benchmark — nothing, a half, or one whole", () => {
  it("never asks about a fraction sitting between two marks", () => {
    /*
     * `1/4` is exactly as far from nothing as it is from a half, and the honest
     * answer is "neither", which is not one of the buttons. Anything within a
     * tenth of a tie is not drawn.
     */
    for (const q of questions("benchmark", 300)) {
      const value = valueOf(q.fraction);
      const gaps = [Math.abs(value), Math.abs(value - 0.5), Math.abs(value - 1)].sort((a, b) => a - b);
      expect(gaps[1] - gaps[0], `${q.prompt} is a tie`).toBeGreaterThan(0.1);
    }
  });

  it("answers with the nearest of the three", () => {
    for (const q of questions("benchmark", 200)) {
      expect(q.expected, q.prompt).toBe(BENCHMARK_WORDS[benchmarkOf(q.fraction)]);
    }
  });

  it("offers all three, every time", () => {
    for (const q of questions("benchmark", 60)) {
      expect(q.options.sort()).toEqual(Object.values(BENCHMARK_WORDS).sort());
    }
  });

  it("draws all three answers across a round, not just the easy one", () => {
    const answers = new Set(questions("benchmark", 120).map((q) => q.expected));
    expect(answers.size).toBe(3);
  });

  it("gives a child nothing to calculate with", () => {
    const h = renderActivity(dial, { params: { question: { mode: "benchmark" } } });
    expect(h.screen.getByTestId("ruler")).toBeTruthy();
    expect(h.text()).toContain("nothing to work out");
    h.unmount();
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(dial, answerRight, {
      params: { question: { mode: "benchmark", partsRange: [3, 10] } },
      questions: 6,
    });
    h.unmount();
  });
});

describe("reasonable — could that be right?", () => {
  it("makes the wrong claims wrong in the one way a child can see", () => {
    // Never off by a little: "could it be 0.84?" is not a question anybody can
    // answer by looking, and a level that asked it would teach mistrust.
    for (const q of questions("reasonable", 200)) {
      if (q.verdict === "right") continue;
      const truth = valueOf(q.left!) + valueOf(q.right!);
      expect(valueOf(q.claim!), q.prompt).toBeLessThan(truth);
      expect(q.claim!.parts).toBe(q.left!.parts + q.right!.parts);
      // Smaller than one of the two pieces, which is the whole disproof.
      expect(valueOf(q.claim!)).toBeLessThan(Math.max(valueOf(q.left!), valueOf(q.right!)) + 1e-9);
    }
  });

  it("says yes as often as no, so no is not a free answer", () => {
    const sound = questions("reasonable", 120).filter((q) => q.verdict === "right").length;
    expect(sound).toBeGreaterThan(40);
    expect(sound).toBeLessThan(80);
  });

  it("agrees with itself about which claims are sound", () => {
    for (const q of questions("reasonable", 200)) {
      const truth = valueOf(q.left!) + valueOf(q.right!);
      const said = valueOf(q.claim!);
      const verdict = Math.abs(said - truth) < 1e-9 ? "right" : said < truth ? "too-small" : "too-big";
      expect(q.verdict, q.prompt).toBe(verdict);
    }
  });

  it("shows the claim, because refusing it is the task", async () => {
    const h = renderActivity(dial, { params: { question: { mode: "reasonable" } } });
    expect(h.text()).toMatch(/Somebody says the answer is \d+\/\d+/);
    expect(h.screen.getByTestId("two-fractions")).toBeTruthy();
    h.unmount();
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(dial, answerRight, {
      params: { question: { mode: "reasonable" } },
      questions: 6,
    });
    h.unmount();
  });
});

describe("what the child is told afterwards", () => {
  it("explains the judgement, not the verdict", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 40)) {
        for (const correct of [true, false]) {
          const text = explainEstimate(q, correct);
          expect(text.split(/\s+/).length, `${mode}: "${text}"`).toBeGreaterThanOrEqual(8);
          expect(text).not.toMatch(/that is (the answer|right|wrong)/i);
          expect(text).not.toMatch(/\b\d+\s?ths?\b/);
        }
      }
    }
  });

  it("says something different when it is wrong", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 20)) {
        expect(explainEstimate(q, true), mode).not.toBe(explainEstimate(q, false));
      }
    }
  });
});

describe("hints tell a child what to look at", () => {
  it("never tells them to calculate, which is the one thing this level forbids", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 40)) {
        const hints = estimateHints(q);
        expect(hints.length).toBeGreaterThanOrEqual(2);
        for (const hint of hints) {
          expect(hint, `${mode}: "${hint}"`).not.toMatch(/\bwork (it|them) out\b(?! yet)/i);
          expect(hint.includes(q.expected), `${mode}: "${hint}" hands over ${q.expected}`).toBe(false);
        }
      }
    }
  });

  it("accepts only the word it asked for", () => {
    for (const q of questions("benchmark", 40)) {
      expect(isEstimateCorrect(q, q.expected)).toBe(true);
      for (const other of q.options.filter((o) => o !== q.expected)) {
        expect(isEstimateCorrect(q, other), `${nameOf(q.fraction)}: ${other}`).toBe(false);
      }
    }
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(dial, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
