import { describe, expect, it } from "vitest";
import type { PaintStep, TraceItem } from "../geometry/types";
import { areaAt, labelAreas } from "./areas";
import { CELL, GRID } from "./grid";
import { fillLeftovers, leftovers } from "./leftovers";
import { packMask } from "./picture";

/** A box split down the middle, with a thin sliver cut off just right of the split. */
function page() {
  const m = new Uint8Array(GRID * GRID);
  const wall = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * GRID + x] = 1;
  };
  wall(100, 400, 100, 101);
  wall(100, 400, 399, 400);
  wall(100, 101, 100, 400);
  wall(399, 400, 100, 400);
  wall(250, 251, 100, 400); // the split
  wall(256, 257, 200, 260); // the sliver's right side
  wall(250, 257, 200, 201); // its top
  wall(250, 257, 259, 260); // its bottom
  return { strokes: [], paint: { steps: [], picture: { lines: "", walls: packMask(m), strength: 200 } } } as Pick<TraceItem, "strokes" | "paint">;
}

const at = (cx: number, cy: number) => ({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL });
const step = (id: string, cx: number): PaintStep => ({ id, color: "red", seeds: [at(cx, 300)] });

describe("leftovers", () => {
  it("finds the sliver, and gives it to a step when coloured parts surround it", () => {
    const areas = labelAreas(page());
    const sliver = areaAt(areas, at(253, 230));
    const steps = [step("left", 170), step("right", 330)];
    expect(leftovers(areas, steps)).toContain(sliver);
    const { steps: filled, placed } = fillLeftovers(areas, steps);
    expect(placed).toBe(1);
    expect(filled.flatMap((s) => s.seeds).some((p) => areaAt(areas, p) === sliver)).toBe(true);
  });

  it("leaves a sliver white when it mostly borders a white part", () => {
    const areas = labelAreas(page());
    const { placed } = fillLeftovers(areas, [step("left", 170)]);
    expect(placed).toBe(0);
  });
});
