import { describe, expect, it } from "vitest";
import { CM_RULER, NUMBER_LINE, RULER_MODES, buildRuler, numberAt, quartersText, rulerChoices } from "./ruler";
import { ESTIMATE_LIST, ESTIMATE_THINGS, buildEstimate, tenfold } from "./estimate";

const N = 400;

describe("ruler questions", () => {
  it("every thing ends on a mark inside the ruler, and the answer is what the marks say", () => {
    for (const mode of RULER_MODES) {
      if (mode === "numberline") continue;
      for (let i = 0; i < N; i += 1) {
        const q = buildRuler({}, mode, new Set());
        const end = q.from + q.steps;
        expect(Number.isInteger(q.steps), mode).toBe(true);
        expect(end, mode).toBeLessThanOrEqual(q.ruler.span * q.ruler.sub);
        expect(q.steps, mode).toBeGreaterThan(0);
        // Reading the ruler: end number minus start number, in the answer's unit.
        const read = numberAt(q.ruler, end) - numberAt(q.ruler, q.from);
        const expected = q.mode === "read_mm" ? read * 10 : q.mode === "read_inch_fraction" ? read * 4 : q.mode === "difference" ? read - q.other!.steps / q.ruler.sub : read;
        expect(expected, `${mode} ${JSON.stringify(q)}`).toBeCloseTo(q.answer, 9);
      }
    }
  });

  it("cm lengths are 2–14 from 0; the broken ruler starts at 1–6", () => {
    for (let i = 0; i < N; i += 1) {
      const r = buildRuler({}, "read", new Set());
      expect(r.answer).toBeGreaterThanOrEqual(2);
      expect(r.answer).toBeLessThanOrEqual(14);
      expect(r.ruler).toEqual(CM_RULER);
      const o = buildRuler({}, "offset", new Set());
      expect(o.ruler.start).toBeGreaterThanOrEqual(1);
      expect(o.ruler.start).toBeLessThanOrEqual(6);
    }
  });

  it("differences are at least 1 and both lengths fit", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildRuler({}, "difference", new Set());
      expect(q.answer).toBeGreaterThanOrEqual(1);
      expect(q.other!.thing).not.toBe(q.thing);
      expect(q.steps / 2).toBeLessThanOrEqual(14);
    }
  });

  it("number-line jumps land on a mark between 5 and 100", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildRuler({}, "numberline", new Set());
      const { start, change, op } = q.line!;
      expect(q.answer).toBe(op === "add" ? start + change : start - change);
      for (const v of [start, change, q.answer]) expect(v % NUMBER_LINE.step).toBe(0);
      expect(q.answer).toBeGreaterThanOrEqual(5);
      expect(q.answer).toBeLessThanOrEqual(NUMBER_LINE.max);
      expect(change).toBeGreaterThan(0);
    }
  });

  it("inch fractions are never whole, and mm are mostly between cm marks", () => {
    let between = 0;
    for (let i = 0; i < N; i += 1) {
      expect(buildRuler({}, "read_inch_fraction", new Set()).answer % 4).not.toBe(0);
      const mm = buildRuler({}, "read_mm", new Set()).answer;
      expect(mm).toBeGreaterThanOrEqual(5);
      expect(mm).toBeLessThan(150);
      if (mm % 10) between += 1;
    }
    expect(between / N).toBeGreaterThan(0.85);
  });

  it("offers four different choices, including the answer and the classic mistake", () => {
    for (const mode of RULER_MODES) {
      if (mode === "numberline" || mode === "draw" || mode === "place") continue;
      for (let i = 0; i < N; i += 1) {
        const q = buildRuler({}, mode, new Set());
        const c = rulerChoices(q);
        expect(new Set(c).size, mode).toBe(4);
        expect(c).toContain(q.answer);
        for (const v of c) expect(v).toBeGreaterThan(0);
        const max = mode === "offset" ? q.ruler.start + q.ruler.span : mode === "read_mm" ? 150 : mode === "read_inch_fraction" ? 24 : q.ruler.span;
        for (const v of c) expect(v, `${mode} ${v}`).toBeLessThanOrEqual(max);
        if (mode === "offset") expect(c).toContain(q.ruler.start + q.answer);
        if (mode === "difference") expect(c).toContain(q.steps / 2);
        if (mode === "read_inch_fraction") for (const v of c) expect(v % 4).not.toBe(0);
        if (mode === "read_mm") expect(c.some((v) => Math.abs(v - q.answer) === 10)).toBe(true);
      }
    }
  });

  it("writes inch fractions the way a ruler reader says them", () => {
    expect(quartersText(1)).toBe("¼");
    expect(quartersText(2)).toBe("½");
    expect(quartersText(14)).toBe("3½");
    expect(quartersText(23)).toBe("5¾");
  });
});

describe("estimate questions", () => {
  it("each thing has a real size in the unit a school uses", () => {
    // Spot checks against everyday sizes.
    expect(ESTIMATE_THINGS.door).toMatchObject({ size: 2, unit: "m" });
    expect(ESTIMATE_THINGS.pencil).toMatchObject({ size: 15, unit: "cm" });
    expect(ESTIMATE_THINGS.bus).toMatchObject({ size: 12, unit: "m" });
    for (const t of ESTIMATE_LIST) {
      const { size, unit } = ESTIMATE_THINGS[t];
      // cm things are under a metre, m things under a kilometre.
      if (unit === "cm") expect(size).toBeLessThan(100);
      if (unit === "m") expect(size).toBeLessThan(1000);
    }
  });

  it("asks each unit about equally often", () => {
    const count: Record<string, number> = { cm: 0, m: 0, km: 0 };
    for (let i = 0; i < 3000; i += 1) {
      const q = buildEstimate({}, "choose_unit", new Set());
      expect(q.answer).toBe(ESTIMATE_THINGS[q.thing].unit);
      count[q.answer] += 1;
    }
    for (const n of Object.values(count)) expect(n / 3000).toBeGreaterThan(0.25);
  });

  it("benchmarks are the real size against one ten times off", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildEstimate({}, "benchmark", new Set());
      const [a, b] = q.options!;
      expect([a, b]).toContain(Number(q.answer));
      expect(Math.max(a, b) / Math.min(a, b)).toBe(10);
      for (const v of [a, b]) expect(Number.isInteger(v)).toBe(true);
    }
    expect(tenfold(2, () => 0)).toBe(20);
  });
});
