import { describe, expect, it } from "vitest";
import { strokePolyline } from "./bezier";
import { cutStrokeAt, splitStrokeAt } from "./edit";
import { polylineLength } from "./polyline";
import type { Stroke } from "./types";
import { makeStroke } from "../fixtures/items";

// An L: down, then right — three nodes, so it can be cut at the corner.
const ell = (): Stroke => ({
  ...makeStroke("s1", 1, [[200, 200], [200, 600], [600, 600]]),
  instruction: "Down, then across",
  checkpoints: [{ t: 0.25, pinned: true }, { t: 0.75, pinned: true }, { t: 0.5, pinned: false }],
});
const length = (s: Stroke) => polylineLength(strokePolyline(s, 0.25));

describe("splitting a stroke", () => {
  it("cuts at a middle node into two strokes that draw the same path", () => {
    const s = ell();
    const [a, b] = splitStrokeAt(s, 1, "s2")!;
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual([[200, 200], [200, 600]]);
    expect(b!.nodes.map((n) => [n.x, n.y])).toEqual([[200, 600], [600, 600]]);
    expect(b).toMatchObject({ id: "s2", join: "lift", instruction: undefined });
    expect(a.instruction).toBe("Down, then across");
    expect(length(a) + length(b!)).toBeCloseTo(length(s), 0);
  });

  it("gives each half the pinned checkpoints that were on it, re-measured", () => {
    const [a, b] = splitStrokeAt(ell(), 1, "s2")!;
    expect(a.checkpoints).toEqual([{ t: 0.5, pinned: true }]);
    expect(b!.checkpoints).toEqual([{ t: 0.5, pinned: true }]);
  });

  it("refuses an end node or a dot, and opens a loop rather than halving it", () => {
    expect(splitStrokeAt(ell(), 0, "x")).toBeNull();
    expect(splitStrokeAt(ell(), 2, "x")).toBeNull();
    expect(splitStrokeAt({ ...ell(), shape: "dot" }, 1, "x")).toBeNull();
    const loop: Stroke = { ...ell(), closed: true, shape: "loop" };
    const opened = splitStrokeAt(loop, 1, "x")!;
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ closed: false, shape: "curve" });
    expect(opened[0].nodes.map((n) => [n.x, n.y])).toEqual([[200, 600], [600, 600], [200, 200], [200, 600]]);
  });

  it("cuts anywhere along a segment by adding a node there first", () => {
    const [a, b] = cutStrokeAt(ell(), 0, 0.5, "s2")!;
    expect(a.nodes.at(-1)).toMatchObject({ x: 200, y: 400 });
    expect(b!.nodes[0]).toMatchObject({ x: 200, y: 400 });
    expect(b!.nodes).toHaveLength(3);
    // Right at a node, it cuts at that node rather than leaving a sliver.
    expect(cutStrokeAt(ell(), 0, 0.999, "s2")![0].nodes).toHaveLength(2);
  });
});
