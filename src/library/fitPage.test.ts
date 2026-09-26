import { describe, expect, it } from "vitest";
import { FIT_MAX, FIT_MIN, clampFit, nextFit } from "./fitPage";

describe("fitting a page to the screen", () => {
  it("shrinks a page that is taller than its box", () => {
    const fit = nextFit(FIT_MAX, 1000, 800);
    expect(fit).toBeLessThan(FIT_MAX);
    expect(fit).toBeGreaterThanOrEqual(FIT_MIN);
  });

  it("leaves a page that already fits at its own size", () => {
    expect(nextFit(FIT_MAX, 700, 800)).toBe(FIT_MAX);
  });

  it("grows back towards its own size once there is room again", () => {
    expect(nextFit(0.8, 500, 800)).toBeGreaterThan(0.8);
  });

  it("never squeezes past the smallest readable size", () => {
    expect(nextFit(FIT_MAX, 10_000, 300)).toBe(FIT_MIN);
  });

  it("settles rather than flutters between two near-equal sizes", () => {
    // One pass off fitting exactly: not worth a redraw.
    expect(nextFit(0.9, 805, 800)).toBe(0.9);
  });

  it("keeps the current size when nothing can be measured", () => {
    expect(nextFit(0.9, 0, 0)).toBe(0.9);
    expect(nextFit(0.9, 500, 0)).toBe(0.9);
  });

  it("converges in a few passes for a page over the box but within reach", () => {
    let fit = FIT_MAX;
    const natural = 1000;
    const box = 800;
    for (let i = 0; i < 6; i++) fit = nextFit(fit, natural * fit, box);
    expect(natural * fit).toBeLessThanOrEqual(box);
  });

  it("holds a factor inside the range a page may be drawn at", () => {
    expect(clampFit(2)).toBe(FIT_MAX);
    expect(clampFit(0)).toBe(FIT_MIN);
  });
});
