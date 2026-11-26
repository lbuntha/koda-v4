import { describe, expect, it } from "vitest";
import { TRACK, buildTrack, countOf, isProper, properRow } from "./track";

const N = 500;

describe("blocks: lay", () => {
  it("lengths fit the track and the answer is the length", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildTrack({}, "lay", new Set());
      expect(q.length).toBeGreaterThanOrEqual(2);
      expect(q.length).toBeLessThan(TRACK);
      expect(q.answer).toBe(String(q.length));
    }
  });
});

describe("blocks: spot the mistake", () => {
  it("exactly one row is proper, and it is the answer", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildTrack({}, "spot", new Set());
      const proper = q.rows!.map(isProper);
      expect(proper.filter(Boolean)).toHaveLength(1);
      expect(q.answer).toBe(String(proper.indexOf(true)));
      expect(countOf(q.rows![Number(q.answer)])).toBe(q.length);
    }
  });

  it("a gap undercounts and an overlap overcounts, and both stay on the track", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildTrack({}, "spot", new Set());
      const bad = q.rows![1 - Number(q.answer)];
      if (q.flaw === "gap") {
        expect(countOf(bad)).toBe(q.length - 1);
        // There really is a gap: some block starts after the previous one ends.
        expect(bad.some((b, j) => j > 0 && b.at > bad[j - 1].at + bad[j - 1].len + 1e-9)).toBe(true);
      } else {
        expect(countOf(bad)).toBe(q.length + 1);
        expect(bad.some((b, j) => j > 0 && b.at < bad[j - 1].at + bad[j - 1].len - 1e-9)).toBe(true);
        // The squeezed row still ends where the thing ends.
        const last = bad[bad.length - 1];
        expect(last.at + last.len).toBeCloseTo(q.length, 9);
      }
      for (const row of q.rows!) for (const b of row) expect(b.at + b.len).toBeLessThanOrEqual(TRACK);
    }
  });

  it("properRow is end to end from zero", () => {
    expect(properRow(3)).toEqual([{ at: 0, len: 1 }, { at: 1, len: 1 }, { at: 2, len: 1 }]);
  });
});

describe("blocks: big unit, small unit", () => {
  it("the smaller unit always needs more", () => {
    for (let i = 0; i < N; i += 1) {
      const q = buildTrack({}, "unit_size", new Set());
      expect([2, 3]).toContain(q.rod);
      expect(q.length % q.rod!).toBe(0);
      expect(q.length).toBeLessThanOrEqual(TRACK);
      const cubes = q.length;
      const rods = q.length / q.rod!;
      expect(cubes).toBeGreaterThan(rods);
      expect(q.answer).toBe(q.ask === "more" ? "cube" : "rod");
    }
  });
});
