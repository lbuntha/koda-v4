import { describe, expect, it, vi } from "vitest";
import { FIT_MAX, FIT_MIN, clampFit, solveFit, wordsFit } from "./fitPage";

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

  it("shrinks the words by less than it shrinks the picture", () => {
    // The picture takes the whole factor twice over, so at the floor it is about
    // half its height; the words must stay well clear of that.
    expect(wordsFit(FIT_MAX)).toBe(1);
    expect(wordsFit(FIT_MIN)).toBeGreaterThan(FIT_MIN);
    expect(wordsFit(FIT_MIN)).toBeCloseTo(0.86, 2);
    expect(wordsFit(0.9)).toBeGreaterThan(0.9);
  });

  it("gives up words later than picture all the way down", () => {
    for (let fit = FIT_MAX; fit >= FIT_MIN; fit -= 0.04) {
      expect(wordsFit(fit)).toBeGreaterThanOrEqual(fit);
    }
  });
});
