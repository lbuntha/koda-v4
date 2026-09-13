import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  ROUTES,
  buildQuestion,
  explainStrategy,
  strategyHints,
  type StrategyQuestion,
} from "./activities/StrategyPicker";
import { gcd } from "./internal/data/fractionNumbers";

/**
 * The level with more than one right answer.
 *
 * What makes it a level rather than a quiz is the `fits` predicates: a route
 * offered against numbers it does not suit teaches a child that the strategy
 * names are decoration. These tests hold each predicate to what it claims.
 */

const picker = skill.activities.strategy;

const questions = (n = 300): StrategyQuestion[] => Array.from({ length: n }, (_, i) => buildQuestion({}, i));

/** Press any route the question says fits. */
const answerRight = async (h: ActivityHarness): Promise<void> => {
  const routes = h.within(h.screen.getByTestId("routes")).getAllByRole("button");
  const labels = routes.map((b) => (b.textContent ?? "").trim());
  const fitting = ROUTES.filter((r) => labels.includes(r.label));
  const before = h.koda.count("learning.answered");
  // Work out which of the offered routes genuinely suits the pair on screen,
  // rather than trusting the question object — that is what the level asks.
  const prompt = /(\d+)\/(\d+) \+ (\d+)\/(\d+)\. Which way/.exec(h.text());
  expect(prompt, `no pair on screen: ${h.text().slice(0, 200)}`).toBeTruthy();
  const [, at, ap, bt, bp] = (prompt as RegExpExecArray).map(Number) as unknown as number[];
  const left = { whole: { kind: "bar" as const, name: "the strip" }, parts: ap, taken: at };
  const right = { whole: { kind: "bar" as const, name: "the strip" }, parts: bp, taken: bt };
  const good = fitting.find((r) => r.fits(left, right));
  expect(good, `no offered route fits ${at}/${ap} + ${bt}/${bp} — offered ${labels.join(" | ")}`).toBeTruthy();
  const button = routes[labels.indexOf((good as (typeof ROUTES)[number]).label)];
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await h.settle();
  expect(h.koda.count("learning.answered")).toBe(before + 1);
  const [last] = h.koda.only("learning.answered").slice(-1);
  expect(
    (last.args[0] as { correct: boolean }).correct,
    `"${good?.label}" was marked wrong for ${at}/${ap} + ${bt}/${bp}`,
  ).toBe(true);
};

describe("a route is offered only when it applies", () => {
  it("never calls a pair matched when it is not", () => {
    for (const q of questions()) {
      const matched = ROUTES.find((r) => r.id === "already-match")!;
      expect(matched.fits(q.left, q.right), q.prompt).toBe(q.left.parts === q.right.parts);
    }
  });

  it("only suggests cutting one where one bottom number really divides the other", () => {
    const route = ROUTES.find((r) => r.id === "one-divides")!;
    for (const q of questions()) {
      const divides =
        q.left.parts !== q.right.parts &&
        (q.left.parts % q.right.parts === 0 || q.right.parts % q.left.parts === 0);
      expect(route.fits(q.left, q.right), q.prompt).toBe(divides);
    }
  });

  it("keeps multiplying-the-bottoms and finding-the-smallest apart", () => {
    // They are the same move when the denominators share nothing, and different
    // when they do. Offering both there would be offering one route twice.
    const multiply = ROUTES.find((r) => r.id === "multiply-bottoms")!;
    const smallest = ROUTES.find((r) => r.id === "smallest-common")!;
    for (const q of questions()) {
      if (q.left.parts === q.right.parts) continue;
      const shared = gcd(q.left.parts, q.right.parts);
      expect(multiply.fits(q.left, q.right), q.prompt).toBe(shared === 1);
      expect(smallest.fits(q.left, q.right), q.prompt).toBe(shared > 1);
    }
  });

  it("only suggests simplifying when something can be simplified", () => {
    const route = ROUTES.find((r) => r.id === "simplify-first")!;
    for (const q of questions()) {
      const messy = gcd(q.left.taken, q.left.parts) > 1 || gcd(q.right.taken, q.right.parts) > 1;
      expect(route.fits(q.left, q.right), q.prompt).toBe(messy);
    }
  });

  it("only suggests judging against a half when one of them is near a half", () => {
    const route = ROUTES.find((r) => r.id === "benchmark")!;
    for (const q of questions()) {
      const near =
        Math.abs(q.left.taken / q.left.parts - 0.5) < 0.13 ||
        Math.abs(q.right.taken / q.right.parts - 0.5) < 0.13;
      expect(route.fits(q.left, q.right), q.prompt).toBe(near);
    }
  });
});

describe("every question can be answered, and not by pressing anything", () => {
  it("always offers at least one route that fits", () => {
    for (const q of questions()) {
      const offered = q.offered.map((id) => ROUTES.find((r) => r.id === id)!);
      expect(offered.some((r) => r.fits(q.left, q.right)), `${q.prompt}: ${q.offered.join(", ")}`).toBe(true);
    }
  });

  it("always offers at least one that does not", () => {
    // A question where everything is right is not a question about choosing.
    for (const q of questions()) {
      const offered = q.offered.map((id) => ROUTES.find((r) => r.id === id)!);
      expect(offered.some((r) => !r.fits(q.left, q.right)), `${q.prompt}: ${q.offered.join(", ")}`).toBe(true);
    }
  });

  it("agrees with itself about which ones fit", () => {
    for (const q of questions()) {
      const fitting = ROUTES.filter((r) => r.fits(q.left, q.right)).map((r) => r.id);
      expect(q.fitting, q.prompt).toEqual(fitting);
      expect(q.expected).toBe(fitting.join(" | "));
    }
  });

  it("offers three or four routes, never one", () => {
    for (const q of questions()) {
      expect(q.offered.length, q.prompt).toBeGreaterThanOrEqual(3);
      expect(new Set(q.offered).size).toBe(q.offered.length);
    }
  });

  it("draws proper fractions on both sides", () => {
    for (const q of questions()) {
      expect(q.left.taken, q.prompt).toBeLessThan(q.left.parts);
      expect(q.right.taken).toBeLessThan(q.right.parts);
      expect(q.left.taken).toBeGreaterThan(0);
      expect(q.right.taken).toBeGreaterThan(0);
    }
  });
});

describe("the reason names these numbers", () => {
  it("says why the route fits, in English", () => {
    for (const q of questions(120)) {
      for (const id of q.fitting) {
        const route = ROUTES.find((r) => r.id === id)!;
        const why = route.why(q.left, q.right);
        expect(why.split(/\s+/).length, `${q.prompt}: "${why}"`).toBeGreaterThanOrEqual(8);
        expect(why, `${q.prompt}: "${why}"`).not.toMatch(/\b\d+\s?ths?\b/);
        expect(why).toMatch(/[.?]$/);
      }
    }
  });

  it("sends a wrong answer back to the bottom numbers", () => {
    for (const q of questions(40)) {
      expect(explainStrategy(q, false)).toMatch(/bottom numbers/);
      expect(explainStrategy(q, true)).not.toBe(explainStrategy(q, false));
    }
  });
});

describe("on screen", () => {
  it("says that more than one can be right", () => {
    const h = renderActivity(picker);
    expect(h.text()).toContain("more than one of these can be right");
    h.unmount();
  });

  it("keeps the hint ladder about the decision, not the sum", () => {
    for (const q of questions(20)) {
      const hints = strategyHints(q);
      expect(hints.length).toBeGreaterThanOrEqual(2);
      expect(hints.join(" ")).toMatch(/bottom numbers/);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(picker, answerRight, { questions: 5 });
    h.unmount();
  });

  it("says nothing when a round opens", () => {
    const h = renderActivity(picker, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
