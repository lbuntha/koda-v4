import { describe, expect, it } from "vitest";
import { MIN_COLOUR_DISTANCE, POOL, dealRack, drawPalette, rackFor, rng, solvedRack } from "./internal/racks";
import { canPour, isDeadlock, isSolvedRack, legalPours, pour, refuseReason, signature } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { RACK_SPECS } from "./internal/specs";
import { isBottleDone, topRun, type Rack } from "./internal/types";

/**
 * Phase 0 of docs/BOTTLE_SORT_BUILD_PLAN.md.
 *
 * The plan asks for 200 draws per lesson against the generator invariants. The
 * exhaustive solver runs on a sample of those rather than all of them: it is
 * exact and therefore slow, and solvability is already guaranteed by
 * construction — the solver is here to catch a generator that stops honouring
 * that guarantee, which a sample detects just as well as a sweep.
 */
const DRAWS = 200;
const SOLVER_SAMPLE = 12;

const colourCounts = (rack: Rack) => {
  const counts = new Map<number, number>();
  rack.forEach((b) => b.seg.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));
  return counts;
};

describe("rack generation", () => {
  it("deals every lesson's racks from a solved rack, so none can be impossible", () => {
    RACK_SPECS.forEach((spec) => {
      for (let i = 1; i <= DRAWS; i += 1) {
        const { rack } = rackFor(spec, "phase0", i);

        // In bounds: every bottle holds no more than its capacity.
        rack.forEach((b) => expect(b.seg.length, `${spec.id} q${i}`).toBeLessThanOrEqual(b.cap));

        // Colour counts are exact multiples of a full bottle, or the rack could
        // never finish however well it is played.
        const counts = colourCounts(rack);
        expect(counts.size, `${spec.id} q${i} colours`).toBe(spec.colours);
        counts.forEach((n, colour) => {
          const cap = solvedRack(spec)[colour].cap;
          expect(n, `${spec.id} q${i} colour ${colour}`).toBe(cap);
        });
      }
    });
  });

  it("agrees with an exhaustive solver that every rack is finishable", () => {
    RACK_SPECS.forEach((spec) => {
      for (let i = 1; i <= SOLVER_SAMPLE; i += 1) {
        const { rack, scramble } = rackFor(spec, "solver", i);
        const { moves } = minimumPours(rack);
        expect(moves, `${spec.id} q${i} unsolvable`).not.toBeNull();
        // The scramble is an upper bound: undoing it is itself a solution.
        expect(moves!, `${spec.id} q${i} above its own bound`).toBeLessThanOrEqual(scramble);
      }
    });
  });

  it("never deals a rack that is already finished", () => {
    RACK_SPECS.filter((s) => s.scramble > 2).forEach((spec) => {
      for (let i = 1; i <= DRAWS; i += 1) {
        expect(isSolvedRack(rackFor(spec, "unsolved", i).rack), `${spec.id} q${i}`).toBe(false);
      }
    });
  });

  it("never deals a rack with no move to make", () => {
    RACK_SPECS.forEach((spec) => {
      for (let i = 1; i <= DRAWS; i += 1) {
        const { rack } = rackFor(spec, "alive", i);
        expect(legalPours(rack).length, `${spec.id} q${i}`).toBeGreaterThan(0);
      }
    });
  });

  it("reproduces the same rack from the same seed and index", () => {
    RACK_SPECS.forEach((spec) => {
      const a = rackFor(spec, "stable", 4);
      const b = rackFor(spec, "stable", 4);
      expect(signature(b.rack), spec.id).toEqual(signature(a.rack));
      expect(b.hues, spec.id).toEqual(a.hues);
    });
  });

  it("never repeats a rack inside one round", () => {
    // The property that matters is not how large the space is, but that a
    // child is not handed the same puzzle twice in the same sitting. A round is
    // 3 racks teaching and 5 in practice; 5 covers both.
    const ROUND = 5;
    RACK_SPECS.forEach((spec) => {
      for (const seed of ["round-a", "round-b", "round-c"]) {
        const seen = new Set(Array.from({ length: ROUND }, (_, i) => signature(rackFor(spec, seed, i + 1).rack)));
        // A one-pour scramble over three bottles genuinely has only a handful of
        // positions, so it is exempt — and it is the one lesson where seeing the
        // same easy rack twice costs nothing.
        if (spec.scramble <= 2) { expect(seen.size).toBeGreaterThanOrEqual(2); continue; }
        expect(seen.size, `${spec.id} repeated a rack within a round`).toBe(ROUND);
      }
    });
  });

  it("carries the lesson's rules onto the dealt rack", () => {
    const oneWay = RACK_SPECS.find((s) => s.oneWay !== undefined)!;
    expect(rackFor(oneWay, "rules", 1).rack[oneWay.oneWay!].oneWay).toBe(true);

    const locked = RACK_SPECS.find((s) => s.lock)!;
    expect(rackFor(locked, "rules", 1).rack[locked.lock!.tube].lockedBy).toBe(locked.lock!.on);

    const hidden = RACK_SPECS.find((s) => s.hidden)!;
    rackFor(hidden, "rules", 1).rack.forEach((b) => expect(b.shown!).toBeLessThanOrEqual(b.seg.length));
  });
});

describe("the palette", () => {
  it("keeps every pair of dealt colours far enough apart to tell apart", () => {
    for (let i = 0; i < DRAWS; i += 1) {
      const picked = drawPalette(5, rng(`palette-${i}`));
      expect(picked).toHaveLength(5);
      expect(new Set(picked).size).toBe(5);
      picked.forEach((a, x) => picked.slice(x + 1).forEach((b) => {
        const d = Math.hypot(POOL[a][0] - POOL[b][0], POOL[a][1] - POOL[b][1], POOL[a][2] - POOL[b][2]);
        expect(d, `draw ${i}: colours ${a} and ${b}`).toBeGreaterThanOrEqual(MIN_COLOUR_DISTANCE);
      }));
    }
  });

  it("redraws between rounds, so a replay is not the same picture", () => {
    const spec = RACK_SPECS.find((s) => s.id === "four-colours")!;
    const seen = new Set(Array.from({ length: 12 }, (_, i) => dealRack(spec, `round-${i}`).hues.join(",")));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("still supplies a palette when asked for more colours than the spacing allows", () => {
    const picked = drawPalette(POOL.length, rng("crowded"));
    expect(picked).toHaveLength(POOL.length);
    expect(new Set(picked).size).toBe(POOL.length);
  });
});

describe("the rules of a pour", () => {
  const rack = (): Rack => [
    { cap: 4, seg: [0, 0, 1] },
    { cap: 4, seg: [1, 1] },
    { cap: 4, seg: [] },
    { cap: 2, seg: [2, 2] },
  ];

  it("moves the whole top run, capped by the room there is", () => {
    const start: Rack = [{ cap: 4, seg: [0, 1, 1, 1] }, { cap: 4, seg: [0, 0, 1] }];
    // Three ones on top, but the destination has only one slot free.
    expect(topRun(start[0]).n).toBe(3);
    const after = pour(start, 0, 1);
    expect(after[1].seg).toEqual([0, 0, 1, 1]);
    expect(after[0].seg).toEqual([0, 1, 1]);

    // With room, the whole run travels together.
    const roomy: Rack = [{ cap: 4, seg: [0, 1, 1, 1] }, { cap: 4, seg: [1] }];
    expect(pour(roomy, 0, 1)[1].seg).toEqual([1, 1, 1, 1]);
  });

  it("gives a reason for every refusal, and changes nothing", () => {
    const r = rack();
    expect(refuseReason(r, 2, 0)).toBe("That bottle is empty.");
    expect(refuseReason(r, 0, 3)).toBe("That bottle is full.");
    expect(refuseReason(r, 1, 3)).toBe("That bottle is full.");
    expect(refuseReason(r, 0, 0)).toMatch(/different bottle/);
    const mismatch: Rack = [{ cap: 4, seg: [0] }, { cap: 4, seg: [1] }];
    expect(refuseReason(mismatch, 0, 1)).toBe("Those colours do not match.");
    // A refused pour is not a state change.
    expect(pour(mismatch, 0, 1)).toBe(mismatch);
  });

  it("refuses to pour out of a one-way bottle, but lets it receive", () => {
    const r: Rack = [{ cap: 4, seg: [0, 0] }, { cap: 4, seg: [0], oneWay: true }];
    expect(refuseReason(r, 1, 0)).toBe("That bottle only receives.");
    expect(canPour(r, 0, 1)).toBe(true);
  });

  it("keeps a corked bottle shut until the bottle it waits on is finished", () => {
    const corked: Rack = [{ cap: 2, seg: [0, 1] }, { cap: 2, seg: [], lockedBy: 0 }];
    expect(refuseReason(corked, 0, 1)).toBe("That bottle is corked.");
    const open: Rack = [{ cap: 2, seg: [0, 0] }, { cap: 2, seg: [], lockedBy: 0 }];
    expect(refuseReason(open, 0, 1)).toBeNull();
  });

  it("never creates liquid, whatever the pour", () => {
    // The rule that made a linked bottle fill a twin broke this, and with it
    // every rack's ability to be finished.
    const before: Rack = [{ cap: 4, seg: [0, 0, 1] }, { cap: 4, seg: [1] }, { cap: 4, seg: [] }];
    const count = (r: Rack) => r.flatMap((b) => b.seg).sort().join(",");
    expect(count(pour(before, 0, 1))).toBe(count(before));
    expect(count(pour(before, 0, 2))).toBe(count(before));
  });

  it("calls a bottle done when it is empty or full of one colour", () => {
    expect(isBottleDone({ cap: 4, seg: [] })).toBe(true);
    expect(isBottleDone({ cap: 4, seg: [1, 1, 1, 1] })).toBe(true);
    expect(isBottleDone({ cap: 4, seg: [1, 1, 1] })).toBe(false);
    expect(isBottleDone({ cap: 4, seg: [1, 1, 1, 2] })).toBe(false);
  });

  it("reports a deadlock only when the solver agrees there is nothing to do", () => {
    const stuck: Rack = [{ cap: 2, seg: [0, 1] }, { cap: 2, seg: [1, 0] }];
    expect(isDeadlock(stuck)).toBe(true);
    expect(minimumPours(stuck).moves).toBeNull();

    const fine: Rack = [{ cap: 2, seg: [0, 1] }, { cap: 2, seg: [1, 0] }, { cap: 2, seg: [] }];
    expect(isDeadlock(fine)).toBe(false);
    expect(minimumPours(fine).moves).not.toBeNull();
  });
});
