import { describe, expect, it } from "vitest";
import { TUNE, bendTarget, dampingFor, isAtRest, stepSpring, stepTip, substeps, tipAt, tracePath, type Spring, type Tune } from "./tracePhysics";

const tune: Tune = { ...TUNE };
const run = (s: Spring, target: number, k: number, c: number, seconds: number): Spring => {
  let cur = s;
  for (let t = 0; t < seconds; t += TUNE.step) cur = stepSpring(cur, target, k, c, TUNE.step);
  return cur;
};

describe("stepSpring", () => {
  it("settles on its target", () => {
    const end = run({ x: 0, v: 0 }, 10, 420, dampingFor(420), 1.5);
    expect(end.x).toBeCloseTo(10, 2);
    expect(isAtRest(end, 10)).toBe(true);
  });

  it("does not overshoot when critically damped", () => {
    let s: Spring = { x: 0, v: 0 };
    let peak = 0;
    for (let t = 0; t < 2; t += TUNE.step) {
      s = stepSpring(s, 10, 420, dampingFor(420), TUNE.step);
      peak = Math.max(peak, s.x);
    }
    expect(peak).toBeLessThanOrEqual(10.05);
  });

  it("rings a little when underdamped, and still settles — the tile's pop", () => {
    let s: Spring = { x: 0, v: 0 };
    let peak = 0;
    for (let t = 0; t < 2; t += TUNE.step) {
      s = stepSpring(s, 10, 420, dampingFor(420, 0.5), TUNE.step);
      peak = Math.max(peak, s.x);
    }
    expect(peak).toBeGreaterThan(10);
    expect(s.x).toBeCloseTo(10, 1);
  });

  it("stays finite at a long frame, because the loop caps its steps", () => {
    const { count, dt } = substeps(5);
    expect(count).toBe(TUNE.maxSteps);
    let s: Spring = { x: 0, v: 0 };
    for (let i = 0; i < count; i++) s = stepSpring(s, 10, 420, dampingFor(420), dt);
    expect(Number.isFinite(s.x) && Number.isFinite(s.v)).toBe(true);
  });
});

describe("substeps", () => {
  it("takes at least one step and at most four", () => {
    expect(substeps(0).count).toBe(1);
    expect(substeps(0.001).count).toBe(1);
    expect(substeps(1 / 60).count).toBe(2);
    expect(substeps(10).count).toBe(TUNE.maxSteps);
  });

  it("spends the same elapsed time however it is split, up to the cap", () => {
    for (const elapsed of [1 / 144, 1 / 60, 1 / 30]) {
      const { count, dt } = substeps(elapsed);
      expect(count * dt).toBeCloseTo(elapsed, 9);
    }
  });

  it("treats a negative elapsed time as none", () => {
    expect(substeps(-1).dt).toBe(0);
  });
});

describe("bendTarget", () => {
  const anchor = { x: 0, y: 0 };
  const tip = { x: 100, y: 0 };

  it("bows away from a sideways movement and is zero when the finger moves along the line", () => {
    expect(bendTarget(anchor, tip, { x: 500, y: 0 }, 0.12, 20)).toBeCloseTo(0, 9);
    expect(bendTarget(anchor, tip, { x: 0, y: 200 }, 0.12, 20)).toBeLessThan(0);
    expect(bendTarget(anchor, tip, { x: 0, y: -200 }, 0.12, 20)).toBeGreaterThan(0);
  });

  it("is capped, so the line can never fold back on itself", () => {
    expect(Math.abs(bendTarget(anchor, tip, { x: 0, y: 1e9 }, 0.12, 20))).toBe(20);
    expect(Math.abs(bendTarget(anchor, tip, { x: 0, y: -1e9 }, 0.12, 20))).toBe(20);
  });

  it("copes with a tip sitting on the anchor", () => {
    expect(Number.isFinite(bendTarget(anchor, anchor, { x: 10, y: 10 }, 0.12, 20))).toBe(true);
  });
});

describe("stepTip", () => {
  const pointer = { x: 100, y: 60, vx: 0, vy: 0 };

  it("trails the finger, then arrives", () => {
    let tip = tipAt({ x: 0, y: 0 });
    tip = stepTip(tip, pointer, { x: 0, y: 0 }, TUNE.step, tune);
    expect(tip.x).toBeGreaterThan(0);
    expect(tip.x).toBeLessThan(100); // it has not arrived after one step: that is the lag
    for (let i = 0; i < 240; i++) tip = stepTip(tip, pointer, { x: 0, y: 0 }, TUNE.step, tune);
    expect(tip.x).toBeCloseTo(100, 1);
    expect(tip.y).toBeCloseTo(60, 1);
    expect(tip.bend).toBeCloseTo(0, 1);
  });

  it("never bows past the cap, even chasing a fast finger", () => {
    let tip = tipAt({ x: 0, y: 0 });
    const fast = { x: 100, y: 0, vx: 0, vy: 5000 };
    for (let i = 0; i < 400; i++) tip = stepTip(tip, fast, { x: 0, y: 0 }, TUNE.step, tune);
    expect(Math.abs(tip.bend)).toBeLessThanOrEqual(TUNE.bendCap + 1);
  });
});

describe("tracePath", () => {
  it("is empty with nothing chosen", () => {
    expect(tracePath([], null)).toBe("");
  });

  it("is straight lines between chosen tiles", () => {
    expect(tracePath([{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 30, y: 20 }], null)).toBe("M0.0 0.0L10.0 20.0L30.0 20.0");
  });

  it("ends in one curve to the tip while a finger is down, and only one", () => {
    const d = tracePath([{ x: 0, y: 0 }, { x: 10, y: 0 }], { ...tipAt({ x: 40, y: 0 }), bend: 8 });
    expect(d.startsWith("M0.0 0.0L10.0 0.0Q")).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(1);
    expect(d.endsWith("40.0 0.0")).toBe(true);
  });

  it("bows toward the side the bend points to", () => {
    const up = tracePath([{ x: 0, y: 0 }], { ...tipAt({ x: 100, y: 0 }), bend: 10 });
    const down = tracePath([{ x: 0, y: 0 }], { ...tipAt({ x: 100, y: 0 }), bend: -10 });
    const y = (d: string) => Number(d.match(/Q[\d.-]+ ([\d.-]+)/)![1]);
    expect(y(up)).toBeGreaterThan(y(down));
  });
});
