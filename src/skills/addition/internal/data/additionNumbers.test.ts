import { describe, expect, it } from "vitest";
import {
  carriesIn,
  digitsOf,
  drawChain,
  drawDouble,
  drawFriendlyChain,
  drawNearDouble,
  drawPair,
  drawRoundingPair,
  drawStory,
  friendlyPairCount,
  isBridging,
  isRegrouping,
  pairKey,
  roundTo,
  satisfiesPair,
  total,
  withoutRepeat,
  type PairSpec,
} from "./additionNumbers";

/**
 * The generator is random, so the tests assert *properties*, not values.
 *
 * Two hundred draws per spec, and every one of them has to satisfy the spec it
 * was drawn for. A test that pinned a seed would prove the generator does one
 * thing correctly; this proves it cannot do the wrong thing — which is the
 * failure that matters, because a lesson whose numbers quietly stop matching
 * its title looks completely fine on screen.
 */

const DRAWS = 200;
const times = (n: number, fn: (i: number) => void) => {
  for (let i = 0; i < n; i += 1) fn(i);
};

describe("place value", () => {
  it("splits a number into its columns", () => {
    expect(digitsOf(407)).toEqual({ ones: 7, tens: 0, hundreds: 4 });
  });

  it("carries out of the ones", () => {
    expect(carriesIn(8, 5)).toEqual(["ones"]);
  });

  it("carries out of the tens because the ones carried first", () => {
    // 47 + 56: the tens digits are 4 + 5 = 9, which reaches ten *only* with the
    // carry the ones sent up. A check that added the tens alone would call this
    // a single-carry problem and file it as a lesson in something it is not.
    expect(carriesIn(47, 56)).toEqual(["ones", "tens"]);
    // And the near miss it must not confuse itself with: here the tens really
    // do stay under ten once the carry lands.
    expect(carriesIn(47, 36)).toEqual(["ones"]);
  });

  it("does not carry when every column stays under ten", () => {
    expect(carriesIn(23, 45)).toEqual([]);
    expect(isRegrouping(23, 45)).toBe(false);
  });

  it("knows a pair that crosses ten from below", () => {
    expect(isBridging(8, 5)).toBe(true);
    expect(isBridging(4, 5)).toBe(false); // does not reach ten
    expect(isBridging(14, 5)).toBe(false); // did not start below it
  });
});

describe("drawPair honours every constraint it is given", () => {
  const specs: Record<string, PairSpec> = {
    "count all (L1)": { addendRange: [1, 5], sumMax: 10 },
    "count on (L3)": { aRange: [4, 9], bRange: [1, 3] },
    "add zero (L5)": { aRange: [1, 10], bRange: [0, 0] },
    "ten frame (L9)": { addendRange: [1, 9], sumMax: 10 },
    "break apart an addend (L22)": { aRange: [6, 9], bRange: [3, 9], bridging: true },
    "switch the addends (L26)": { aRange: [1, 4], bRange: [6, 9], minGap: 3 },
    "use a known fact (L24)": { addendRange: [3, 9], sumMax: 18, maxGap: 2 },
    "compensation (L28)": { aRange: [21, 79], bRange: [11, 89], endsIn: [8, 9] },
    "multiples of ten (L29)": { addendRange: [10, 90], multipleOf: 10, sumMax: 100 },
    "multiples of a hundred (L30)": { addendRange: [100, 900], multipleOf: 100, sumMax: 1000 },
    "base-ten blocks, clean columns (L13)": { addendRange: [11, 88], regroup: "never" },
    "place-value chart, three digits (L32)": { addendRange: [111, 888], regroup: "never" },
    "partial sums, one carry (L34)": { addendRange: [11, 89], regroup: "ones" },
    "cascading regrouping (L38)": { addendRange: [111, 889], regroup: "both" },
  };

  for (const [name, spec] of Object.entries(specs)) {
    it(name, () => {
      times(DRAWS, () => {
        const pair = drawPair(spec);
        expect(satisfiesPair(pair, spec), `${pair.a} + ${pair.b} violates ${name}`).toBe(true);
        expect(pair.sum).toBe(pair.a + pair.b);
      });
    });
  }

  it("never regroups when told never to", () => {
    times(DRAWS, () => {
      const { a, b } = drawPair({ addendRange: [11, 88], regroup: "never" });
      expect(isRegrouping(a, b), `${a} + ${b} regrouped`).toBe(false);
    });
  });

  it("always regroups when told to", () => {
    times(DRAWS, () => {
      const { a, b } = drawPair({ addendRange: [111, 889], regroup: "both" });
      expect(carriesIn(a, b)).toContain("ones");
      expect(carriesIn(a, b)).toContain("tens");
    });
  });

  it("throws on a spec no pair can satisfy, rather than relaxing it", () => {
    // An authoring mistake should stop a test, not hand a child a question
    // built from a rule that was quietly dropped.
    expect(() => drawPair({ addendRange: [1, 5], sumMin: 20 })).toThrow(/no pair satisfies/);
  });

  it("finds the one legal pair in a space random draws would miss", () => {
    const spec: PairSpec = { aRange: [1, 60], bRange: [1, 60], sumMin: 120, sumMax: 120 };
    expect(drawPair(spec)).toEqual({ a: 60, b: 60, sum: 120 });
  });
});

describe("facts", () => {
  it("doubles both addends", () => {
    times(DRAWS, () => {
      const { a, b, sum } = drawDouble([1, 10]);
      expect(a).toBe(b);
      expect(sum).toBe(a * 2);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(10);
    });
  });

  it("near doubles carry the double they lean on", () => {
    times(DRAWS, () => {
      const up = drawNearDouble([1, 9], 1);
      expect(up.b).toBe(up.a + 1);
      expect(up.double).toBe(up.a * 2);
      expect(up.sum).toBe(up.double + 1);

      const down = drawNearDouble([2, 10], -1);
      expect(down.b).toBe(down.a - 1);
      expect(down.sum).toBe(down.double - 1);
    });
  });
});

describe("chains", () => {
  it("stays under the total it is capped at", () => {
    times(DRAWS, () => {
      const chain = drawChain(4, { addendRange: [2, 15], totalMax: 40 });
      expect(chain).toHaveLength(4);
      expect(total(chain)).toBeLessThanOrEqual(40);
    });
  });

  it("keeps addends distinct when asked", () => {
    times(DRAWS, () => {
      const chain = drawChain(3, { addendRange: [2, 9], distinct: true });
      expect(new Set(chain).size).toBe(3);
    });
  });

  it("holds exactly one pair that makes ten", () => {
    // The whole question in `pairs` mode. A second hidden ten makes the child's
    // correct answer look wrong.
    times(DRAWS, () => {
      const chain = drawFriendlyChain(4, 10);
      expect(chain).toHaveLength(4);
      expect(friendlyPairCount(chain, 10), chain.join(" + ")).toBe(1);
    });
  });

  it("holds exactly two pairs that make a hundred", () => {
    times(DRAWS, () => {
      const chain = drawFriendlyChain(5, 100, 2);
      expect(friendlyPairCount(chain, 100), chain.join(" + ")).toBe(2);
      expect(chain.every((n) => n % 10 === 0)).toBe(true);
    });
  });
});

describe("estimation", () => {
  it("draws numbers that are worth rounding", () => {
    times(DRAWS, () => {
      const two = drawRoundingPair(2);
      for (const n of [two.a, two.b]) {
        expect(n % 10, `${n} is already round`).not.toBe(0);
        expect(n % 10, `${n} sits exactly halfway`).not.toBe(5);
      }
      const three = drawRoundingPair(3);
      for (const n of [three.a, three.b]) {
        expect(n % 100, `${n} is already round`).not.toBe(0);
        expect(n % 100, `${n} sits exactly halfway`).not.toBe(50);
      }
    });
  });

  it("rounds to the nearer unit", () => {
    expect(roundTo(47, 10)).toBe(50);
    expect(roundTo(43, 10)).toBe(40);
    expect(roundTo(347, 100)).toBe(300);
    expect(roundTo(386, 100)).toBe(400);
  });
});

describe("stories", () => {
  it("states two quantities and withholds the third", () => {
    const join = drawStory("join", { startRange: [5, 5], changeRange: [3, 3] });
    expect(join.values).toEqual([5, 3]);
    expect(join.answer).toBe(8);
  });

  it("asks for the change when the change is unknown", () => {
    times(DRAWS, () => {
      const s = drawStory("change_unknown");
      const [from, result] = s.values;
      expect(result).toBeGreaterThan(from);
      expect(s.answer).toBe(result - from);
    });
  });

  it("asks for the start when the start is unknown", () => {
    times(DRAWS, () => {
      const s = drawStory("start_unknown");
      const [by, result] = s.values;
      expect(s.answer + by).toBe(result);
    });
  });

  it("asks for the larger quantity in a comparison", () => {
    times(DRAWS, () => {
      const s = drawStory("compare");
      const [smaller, by] = s.values;
      expect(s.answer).toBe(smaller + by);
    });
  });

  it("carries the first step's answer as its own question", () => {
    times(DRAWS, () => {
      const s = drawStory("multi_step");
      expect(s.values).toHaveLength(3);
      expect(s.intermediate).toBe(s.values[0] + s.values[1]);
      expect(s.answer).toBe(s.intermediate! + s.values[2]);
    });
  });
});

describe("withoutRepeat", () => {
  it("does not ask the same question twice in a round", () => {
    const seen = new Set<string>();
    const asked = Array.from({ length: 5 }, () =>
      pairKey(withoutRepeat(() => drawPair({ addendRange: [1, 5], sumMax: 10 }), pairKey, seen)),
    );
    expect(new Set(asked).size).toBe(5);
  });

  it("gives up rather than blocking when the space is exhausted", () => {
    // Two possible questions, five asked. A repeat is a dull question; a hang
    // is a dead app, so this must return.
    const seen = new Set<string>();
    const draw = () => drawPair({ aRange: [1, 1], bRange: [1, 2] });
    expect(() => times(5, () => withoutRepeat(draw, pairKey, seen))).not.toThrow();
  });
});

describe("a helper fact stays close enough to help", () => {
  it("keeps the two addends within maxGap", () => {
    times(DRAWS, () => {
      const { a, b } = drawPair({ addendRange: [3, 9], maxGap: 2 });
      expect(Math.abs(a - b), `${a} + ${b}`).toBeLessThanOrEqual(2);
    });
  });

  it("holds both ends at once", () => {
    times(DRAWS, () => {
      const { a, b } = drawPair({ addendRange: [1, 12], minGap: 2, maxGap: 4 });
      const gap = Math.abs(a - b);
      expect(gap).toBeGreaterThanOrEqual(2);
      expect(gap).toBeLessThanOrEqual(4);
    });
  });
});

