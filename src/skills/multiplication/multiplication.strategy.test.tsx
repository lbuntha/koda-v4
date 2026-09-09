import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/StrategyPicker";
import { STRATEGIES, fittingStrategies, strategyById } from "./internal/data/strategyPool";

/**
 * StrategyPicker, and the one thing it must not do.
 *
 * Level 56 has no single right answer. A child who reaches `16 × 5` by halving
 * and doubling has done as well as one who split it into tens and ones, so the
 * test that matters here is not "does it accept the right one" but "does it
 * accept *every* right one".
 */

const strategy = skill.activities.strategy;

const render = (params: Record<string, unknown> = {}) =>
  renderActivity(strategy, { params: { questionsPerRound: 6, ...params } });

/** The routes on offer, read off their own labels. */
const offered = (h: ActivityHarness): string[] =>
  h.buttons().filter((label) => STRATEGIES.some((s) => s.label === label));

describe("a strategy round plays through", () => {
  it("finishes a clean round on any route the child likes", async () => {
    const h = await expectStandardRound(strategy, async (harness) => {
      const [, a, b] = /(\d+) × (\d+)\. Which of these/.exec(harness.text())!;
      // Work out for ourselves which routes fit, and take the first.
      const fits = fittingStrategies(Number(a), Number(b)).map((s) => s.label);
      const choice = offered(harness).find((label) => fits.includes(label))!;
      await harness.press(choice);
    }, { questions: 6 });
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Every fitting route is right                                                */
/* -------------------------------------------------------------------------- */

describe("every route that fits is accepted", () => {
  /*
   * The point of the level, as an exhaustive check.
   *
   * Scoring one route above another would teach the opposite of what level 56
   * is for, so this walks every pair the lesson can draw and confirms that
   * each fitting route is genuinely carried out by the arithmetic it claims.
   */
  it("carries out the move each route claims, on every pair", () => {
    for (let a = 3; a <= 12; a += 1) {
      for (let b = 3; b <= 12; b += 1) {
        for (const s of fittingStrategies(a, b)) {
          expect(s.route(a, b), `${s.id} on ${a} × ${b}`).toBeTruthy();
          switch (s.id) {
            case "halve_and_double":
              // One factor even, and doubling the other lands on a ten.
              expect((a % 2 === 0 && (b * 2) % 10 === 0) || (b % 2 === 0 && (a * 2) % 10 === 0)).toBe(true);
              break;
            case "double_double":
              expect(a === 4 || b === 4).toBe(true);
              break;
            case "subtract_a_group":
              expect(a === 9 || b === 9).toBe(true);
              break;
            case "near_square":
              expect(Math.abs(a - b)).toBe(1);
              break;
            case "add_a_group":
              expect([a, b].some((n) => n === 3 || n === 6)).toBe(true);
              break;
            default:
              break;
          }
        }
      }
    }
  });

  it("accepts whichever fitting route is pressed", async () => {
    // Ten fresh questions, each answered with a different one of its routes.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const h = render();
      const [, a, b] = /(\d+) × (\d+)\. Which of these/.exec(h.text())!;
      const fits = fittingStrategies(Number(a), Number(b)).map((s) => s.label);
      const choices = offered(h).filter((label) => fits.includes(label));
      expect(choices.length, `${a} × ${b} offered no fitting route`).toBeGreaterThan(0);
      await h.press(choices[attempt % choices.length]);
      const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
      expect(report.correct, `${a} × ${b} refused a route that fits`).toBe(true);
      h.unmount();
    }
  });

  it("always draws a pair with more than one way into it", () => {
    for (let i = 0; i < 300; i += 1) {
      const question = buildQuestion({}, i);
      // Nothing to compare with only one route.
      expect(question.fits.length).toBeGreaterThanOrEqual(2);
      expect(question.product).toBe(question.a * question.b);
    }
  });

  it("offers at least one route that does not fit, so choosing means something", () => {
    for (let i = 0; i < 300; i += 1) {
      const question = buildQuestion({}, i);
      const misses = question.offered.filter((id) => !question.fits.includes(id));
      expect(misses.length, `${question.a} × ${question.b}`).toBeGreaterThan(0);
      expect(question.offered.length).toBeGreaterThanOrEqual(2);
      expect(new Set(question.offered).size).toBe(question.offered.length);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A route that cannot be taken                                                */
/* -------------------------------------------------------------------------- */

describe("a route that does not fit is refused, not marked wrong", () => {
  it("says which move cannot be made, and scores nothing", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const h = render();
      const [, a, b] = /(\d+) × (\d+)\. Which of these/.exec(h.text())!;
      const fits = fittingStrategies(Number(a), Number(b)).map((s) => s.label);
      const miss = offered(h).find((label) => !fits.includes(label));
      if (!miss) {
        h.unmount();
        continue;
      }
      await h.press(miss);
      // Refused: nothing scored, and the reason is arithmetic not preference.
      expect(h.koda.count("learning.answered"), `${a} × ${b}: ${miss} was scored`).toBe(0);
      const why = STRATEGIES.find((s) => s.label === miss)!.why(Number(a), Number(b));
      expect(h.text()).toContain(why);
      // And the routes are all still there to choose from.
      expect(offered(h).length).toBeGreaterThan(1);
      h.unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Comparing                                                                   */
/* -------------------------------------------------------------------------- */

describe("comparing is the second half of the lesson", () => {
  it("shows another working route beside the one taken", async () => {
    const h = render();
    const [, a, b] = /(\d+) × (\d+)\. Which of these/.exec(h.text())!;
    const fits = fittingStrategies(Number(a), Number(b));
    const choice = offered(h).find((label) => fits.some((s) => s.label === label))!;
    await h.press(choice);
    expect(h.text()).toContain("Another route that also works");
    // And it is a different one from the route just taken.
    const alternative = fits.find((s) => s.label !== choice)!;
    expect(h.text()).toContain(alternative.label);
    h.unmount();
  });

  it("shows the route worked through, not just named", async () => {
    const h = render();
    const [, a, b] = /(\d+) × (\d+)\. Which of these/.exec(h.text())!;
    const fits = fittingStrategies(Number(a), Number(b));
    const chosen = fits.find((s) => offered(h).includes(s.label))!;
    await h.press(chosen.label);
    expect(h.text()).toContain(chosen.route(Number(a), Number(b)));
    expect(h.text()).toContain(`${a} × ${b} = ${Number(a) * Number(b)}`);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet asks for two ways and a comparison", () => {
  it("prints the task and every route that works", () => {
    for (let i = 0; i < 30; i += 1) {
      const question = buildQuestion({}, i);
      const printed = strategy.worksheet!.printed!(question)!;
      expect(printed.text).toContain("two different ways");
      expect(printed.answer).toContain(String(question.product));
      for (const id of question.fits) {
        expect(printed.answer).toContain(strategyById(id).label);
      }
      expect(strategy.worksheet!.method!(question)!.length).toBeGreaterThan(1);
      // There is no picture of a choice.
      expect(strategy.worksheet!.figure!(question)).toBeNull();
    }
  });
});
