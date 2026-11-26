import { describe, expect, it } from "vitest";
import { INTERVAL_DIALS, SCALE_MODES, buildScale, lbOz, scaleChoices, stepsOf } from "./scale";
import { THERMO_MODES, buildThermo, thermoChoices } from "./thermo";
import { STORY_TEMPLATES, buildStory, storyChoices } from "./story";
import { ESTIMATE_THINGS, UNIT_SETS, buildEstimate, quantityOf } from "./estimate";

const N = 400;
const onStep = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-9;

describe("scale questions", () => {
  it("every needle points at a mark strictly inside the dial", () => {
    for (const mode of SCALE_MODES) {
      for (let i = 0; i < N; i += 1) {
        const q = buildScale({}, mode, new Set());
        expect(onStep(q.value, q.dial.step), `${mode} ${q.value}`).toBe(true);
        expect(q.value).toBeGreaterThan(0);
        expect(q.value).toBeLessThan(q.dial.max);
        expect(q.dial.max % q.dial.labelEvery, mode).toBe(0);
      }
    }
  });

  it("interval and lb readings sit between numbers, so the marks must be worked out", () => {
    for (let i = 0; i < N; i += 1) {
      for (const mode of ["interval", "read_lb"] as const) {
        const q = buildScale({}, mode, new Set());
        expect(onStep(q.value, q.dial.labelEvery), `${mode} ${q.value}`).toBe(false);
      }
    }
  });

  it("uses every step size the plan lists, each dividing its dial evenly", () => {
    expect(INTERVAL_DIALS.map((d) => d.step)).toEqual([2, 5, 10, 20, 25, 50, 100, 250]);
    for (const d of INTERVAL_DIALS) {
      expect(d.labelEvery % d.step).toBe(0);
      expect(stepsOf(d)).toBeLessThanOrEqual(40);
    }
  });

  it("luggage readings are halves; bathroom ones are a child's weight", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildScale({}, "read_kg", new Set());
      if (q.load === "suitcase") expect(q.value % 1).toBe(0.5);
      else {
        expect(q.value).toBeGreaterThanOrEqual(15);
        expect(q.value).toBeLessThanOrEqual(58);
      }
    }
  });

  it("offers four choices on the dial, including counting marks as 1s", () => {
    for (const mode of SCALE_MODES) {
      for (let i = 0; i < N; i += 1) {
        const q = buildScale({}, mode, new Set());
        const c = scaleChoices(q);
        expect(new Set(c).size, mode).toBe(4);
        expect(c).toContain(q.value);
        for (const v of c) expect(v > 0 && v < q.dial.max, `${mode} ${v}`).toBe(true);
        if (mode === "interval") {
          const below = Math.floor(q.value / q.dial.labelEvery) * q.dial.labelEvery;
          expect(c).toContain(below + Math.round((q.value - below) / q.dial.step));
        }
      }
    }
  });

  it("writes pounds and ounces as a US scale says them", () => {
    expect(lbOz(5)).toBe("5 oz");
    expect(lbOz(16)).toBe("1 lb");
    expect(lbOz(21)).toBe("1 lb 5 oz");
  });
});

describe("thermometer questions", () => {
  it("readings sit on a mark between the numbers, inside the scale", () => {
    for (const mode of THERMO_MODES) {
      for (let i = 0; i < N; i += 1) {
        const q = buildThermo({}, mode, 1 + (i % 5), new Set());
        expect(q.value, mode).toBeGreaterThan(q.scale.min);
        expect(q.value, mode).toBeLessThan(q.scale.max);
        expect((q.value - q.scale.min) % q.scale.step, `${mode} ${q.value}`).toBe(0);
        if (mode !== "change") expect(q.value % q.scale.labelEvery, mode).not.toBe(0);
      }
    }
  });

  it("read steps 1, then 2, then 5 over a round", () => {
    expect([1, 2, 3, 4, 5, 6].map((i) => buildThermo({}, "read", i, new Set()).scale.step)).toEqual([1, 1, 2, 2, 5, 5]);
  });

  it("goes below zero most of the time, and changes are right and often cross 0", () => {
    let below = 0;
    let crossing = 0;
    for (let i = 0; i < N; i += 1) {
      if (buildThermo({}, "negative", 1, new Set()).value < 0) below += 1;
      const c = buildThermo({}, "change", 1, new Set());
      const { by, dir } = c.change!;
      expect(c.answer).toBe(dir === "warmer" ? c.value + by : c.value - by);
      expect(c.answer).toBeGreaterThan(c.scale.min);
      expect(c.answer).toBeLessThan(c.scale.max);
      if (Math.sign(c.answer) !== Math.sign(c.value)) crossing += 1;
    }
    expect(below / N).toBeGreaterThan(0.6);
    expect(crossing / N).toBeGreaterThan(0.4);
  });

  it("offers the sign slip below zero, and the wrong direction for a change", () => {
    for (const mode of THERMO_MODES) {
      for (let i = 0; i < N; i += 1) {
        const q = buildThermo({}, mode, 1 + (i % 5), new Set());
        const c = thermoChoices(q);
        expect(new Set(c).size, mode).toBe(4);
        expect(c).toContain(q.answer);
        if (q.answer < 0) expect(c).toContain(-q.answer);
        if (mode === "change") {
          const wrongWay = q.change!.dir === "warmer" ? q.value - q.change!.by : q.value + q.change!.by;
          if (wrongWay > q.scale.min - 1 && wrongWay < q.scale.max + 1 && !(q.answer < 0 && -q.answer === wrongWay)) expect(c).toContain(wrongWay);
        }
      }
    }
  });
});

describe("story questions", () => {
  it("answers are right, round and at most 1000 (100 for cm)", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildStory({}, new Set());
      const t = STORY_TEMPLATES.find((x) => x.id === q.template)!;
      expect(q.answer).toBe(q.kind === "join" ? q.a + q.b : q.a - q.b);
      for (const v of [q.a, q.b, q.answer]) {
        expect(v % t.round, q.template).toBe(0);
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(t.unit === "cm" ? 100 : 1000);
      }
    }
  });

  it("covers length, mass and capacity, each as join, take away and compare", () => {
    const seen = new Set(STORY_TEMPLATES.map((t) => `${t.quantity}:${t.kind}`));
    expect(seen.size).toBe(9);
  });

  it("offers the wrong operation as a choice", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildStory({}, new Set());
      const c = storyChoices(q);
      expect(new Set(c).size).toBe(4);
      expect(c).toContain(q.answer);
      expect(c).toContain(q.kind === "join" ? Math.abs(q.a - q.b) : q.a + q.b);
    }
  });
});

describe("mass and capacity units", () => {
  it("asks g/kg or ml/l about things measured in them, each unit equally often", () => {
    const count: Record<string, number> = {};
    for (let i = 0; i < 4000; i += 1) {
      const q = buildEstimate({ quantity: "mass_capacity" }, "choose_unit", new Set());
      const unit = ESTIMATE_THINGS[q.thing].unit;
      expect(q.answer).toBe(unit);
      expect(q.units).toEqual(UNIT_SETS[quantityOf(unit)]);
      expect(["mass", "capacity"]).toContain(quantityOf(unit));
      count[unit] = (count[unit] ?? 0) + 1;
    }
    for (const u of ["g", "kg", "mL", "L"]) expect(count[u] / 4000, u).toBeGreaterThan(0.18);
  });

  it("keeps benchmarks to lengths", () => {
    for (let i = 0; i < N; i += 1) expect(quantityOf(ESTIMATE_THINGS[buildEstimate({}, "benchmark", new Set()).thing].unit)).toBe("length");
  });
});
