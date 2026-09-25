import { describe, expect, it } from "vitest";
import { FLAT, TURNED, angularVelocity, castOf, completes, curlOf, dragAngle, shadeOf } from "./pageTurn";

const W = 360;

describe("a page held by a finger", () => {
  it("lifts going forward as the finger moves left, and never past turned", () => {
    expect(dragAngle(1, 0, W)).toBe(FLAT);
    expect(dragAngle(1, -W / 2, W)).toBe(-90);
    expect(dragAngle(1, -W * 3, W)).toBe(TURNED);
    expect(dragAngle(1, 40, W)).toBe(FLAT); // the wrong way does not bend it backwards
  });

  it("comes down going back as the finger moves right", () => {
    expect(dragAngle(-1, 0, W)).toBe(TURNED);
    expect(dragAngle(-1, W / 2, W)).toBe(-90);
    expect(dragAngle(-1, W, W)).toBe(FLAT);
  });
});

describe("letting go", () => {
  it("finishes a turn carried far enough, and lets a short one fall back", () => {
    expect(completes(1, -W * 0.5, 0, W)).toBe(true);
    expect(completes(1, -W * 0.2, 0, W)).toBe(false);
    expect(completes(-1, W * 0.5, 0, W)).toBe(true);
  });

  it("lets a flick decide, whatever the distance", () => {
    expect(completes(1, -30, -0.8, W)).toBe(true);
    expect(completes(1, -W * 0.6, 0.8, W)).toBe(false); // flicked back
    expect(completes(-1, 30, 0.8, W)).toBe(true);
  });

  it("hands the spring the finger's speed in degrees a second", () => {
    expect(angularVelocity(-1, 360)).toBe(-500);
  });
});

describe("light on the paper", () => {
  it("is nothing when a page lies flat, and most edge-on", () => {
    for (const f of [shadeOf, castOf, curlOf]) {
      expect(Math.abs(f(FLAT))).toBe(0);
      expect(Math.abs(f(TURNED))).toBeLessThan(1e-9);
      expect(Math.abs(f(-90))).toBeGreaterThan(Math.abs(f(-30)));
    }
  });
});
