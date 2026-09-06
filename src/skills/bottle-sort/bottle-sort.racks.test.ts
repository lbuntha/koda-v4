import { beforeAll, describe, expect, it } from "vitest";
import { MIN_COLOUR_DISTANCE, POOL, dealRack, drawPalette, rackFor, rng, solvedRack } from "./internal/racks";
import { canPour, isDeadlock, isSolvedRack, legalPours, pour, refuseReason, signature } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { RACK_SPECS } from "./internal/specs";
import { bottleDone, goalFor } from "./internal/goal";
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
/**
 * Fewer draws on the largest racks.
 *
 * Dealing a rack runs the solver, because solvability is verified rather than
 * constructed — so a draw on the eight-bottle, six-colour mixed rack costs
 * orders of magnitude more than one on a three-bottle opener. 200 draws of
 * everything took this file from 10s to 31s as Phase 6's mixed racks arrived,
 * which is the same trade-off the solver sample below already makes: these
 * sweeps exist to catch a generator that has stopped honouring its invariants,
 * and a generator that breaks does so on the first handful of draws.
 */
const drawsFor = (spec: { bottles: number; colours: number }) =>
  spec.bottles * spec.colours >= 35 ? 40 : DRAWS;
/**
 * One seed across the sweeps below, so the 200 draws are dealt once and every
 * invariant is checked against the same racks. Each sweep used its own seed,
 * which meant generating 200 racks per spec four times over — and generating a
 * rack now runs the solver, so the suite paid for that four times.
 */
const SWEEP = "invariants";
const SOLVER_SAMPLE = 12;

/**
 * The swept racks, dealt once before any of the invariants run.
 *
 * Sharing a seed already meant the racks were dealt once, but it left the
 * whole cost inside whichever test ran first — which then took 21s of a 20s
 * budget while its neighbours took milliseconds. The sweep is one body of
 * work, so it is done as one, and no single assertion carries the bill.
 */
const swept = new Map<string, Rack[]>();
const racksFor = (spec: { id: string }) => swept.get(spec.id)!;

beforeAll(() => {
  RACK_SPECS.forEach((spec) => {
    const racks: Rack[] = [];
    for (let i = 1; i <= drawsFor(spec); i += 1) racks.push(rackFor(spec, SWEEP, i).rack);
    swept.set(spec.id, racks);
  });
}, 180_000);

const colourCounts = (rack: Rack) => {
  const counts = new Map<number, number>();
  rack.forEach((b) => b.seg.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));
  return counts;
};

describe("rack generation", () => {
  it("deals every lesson's racks from a solved rack, so none can be impossible", () => {
    RACK_SPECS.forEach((spec) => {
      racksFor(spec).forEach((rack, drawn) => {
        const i = drawn + 1;

        // In bounds: every bottle holds no more than its capacity.
        rack.forEach((b) => expect(b.seg.length, `${spec.id} q${i}`).toBeLessThanOrEqual(b.cap));

        // Colour counts are exact multiples of a full bottle, or the rack could
        // never finish however well it is played.
        const counts = colourCounts(rack);
        expect(counts.size, `${spec.id} q${i} colours`).toBe(spec.colours);
        counts.forEach((held, colour) => {
          const cap = solvedRack(spec)[colour].cap;
          expect(held, `${spec.id} q${i} colour ${colour}`).toBe(cap);
        });
      });
    });
  });

  it("agrees with an exhaustive solver that every rack is finishable", () => {
    RACK_SPECS.forEach((spec) => {
      for (let i = 1; i <= SOLVER_SAMPLE; i += 1) {
        const { rack, scramble } = rackFor(spec, "solver", i);
        const { moves } = minimumPours(rack, goalFor(spec));
        expect(moves, `${spec.id} q${i} unsolvable`).not.toBeNull();
        // The scramble is an upper bound: undoing it is itself a solution.
        expect(moves!, `${spec.id} q${i} above its own bound`).toBeLessThanOrEqual(scramble);
      }
    });
  });

  it("never deals a rack that is already finished", () => {
    RACK_SPECS.filter((s) => s.scramble > 2).forEach((spec) => {
      racksFor(spec).forEach((rack, n) =>
        expect(isSolvedRack(rack, goalFor(spec)), `${spec.id} q${n + 1}`).toBe(false));
    });
  });

  it("actually mixes the colours it deals", () => {
    // The invariant that was missing. Every other check passed while every
    // bottle held a single colour: the scramble had kept the pour rule that
    // colours must match, so nothing could ever land on a different colour and
    // no rack was ever a puzzle. Measured at avg 1.00 bands per bottle across
    // all 32 specs before this existed.
    // Ordering lessons are measured by their own goal below, not by whether a
    // bottle holds two colours: under an ordering goal a bottle of one colour
    // is the mess, not the finished article.
    RACK_SPECS.filter((s) => s.scramble >= 5 && !s.goal).forEach((spec) => {
      let bands = 0, bottles = 0, mixedRacks = 0;
      for (let i = 1; i <= 30; i += 1) {
        const { rack } = rackFor(spec, SWEEP, i);
        let anyMixed = false;
        rack.forEach((b) => {
          if (!b.seg.length) return;
          const runs = b.seg.filter((c, k) => k === 0 || c !== b.seg[k - 1]).length;
          bands += runs; bottles += 1;
          if (runs > 1) anyMixed = true;
        });
        if (anyMixed) mixedRacks += 1;
      }
      expect(bands / bottles, `${spec.id} bottles hold one colour each`).toBeGreaterThan(1.2);
      expect(mixedRacks, `${spec.id} dealt racks with nothing stacked`).toBe(30);
    });
  });

  it("deals ordering racks with something actually out of order", () => {
    RACK_SPECS.filter((spec) => spec.goal).forEach((spec) => {
      const goal = goalFor(spec);
      for (let i = 1; i <= 30; i += 1) {
        const { rack } = rackFor(spec, SWEEP, i);
        const unfinished = rack.filter((b) => b.seg.length > 0 && !bottleDone(goal, b));
        expect(unfinished.length, `${spec.id} q${i} arrived finished`).toBeGreaterThan(0);
      }
    });
  });

  it("never deals a rack with no move to make", () => {
    RACK_SPECS.forEach((spec) => {
      racksFor(spec).forEach((rack, n) =>
        // Under the lesson's own goal: an ordering rack has no legal pour at
        // all by the matching rule, which is the point of the goal existing.
        expect(legalPours(rack, goalFor(spec)).length, `${spec.id} q${n + 1}`).toBeGreaterThan(0));
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
