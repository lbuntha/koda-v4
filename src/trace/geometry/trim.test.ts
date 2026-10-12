import { describe, expect, it } from "vitest";
import { strokePolyline } from "./bezier";
import { leavesPage, pageRuns, trimToPage } from "./trim";
import type { Stroke } from "./types";

const stroke = (id: string, pts: [number, number][], extra: Partial<Stroke> = {}): Stroke => ({
  id,
  order: 1,
  shape: "free",
  nodes: pts.map(([x, y]) => ({ x, y, type: "corner" as const })),
  closed: false,
  join: "lift",
  width: 60,
  checkpoints: [],
  ...extra,
});

let n = 0;
const newId = () => `new-${++n}`;
const inside = (s: Stroke) => strokePolyline(s).every((p) => p.x >= -0.01 && p.x <= 1000.01 && p.y >= -0.01 && p.y <= 1000.01);

describe("trim to the page", () => {
  it("keeps a stroke on the page as it is, and drops one off it", () => {
    const on = stroke("on", [[100, 100], [400, 400]]);
    const off = stroke("off", [[-300, -300], [-100, -50]]);
    expect(trimToPage([on, off], newId)).toEqual([on]);
  });

  it("cuts a line where it leaves the page", () => {
    const [cut] = trimToPage([stroke("a", [[500, 500], [500, -200]])], newId);
    expect(cut.id).toBe("a");
    expect(inside(cut)).toBe(true);
    const ys = strokePolyline(cut).map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(0, 0);
    expect(Math.max(...ys)).toBeCloseTo(500, 0);
  });

  it("a loop over the edge becomes one open piece, no longer solid", () => {
    // A box half above the top edge: the part on the page is one U-shaped run.
    const box = stroke("box", [[300, -200], [300, 300], [700, 300], [700, -200]], { closed: true, fill: "paper" });
    expect(leavesPage(box)).toBe(true);
    const pieces = trimToPage([box], newId);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].closed).toBe(false);
    expect(pieces[0].fill).toBeUndefined();
    expect(inside(pieces[0])).toBe(true);
  });

  it("a line that leaves and comes back becomes two strokes, the second lifting the pen", () => {
    const zig = stroke("z", [[100, 500], [500, -300], [900, 500]], { join: "continue" });
    const pieces = trimToPage([zig], newId);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toMatchObject({ id: "z", join: "continue" });
    expect(pieces[1].join).toBe("lift");
    expect(pieces.every(inside)).toBe(true);
  });

  it("joins a loop's runs across its start", () => {
    // Starts on the page, wanders off the right edge, comes back: one run.
    const runs = pageRuns([{ x: 500, y: 500 }, { x: 1200, y: 500 }, { x: 1200, y: 600 }, { x: 500, y: 600 }, { x: 500, y: 500 }], true);
    expect(runs).toHaveLength(1);
  });
});
