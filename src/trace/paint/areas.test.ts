import { describe, expect, it } from "vitest";
import type { PaintStep, Stroke, TraceItem } from "../geometry/types";
import { GRID, areaAt, fadingLines, lineColours, lineOf, wallOf, blankPaint, brush, isComplete, labelAreas, maySayDone, owners, scorePainting, seamSources, stepState } from "./areas";
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

  it("a solid shape in front hides the line behind it, so its inside is one part", () => {
    // A wide body, and a wheel across its bottom edge.
    const body = square("body", 200, 300, 800, 600);
    const wheel = { ...square("wheel", 300, 500, 450, 700), order: 2 };
    const open = labelAreas({ strokes: [body, wheel] });
    // Without a fill the body's edge cuts the wheel in two.
    expect(areaAt(open, { x: 375, y: 550 })).not.toBe(areaAt(open, { x: 375, y: 650 }));
    const solid = labelAreas({ strokes: [body, { ...wheel, fill: "paper" }] });
    expect(areaAt(solid, { x: 375, y: 550 })).toBe(areaAt(solid, { x: 375, y: 650 }));
    // Behind the body (the body in front), the wheel's top half belongs to the body instead.
    const behind = labelAreas({ strokes: [{ ...body, fill: "paper", layer: 5 }, { ...wheel, fill: "paper" }] });
    expect(areaAt(behind, { x: 375, y: 550 })).toBe(areaAt(behind, { x: 600, y: 450 }));
  });

  it("a stroke designed thin still walls its parts off, with a thinner wall than its line", () => {
    const thin = { ...square("a", 200, 200, 800, 800), width: 6 };
    const areas = labelAreas({ strokes: [thin] });
    expect(areaAt(areas, { x: 500, y: 500 })).not.toBe(areaAt(areas, { x: 50, y: 50 }));
    expect(wallOf(thin)).toBeLessThan(lineOf(thin));
    // A trace band of the usual width keeps the usual colouring line.
    expect(lineOf({ width: 60 })).toBe(18);
  });

  it("fades only the lines between two coloured parts", () => {
    // Two boxes side by side, sharing the line at x = 500; a mouth line inside the left one.
    const left = { ...square("l", 200, 300, 500, 700) };
    const right = { ...square("r", 500, 300, 800, 700), order: 2 };
    const mouth: Stroke = { ...square("m", 0, 0, 0, 0), order: 3, closed: false, nodes: [{ x: 280, y: 600, type: "corner" }, { x: 420, y: 600, type: "corner" }] };
    const areas = labelAreas({ strokes: [left, right, mouth] });
    const paint = blankPaint();
    const at = (x: number, y: number) => y * GRID + x;
    // Colour the left box only.
    fill(paint, areas, areaAt(areas, { x: 350, y: 400 }), "red");
    let gone = fadingLines(areas, paint);
    expect(gone[at(500, 500)]).toBe(0); // shared line: the right box is still white
    expect(gone[at(200, 500)]).toBe(0); // the left box against the page
    // Colour the right box too: now the shared line can go, the rest stays.
    fill(paint, areas, areaAt(areas, { x: 650, y: 500 }), "blue");
    gone = fadingLines(areas, paint);
    expect(gone[at(500, 500)]).toBe(1);
    expect(gone[at(800, 500)]).toBe(0); // the right box against the page
    expect(gone[at(350, 600)]).toBe(0); // the mouth: the same part on both sides
  });

  it("colours a line from the paint beside it, or from paint put on the line itself", () => {
    const areas = labelAreas(item);
    const paint = blankPaint();
    const at = (x: number, y: number) => y * GRID + x;
    fill(paint, areas, areaAt(areas, { x: 500, y: 500 }), "red");
    let lines = lineColours(areas, paint);
    // The square's edge takes the red inside it; far outside, nothing.
    expect(lines.crayon[at(200, 500)]).toBe(crayonIndex("red"));
    expect(lines.own[at(200, 500)]).toBe(0);
    expect(lines.crayon[at(50, 50)]).toBe(0);
    // The brush on the line itself (lines take paint in this mode) gives the line its own colour.
    brush(paint, areas, { x: 200, y: 400 }, { x: 200, y: 600 }, 6, crayonIndex("blue"), undefined, true);
    lines = lineColours(areas, paint);
    expect(lines.crayon[at(200, 500)]).toBe(crayonIndex("blue"));
    expect(lines.own[at(200, 500)]).toBe(1);
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
