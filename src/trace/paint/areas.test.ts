import { describe, expect, it } from "vitest";
import type { PaintStep, Stroke, TraceItem } from "../geometry/types";
import { GRID, areaAt, blankPaint, brush, isComplete, labelAreas, maySayDone, owners, scorePainting, seamSources, stepState } from "./areas";
import { crayonIndex } from "./palette";

const square = (id: string, x0: number, y0: number, x1: number, y1: number): Stroke => ({
  id,
  order: 1,
  shape: "free",
  nodes: [
    { x: x0, y: y0, type: "corner" },
    { x: x1, y: y0, type: "corner" },
    { x: x1, y: y1, type: "corner" },
    { x: x0, y: y1, type: "corner" },
  ],
  closed: true,
  join: "lift",
  width: 60,
  checkpoints: [],
});

const item = { strokes: [square("a", 200, 200, 800, 800)] } as Pick<TraceItem, "strokes">;
const inside: PaintStep = { id: "in", color: "red", seeds: [{ x: 500, y: 500 }] };

/** Paint the whole of an area, as a careful child would. */
function fill(paint: Uint8Array, areas: ReturnType<typeof labelAreas>, label: number, crayon: string) {
  for (let i = 0; i < paint.length; i++) if (areas.labels[i] === label) paint[i] = crayonIndex(crayon);
}

describe("paint areas", () => {
  it("splits a closed square into inside and outside", () => {
    const areas = labelAreas(item);
    expect(areas.sizes).toHaveLength(2);
    expect(areaAt(areas, { x: 500, y: 500 })).not.toBe(areaAt(areas, { x: 50, y: 50 }));
  });

  it("finds the nearest area for a seed dropped on a line", () => {
    const areas = labelAreas(item);
    expect(areaAt(areas, { x: 200, y: 500 })).toBeGreaterThanOrEqual(0);
  });

  it("gives an area to the first step that claims it", () => {
    const areas = labelAreas(item);
    const own = owners(areas, [inside, { ...inside, id: "again", color: "blue" }]);
    expect(own[areaAt(areas, { x: 500, y: 500 })]).toBe(0);
    expect(own[areaAt(areas, { x: 50, y: 50 })]).toBe(-1);
  });

  it("keeps a brush inside the allowed areas", () => {
    const areas = labelAreas(item);
    const paint = blankPaint();
    const inner = areaAt(areas, { x: 500, y: 500 });
    brush(paint, areas, { x: 100, y: 500 }, { x: 900, y: 500 }, 40, crayonIndex("red"), new Set([inner]));
    const outsideCell = Math.floor(500 / (1000 / GRID)) * GRID + Math.floor(100 / (1000 / GRID));
    expect(paint[outsideCell]).toBe(0);
    expect(stepState(paint, areas, inside).cover).toBeGreaterThan(0);
  });

  it("scores a perfect painting 100 and three stars", () => {
    const areas = labelAreas(item);
    const paint = blankPaint();
    fill(paint, areas, areaAt(areas, { x: 500, y: 500 }), "red");
    const s = scorePainting(paint, areas, [inside]);
    expect(s.accuracy).toBe(100);
    expect(s.stars).toBe(3);
    expect(stepState(paint, areas, inside).cover).toBe(1);
  });

  it("marks down the wrong colour, never an extra part", () => {
    const areas = labelAreas(item);
    const wrong = blankPaint();
    fill(wrong, areas, areaAt(areas, { x: 500, y: 500 }), "blue");
    const w = scorePainting(wrong, areas, [inside]);
    expect(w.accuracy).toBe(0);
    expect(w.colors).toBe(0);
    expect(stepState(wrong, areas, inside).wrongCrayon).toBe(crayonIndex("blue"));

    // A part no step asks for (the outside here) is the child's to colour: it is not marked down.
    const extra = blankPaint();
    fill(extra, areas, areaAt(areas, { x: 500, y: 500 }), "red");
    fill(extra, areas, areaAt(areas, { x: 50, y: 50 }), "green");
    expect(scorePainting(extra, areas, [inside]).accuracy).toBe(100);
  });

  it("scores an untouched page zero stars", () => {
    const areas = labelAreas(item);
    expect(scorePainting(blankPaint(), areas, [inside]).stars).toBe(0);
  });

  it("shows each side of a line in its own side's colour, never across the border", () => {
    const areas = labelAreas(item);
    const src = seamSources(areas);
    const cell = (x: number, y: number) => Math.floor(y / (1000 / GRID)) * GRID + Math.floor(x / (1000 / GRID));
    const inner = areaAt(areas, { x: 500, y: 500 });
    // The square's left line is at x = 200 (walls 193–207): just inside takes the inside, just outside the outside.
    expect(areas.labels[src[cell(205, 500)]]).toBe(inner);
    expect(areas.labels[src[cell(195, 500)]]).not.toBe(inner);
  });

  it("in the child's own colours, any colour completes and scores", () => {
    const areas = labelAreas(item);
    const paint = blankPaint();
    fill(paint, areas, areaAt(areas, { x: 500, y: 500 }), "blue");
    expect(stepState(paint, areas, inside).cover).toBe(0);
    expect(stepState(paint, areas, inside, true).cover).toBe(1);
    const s = scorePainting(paint, areas, [inside], true);
    expect(s.accuracy).toBe(100);
    expect(s.ownColours).toBe(true);
  });

  it("a step is not complete while one of its parts is left white, however big the rest", () => {
    // A big dress and a small sleeve, both pink — the screenshot that found this.
    const two = { strokes: [square("dress", 100, 100, 700, 700), square("sleeve", 760, 100, 880, 220)] } as Pick<TraceItem, "strokes">;
    const areas = labelAreas(two);
    const pink: PaintStep = { id: "pink", color: "pink", seeds: [{ x: 400, y: 400 }, { x: 820, y: 160 }] };
    const dress = areaAt(areas, { x: 400, y: 400 });
    const sleeve = areaAt(areas, { x: 820, y: 160 });
    const paint = blankPaint();
    fill(paint, areas, dress, "pink");
    const onlyDress = stepState(paint, areas, pink);
    expect(onlyDress.cover).toBeGreaterThan(0.9);
    expect(onlyDress.weakest).toBe(0);
    expect(isComplete(onlyDress, 0.8)).toBe(false);
    expect(maySayDone(onlyDress)).toBe(false);
    // Half of the sleeve: Done may finish it now; the whole sleeve completes it.
    for (let i = 0; i < paint.length; i++) if (areas.labels[i] === sleeve && i % GRID < (760 + 820) / (1000 / GRID)) paint[i] = crayonIndex("pink");
    expect(maySayDone(stepState(paint, areas, pink))).toBe(true);
    fill(paint, areas, sleeve, "pink");
    expect(isComplete(stepState(paint, areas, pink), 0.8)).toBe(true);
  });
});
