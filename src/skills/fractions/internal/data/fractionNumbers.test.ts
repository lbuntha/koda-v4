import { describe, expect, it } from "vitest";

import {
  WHOLES,
  canPartition,
  drawFraction,
  drawPair,
  equivalentsOf,
  fractionDistractors,
  fractionKey,
  gcd,
  isProper,
  isSimplified,
  isUnit,
  lcm,
  partitionsFor,
  relationOf,
  satisfiesFraction,
  satisfiesPair,
  simplify,
  toImproper,
  toMixed,
  valueOf,
  withoutRepeat,
  type Fraction,
  type FractionSpec,
  type PairSpec,
} from "./fractionNumbers";

/**
 * The generator, proved before any engine exists.
 *
 * Phase 0 of the build plan, and not optional. Every rule here is one that fails
 * silently: a "simplify this" lesson already in simplest form, a circle drawn in
 * sevenths, an improper fraction and a mixed number that are not the same
 * amount. None of those throw, none look wrong on screen, and all of them teach
 * the opposite of their own title.
 */

const DRAWS = 1_500;
const many = (spec: FractionSpec, n = DRAWS): Fraction[] =>
  Array.from({ length: n }, () => drawFraction(spec));

describe("a fraction is of something, and the something can be cut", () => {
  it("never asks for a partition the whole cannot honestly show", () => {
    for (const f of many({})) {
      expect(canPartition(f.whole, f.parts), `${f.parts} parts of ${f.whole.name}`).toBe(true);
    }
  });

  it("refuses a circle in fifths or sevenths", () => {
    // Drawn, they have parts a child can see are unequal — and a picture that
    // contradicts "equal parts" teaches the contradiction.
    const circle = WHOLES.find((w) => w.kind === "circle")!;
    expect(partitionsFor(circle)).toEqual([2, 3, 4, 6, 8, 12]);
    expect(canPartition(circle, 5)).toBe(false);
    expect(canPartition(circle, 7)).toBe(false);
  });

  it("only cuts a set into partitions that divide it", () => {
    const twelve = WHOLES.find((w) => w.kind === "set" && w.size === 12)!;
    expect(partitionsFor(twelve)).toEqual([2, 3, 4, 6, 12]);
    const eight = WHOLES.find((w) => w.kind === "set" && w.size === 8)!;
    expect(partitionsFor(eight)).toEqual([2, 4, 8]);
  });

  it("carries the whole on every fraction, and in its identity", () => {
    for (const f of many({}, 200)) expect(f.whole.name.trim()).not.toBe("");
    // The same fraction of two different wholes is two questions, not one.
    const a: Fraction = { whole: WHOLES[0], parts: 2, taken: 1 };
    const b: Fraction = { whole: WHOLES[2], parts: 2, taken: 1 };
    expect(fractionKey(a)).not.toBe(fractionKey(b));
  });
});

describe("the constraints are hard", () => {
  it("proper means proper", () => {
    for (const f of many({ proper: "always" })) expect(isProper(f)).toBe(true);
    for (const f of many({ proper: "never" }, 400)) expect(isProper(f)).toBe(false);
  });

  it("simplified always, and never", () => {
    for (const f of many({ simplified: "always" })) expect(isSimplified(f)).toBe(true);
    for (const f of many({ simplified: "never" }, 600)) {
      expect(isSimplified(f), `${f.taken}/${f.parts} is already simplest`).toBe(false);
      expect(gcd(f.taken, f.parts)).toBeGreaterThan(1);
    }
  });

  it("unit means one part", () => {
    for (const f of many({ unit: "always" })) expect(isUnit(f)).toBe(true);
    for (const f of many({ unit: "never" }, 400)) expect(f.taken).toBeGreaterThan(1);
  });

  it("stays inside the denominator range it is given", () => {
    for (const f of many({ partsRange: [3, 6] })) {
      expect(f.parts).toBeGreaterThanOrEqual(3);
      expect(f.parts).toBeLessThanOrEqual(6);
    }
  });

  it("draws only the wholes a lesson allows", () => {
    for (const f of many({ wholeKinds: ["bar"] }, 300)) expect(f.whole.kind).toBe("bar");
    for (const f of many({ wholeKinds: ["circle", "set"] }, 300)) {
      expect(["circle", "set"]).toContain(f.whole.kind);
    }
  });

  it("drops n/n unless a lesson asks for it", () => {
    for (const f of many({ proper: "any" }, 600)) expect(f.taken).not.toBe(f.parts);
    const whole = many({ proper: "any", excludeTrivial: false }, 600);
    expect(whole.some((f) => f.taken === f.parts)).toBe(true);
  });

  it("throws on a spec nothing can satisfy, rather than looping", () => {
    expect(() => drawFraction({ wholeKinds: ["circle"], partsRange: [5, 5] })).toThrow(
      /no fraction satisfies/,
    );
  });

  it("judges a fraction of an uncuttable whole as unsatisfiable", () => {
    const circle = WHOLES.find((w) => w.kind === "circle")!;
    expect(satisfiesFraction({ whole: circle, parts: 7, taken: 3 })).toBe(false);
  });
});

describe("pairs stand in the relationship a lesson asked for", () => {
  const pairs = (spec: PairSpec, n = 400) => Array.from({ length: n }, () => drawPair(spec));

  it("knows how two denominators relate", () => {
    expect(relationOf(4, 4)).toBe("same");
    expect(relationOf(3, 12)).toBe("nested");
    expect(relationOf(3, 4)).toBe("coprime");
    expect(relationOf(4, 6)).toBe("any"); // share a 2, neither divides the other
  });

  it("gives nested denominators when asked", () => {
    for (const { left, right } of pairs({ related: "nested" })) {
      expect(relationOf(left.parts, right.parts)).toBe("nested");
    }
  });

  it("gives coprime denominators when asked", () => {
    for (const { left, right } of pairs({ related: "coprime" })) {
      expect(gcd(left.parts, right.parts)).toBe(1);
      expect(left.parts).not.toBe(right.parts);
    }
  });

  it("keeps both fractions of the same whole by default", () => {
    for (const { left, right } of pairs({})) expect(left.whole.name).toBe(right.whole.name);
  });

  it("gives two different wholes for the level that needs them", () => {
    // Level 19's answer is "you cannot tell", and it cannot be asked without two.
    for (const { left, right } of pairs({ sameWhole: false }, 200)) {
      expect(left.whole.name).not.toBe(right.whole.name);
    }
  });

  it("holds the numerator still for the level about unit size", () => {
    // The level that exists because children believe 1/8 > 1/4.
    for (const { left, right } of pairs({ sameNumerator: true, related: "coprime" }, 200)) {
      expect(left.taken).toBe(right.taken);
      expect(left.parts).not.toBe(right.parts);
    }
  });

  it("never offers two fractions worth the same when they must differ", () => {
    for (const { left, right } of pairs({})) {
      expect(valueOf(left)).not.toBe(valueOf(right));
    }
  });
});

describe("a mixed number is the same amount, written differently", () => {
  it("round-trips every improper fraction", () => {
    for (const f of many({ proper: "never", partsRange: [2, 12] }, 800)) {
      const back = toImproper(toMixed(f));
      expect(back.taken).toBe(f.taken);
      expect(back.parts).toBe(f.parts);
      expect(back.whole.name).toBe(f.whole.name);
      expect(valueOf(back)).toBe(valueOf(f));
    }
  });

  it("leaves a proper fractional part behind", () => {
    for (const f of many({ proper: "never" }, 400)) {
      const m = toMixed(f);
      expect(m.taken).toBeLessThan(m.parts);
      expect(m.ones).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the whole, so the two names describe one quantity", () => {
    const f: Fraction = { whole: WHOLES[0], parts: 4, taken: 7 };
    const m = toMixed(f);
    expect(m).toMatchObject({ ones: 1, taken: 3, parts: 4 });
    expect(m.whole.name).toBe(f.whole.name);
  });
});

describe("equivalence and simplest form", () => {
  it("scales without changing the value", () => {
    for (const f of many({}, 300)) {
      for (const e of equivalentsOf(f)) expect(valueOf(e)).toBeCloseTo(valueOf(f), 10);
    }
  });

  it("simplifies to a fraction nothing further divides", () => {
    for (const f of many({ simplified: "never" }, 600)) {
      const s = simplify(f);
      expect(isSimplified(s), `${s.taken}/${s.parts}`).toBe(true);
      expect(valueOf(s)).toBeCloseTo(valueOf(f), 10);
    }
  });

  it("agrees with the arithmetic division already uses", () => {
    // Simplest form is dividing by the highest common factor, and there is one
    // definition of that in the app, not two.
    expect(gcd(18, 24)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
    expect(simplify({ whole: WHOLES[0], parts: 24, taken: 18 })).toMatchObject({ taken: 3, parts: 4 });
  });
});

describe("wrong answers are wrong for a reason", () => {
  it("names every distractor, and repeats none", () => {
    for (const f of many({ partsRange: [3, 12] }, 500)) {
      const wrong = fractionDistractors(f);
      expect(wrong).toHaveLength(3);
      expect(new Set(wrong.map((d) => `${d.value.taken}/${d.value.parts}`)).size).toBe(3);
      for (const d of wrong) {
        expect(d.fault).toBeTruthy();
        // One is allowed here and nowhere else: `2/1` is the swapped form of
        // `1/2`, offered as text and never drawn as a picture.
        expect(d.value.parts).toBeGreaterThanOrEqual(1);
        expect(d.value.taken).toBeGreaterThanOrEqual(1);
        expect(valueOf(d.value)).not.toBe(valueOf(f));
      }
    }
  });

  it("offers the two-numbers-swapped mistake, because that is the belief", () => {
    const f: Fraction = { whole: WHOLES[0], parts: 4, taken: 3 };
    const faults = fractionDistractors(f, 3).map((d) => d.fault);
    expect(faults).toContain("swapped");
  });
});

describe("no repeats inside a round", () => {
  it("asks ten different questions while ten exist", () => {
    const seen = new Set<string>();
    const spec: FractionSpec = { wholeKinds: ["bar"], partsRange: [2, 12] };
    const round = Array.from({ length: 10 }, () =>
      withoutRepeat(() => drawFraction(spec), fractionKey, seen),
    );
    expect(new Set(round.map(fractionKey)).size).toBe(10);
  });

  it("repeats rather than hangs once the space is exhausted", () => {
    const seen = new Set<string>();
    const spec: FractionSpec = { wholeKinds: ["bar"], partsRange: [2, 2] };
    const round = Array.from({ length: 5 }, () =>
      withoutRepeat(() => drawFraction(spec), fractionKey, seen),
    );
    expect(round).toHaveLength(5);
  });
});

describe("the pair judge", () => {
  it("refuses a pair whose members break the fraction rules", () => {
    const circle = WHOLES.find((w) => w.kind === "circle")!;
    const bad = { left: { whole: circle, parts: 7, taken: 2 }, right: { whole: circle, parts: 4, taken: 1 } };
    expect(satisfiesPair(bad)).toBe(false);
  });
});
