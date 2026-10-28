import { describe, expect, it, vi } from "vitest";
import { FIT_MAX, FIT_MIN, WORDS_MIN, clampFit, solveFit } from "./fitPage";

describe("fitting a page to the screen", () => {
  /** A page whose height grows with the factor, as a real one does: picture and words both scale. */
  const page = (natural: number) => (fit: number) => natural * fit;

  it("leaves a page that already fits at its own size", () => {
    expect(solveFit(page(700), 800)).toBe(FIT_MAX);
  });

  it("finds the largest factor at which a taller page fits", () => {
    const fit = solveFit(page(1000), 800);
    expect(1000 * fit).toBeLessThanOrEqual(800);
    expect(1000 * (fit + 0.01)).toBeGreaterThan(800);
  });

  it("never squeezes past the smallest readable size", () => {
    expect(solveFit(page(10_000), 300)).toBe(FIT_MIN);
  });

  it("leaves a page alone when nothing can be measured", () => {
    expect(solveFit(page(1000), 0)).toBe(FIT_MAX);
    expect(solveFit(() => 0, 800)).toBe(FIT_MAX);
  });

  it("draws the page only a handful of times, however tall it is", () => {
    const draws = vi.fn(page(1000));
    solveFit(draws, 800);
    expect(draws.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("gives the same answer for the same page every time", () => {
    expect(solveFit(page(950), 800)).toBe(solveFit(page(950), 800));
  });

  it("holds a factor inside the range a page may be drawn at", () => {
    expect(clampFit(2)).toBe(FIT_MAX);
    expect(clampFit(0)).toBe(FIT_MIN);
  });

  it("searches inside the bounds it is given", () => {
    const words = solveFit((w) => 1000 * w, 900, WORDS_MIN, 1);
    expect(words).toBeGreaterThanOrEqual(WORDS_MIN);
    expect(words).toBeLessThanOrEqual(0.9);
    expect(solveFit((w) => 1000 * w, 100, WORDS_MIN, 1)).toBe(WORDS_MIN);
  });
});
