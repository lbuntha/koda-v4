import { describe, expect, it } from "vitest";
import { answerChoices } from "./answerChoices";

/**
 * The tell this exists to remove.
 *
 * Every engine built `answer - 2 … answer + 1`, so the right button was the
 * third one almost every time. A child needs two or three rounds to notice,
 * and from then on position beats arithmetic — the round still scores as
 * learning while measuring nothing.
 */

describe("answer choices", () => {
  it("always includes the answer", () => {
    for (let answer = 0; answer < 60; answer += 1) {
      expect(answerChoices(answer, `q${answer}`)).toContain(answer);
    }
  });

  it("offers four distinct nonnegative near misses", () => {
    for (let answer = 0; answer < 60; answer += 1) {
      const choices = answerChoices(answer, `q${answer}`);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices.every((n) => n >= 0)).toBe(true);
      // Near misses, not a spread: picking by size alone must not work.
      expect(Math.max(...choices) - Math.min(...choices)).toBeLessThanOrEqual(4);
    }
  });

  it("spreads the answer across every slot rather than parking it in one", () => {
    const slots = [0, 0, 0, 0];
    for (let i = 0; i < 2000; i += 1) {
      slots[answerChoices(7 + (i % 20), `question-${i}`).indexOf(7 + (i % 20))] += 1;
    }
    // The old window scored 2000 in slot 2 and nothing anywhere else. Each slot
    // should now take roughly a quarter; the band is wide enough not to be
    // flaky and narrow enough to fail a fixed position.
    for (const [slot, hits] of slots.entries()) {
      expect(hits, `slot ${slot} took ${hits} of 2000`).toBeGreaterThan(2000 * 0.15);
      expect(hits, `slot ${slot} took ${hits} of 2000`).toBeLessThan(2000 * 0.35);
    }
  });

  it("keeps one question's order still, and moves it for the next", () => {
    // Stable within a question: a re-shuffle on render would slide the buttons
    // under a finger already on its way down.
    expect(answerChoices(7, "same")).toEqual(answerChoices(7, "same"));
    const orders = new Set(Array.from({ length: 20 }, (_, i) => answerChoices(7, `q${i}`).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("still fills the window when the answer sits on a bound", () => {
    // An answer of zero must get three real neighbours, not three clamped
    // duplicates collapsing the round to one button.
    expect(new Set(answerChoices(0, "q")).size).toBe(4);
    expect(answerChoices(0, "q").every((n) => n >= 0)).toBe(true);
  });

  it("honours a declared range and step", () => {
    const inRange = answerChoices(5, "q", { count: 5, min: 2, max: 9 });
    expect(inRange).toHaveLength(5);
    expect(inRange.every((n) => n >= 2 && n <= 9)).toBe(true);
    const byHundred = answerChoices(300, "q", { step: 100 });
    expect(byHundred.every((n) => n % 100 === 0)).toBe(true);
  });
});
