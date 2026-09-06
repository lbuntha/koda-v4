import { describe, expect, it } from "vitest";
import { buildPrediction } from "./internal/predict";
import { pour, signature } from "./internal/pour";
import { specFor } from "./internal/specs";
import type { Rack } from "./internal/types";

/**
 * Phase 4 of docs/BOTTLE_SORT_BUILD_PLAN.md.
 *
 * A prediction question is only worth asking if the wrong answers are ones a
 * child might actually give. These tests are mostly about the distractors, for
 * that reason: four racks with three obvious impossibilities is a
 * spot-the-odd-one-out, and measures nothing about predicting a pour.
 */
const DRAWS = 60;
const one = specFor("guess-the-result")!;
const two = specFor("guess-two-ahead")!;

describe("predicting a pour", () => {
  it("always offers four distinct racks, exactly one of them right", () => {
    [one, two].forEach((spec) => {
      const steps = spec.id === "guess-two-ahead" ? 2 : 1;
      for (let i = 1; i <= DRAWS; i += 1) {
        const p = buildPrediction(spec, "phase4", i, steps as 1 | 2);
        expect(p.choices, `${spec.id} q${i}`).toHaveLength(4);
        expect(new Set(p.choices.map(signature)).size, `${spec.id} q${i} has a repeat`).toBe(4);
        expect(p.answer, `${spec.id} q${i} answer index`).toBeGreaterThanOrEqual(0);
        expect(p.answer).toBeLessThan(4);
      }
    });
  });

  it("marks the rack the rules actually produce", () => {
    for (let i = 1; i <= DRAWS; i += 1) {
      const p = buildPrediction(one, "phase4", i, 1);
      const expected = p.moves.reduce((r: Rack, m) => pour(r, m.from, m.to), p.start);
      expect(signature(p.choices[p.answer]), `q${i}`).toBe(signature(expected));
    }
  });

  it("asks about two pours in the two-step lesson, and the second is legal after the first", () => {
    for (let i = 1; i <= DRAWS; i += 1) {
      const p = buildPrediction(two, "phase4", i, 2);
      expect(p.moves.length, `q${i}`).toBe(2);
      const after = pour(p.start, p.moves[0].from, p.moves[0].to);
      // The second pour has to still be possible, or the question is nonsense.
      expect(signature(pour(after, p.moves[1].from, p.moves[1].to)), `q${i} second pour did nothing`)
        .not.toBe(signature(after));
    }
  });

  it("never offers the rack unchanged as the right answer", () => {
    [one, two].forEach((spec) => {
      const steps = spec.id === "guess-two-ahead" ? 2 : 1;
      for (let i = 1; i <= DRAWS; i += 1) {
        const p = buildPrediction(spec, "phase4", i, steps as 1 | 2);
        expect(signature(p.choices[p.answer]), `${spec.id} q${i}`).not.toBe(signature(p.start));
      }
    });
  });

  it("conserves the liquid in every candidate, right or wrong", () => {
    // A distractor that invents or loses a segment is not a mistake a child
    // could make; it is a rack that could not exist, and it gives the answer
    // away by elimination.
    const count = (r: Rack) => r.flatMap((b) => b.seg).sort((a, b) => a - b).join(",");
    [one, two].forEach((spec) => {
      const steps = spec.id === "guess-two-ahead" ? 2 : 1;
      for (let i = 1; i <= DRAWS; i += 1) {
        const p = buildPrediction(spec, "phase4", i, steps as 1 | 2);
        p.choices.forEach((choice, k) =>
          expect(count(choice), `${spec.id} q${i} choice ${k} changed the liquid`).toBe(count(p.start)));
      }
    });
  });

  it("keeps every candidate inside the bottles' capacities", () => {
    [one, two].forEach((spec) => {
      const steps = spec.id === "guess-two-ahead" ? 2 : 1;
      for (let i = 1; i <= DRAWS; i += 1) {
        buildPrediction(spec, "phase4", i, steps as 1 | 2).choices.forEach((choice, k) =>
          choice.forEach((b, j) =>
            expect(b.seg.length, `${spec.id} q${i} choice ${k} bottle ${j} overflows`).toBeLessThanOrEqual(b.cap)));
      }
    });
  });

  it("moves the answer around, so the position is not the answer", () => {
    // The skill has been here before: "Stop the right answer always being the
    // third button".
    const seen = new Set<number>();
    for (let i = 1; i <= DRAWS; i += 1) seen.add(buildPrediction(one, "phase4", i, 1).answer);
    expect(seen.size, "the answer sits in too few positions").toBe(4);
  });

  it("gives the same question for the same seed and index", () => {
    const a = buildPrediction(one, "stable", 3, 1);
    const b = buildPrediction(one, "stable", 3, 1);
    expect(b.answer).toBe(a.answer);
    expect(b.choices.map(signature)).toEqual(a.choices.map(signature));
    expect(b.moves).toEqual(a.moves);
  });
});
