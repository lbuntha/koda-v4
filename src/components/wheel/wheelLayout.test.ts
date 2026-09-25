import { describe, expect, it } from "vitest";
import { MIN_TOUCH_PX, RING, VIEW, angleOf, layoutRing, maxRingTiles, minContainerWidth, neighbourGap, pointAt, tileRadiusFor, tileScreenDiameter } from "./wheelLayout";

describe("layoutRing", () => {
  it("puts the first tile at the top and spaces the rest evenly", () => {
    const [first, second] = layoutRing(4);
    expect(first.x).toBeCloseTo(VIEW.cx, 6);
    expect(first.y).toBeCloseTo(VIEW.cy - RING.radius, 6);
    expect(second.x).toBeCloseTo(VIEW.cx + RING.radius, 6); // a quarter turn clockwise
    expect(second.y).toBeCloseTo(VIEW.cy, 6);
  });

  it("keeps every tile exactly one ring radius from the centre", () => {
    for (let n = 1; n <= 10; n++) {
      for (const p of layoutRing(n)) expect(Math.hypot(p.x - VIEW.cx, p.y - VIEW.cy)).toBeCloseTo(RING.radius, 6);
    }
  });

  it("returns nothing for no tiles rather than throwing", () => {
    expect(layoutRing(0)).toEqual([]);
  });

  it("agrees with angleOf and pointAt, so an animation can start from either", () => {
    const p = layoutRing(5)[3];
    expect(p.angle).toBeCloseTo(angleOf(3, 5), 9);
    expect(pointAt(p.angle).x).toBeCloseTo(p.x, 9);
    expect(pointAt(p.angle, 10).x).not.toBeCloseTo(p.x, 3);
  });
});

describe("tiles never overlap", () => {
  it.each(["latin", "khmer"] as const)("%s: every count up to maxRingTiles leaves the neighbours clear", (script) => {
    const max = maxRingTiles(script);
    for (let n = 2; n <= max; n++) expect(neighbourGap(n)).toBeGreaterThanOrEqual(2 * tileRadiusFor(script));
  });

  it("holds at least eight tiles in either script — the most a story's word can need", () => {
    expect(maxRingTiles("latin")).toBeGreaterThanOrEqual(8);
    expect(maxRingTiles("khmer")).toBeGreaterThanOrEqual(8);
  });

  it("gives the larger Khmer tile fewer places, and still enough", () => {
    expect(maxRingTiles("khmer")).toBeLessThanOrEqual(maxRingTiles("latin"));
  });
});

describe("the 44px floor", () => {
  it("is met at 360px wide phones, with room to spare, in both scripts", () => {
    // A 360px viewport minus a 16px gutter each side leaves 328.
    for (const script of ["latin", "khmer"] as const) expect(tileScreenDiameter(script, 328)).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  });

  it("names the narrowest container that still meets it", () => {
    for (const script of ["latin", "khmer"] as const) {
      const w = minContainerWidth(script);
      expect(tileScreenDiameter(script, w)).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
      expect(tileScreenDiameter(script, w - 1)).toBeLessThan(MIN_TOUCH_PX);
    }
  });
});
