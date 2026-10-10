import { describe, expect, it } from "vitest";
import type { TraceItem } from "../geometry/types";
import { areaAt, labelAreas } from "./areas";
import { GRID } from "./grid";
import { PACKED_LENGTH, SIDE, applyErase, packRuns, areaColours, closeGaps, crayonFor, findLines, packMask, partCount, smoothLines, stepsFromColours, unpackMask } from "./picture";

/** A white page with a black square outline, filled orange inside — a coloured example. */
function page(fill: [number, number, number] = [242, 140, 40]) {
  const px = new Uint8ClampedArray(SIDE * SIDE * 4).fill(255);
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const p = (y * SIDE + x) * 4;
      const onEdge = x >= 300 && x <= 700 && y >= 300 && y <= 700 && (x < 306 || x > 694 || y < 306 || y > 694);
      const inside = x > 306 && x < 694 && y > 306 && y < 694;
      const c = onEdge ? [20, 20, 20] : inside ? fill : [255, 255, 255];
      px[p] = c[0];
      px[p + 1] = c[1];
      px[p + 2] = c[2];
    }
  }
  return px;
}

const itemOf = (walls: string) => ({ strokes: [], paint: { steps: [], picture: { lines: "", walls, strength: 150 } } }) as Pick<TraceItem, "strokes" | "paint">;

describe("colouring from a picture", () => {
  it("packs a line mask and gets it back", () => {
    const mask = new Uint8Array(GRID * GRID);
    [0, 7, 8, 12345, GRID * GRID - 1].forEach((i) => (mask[i] = 1));
    const packed = packMask(mask);
    expect(packed).toHaveLength(PACKED_LENGTH);
    expect(unpackMask(packed)).toEqual(mask);
  });

  it("keeps lines compactly as runs, and reads them back exactly", () => {
    const { mask } = findLines(page(), 150);
    const runs = packRuns(mask);
    expect(runs.startsWith("rle1:")).toBe(true);
    expect(runs.length).toBeLessThan(PACKED_LENGTH / 10);
    expect(unpackMask(runs)).toEqual(mask);
  });

  it("reads a picture made on the old 500-cell grid, scaled up", () => {
    const old = new Uint8Array(500 * 500);
    old[100 * 500 + 200] = 1; // the old cell covering units 400–401, 200–201
    const mask = unpackMask(packMask(old));
    expect(mask).toHaveLength(GRID * GRID);
    expect([mask[200 * GRID + 400], mask[201 * GRID + 401], mask[200 * GRID + 402]]).toEqual([1, 1, 0]);
  });

  it("finds the dark lines and splits the page into inside and outside", () => {
    const { mask } = findLines(page(), 150);
    const areas = labelAreas(itemOf(packMask(mask)));
    expect(partCount(areas)).toBe(2);
    expect(areaAt(areas, { x: 500, y: 500 })).not.toBe(areaAt(areas, { x: 50, y: 50 }));
  });

  it("does not take a light colour for a line", () => {
    const { mask } = findLines(page([247, 208, 56]), 150);
    // Only the outline (4 sides × ~400 × 6 cells); none of the yellow inside it.
    expect(mask.reduce((a, v) => a + v, 0)).toBeLessThan(GRID * 12);
  });

  it("names colours by the nearest crayon, and paper as none", () => {
    expect(crayonFor(240, 140, 45)).toBe("orange");
    expect(crayonFor(230, 60, 60)).toBe("red");
    expect(crayonFor(250, 250, 248)).toBeNull();
  });

  it("makes one step per colour from a coloured example, leaving white parts out", () => {
    const px = page();
    const areas = labelAreas(itemOf(packMask(findLines(px, 150).mask)));
    let n = 0;
    const steps = stepsFromColours(areaColours(px, areas), areas, () => `s${n++}`);
    expect(steps).toHaveLength(1);
    expect(steps[0].color).toBe("orange");
    expect(areaAt(areas, steps[0].seeds[0])).toBe(areaAt(areas, { x: 500, y: 500 }));
  });

  it("the magic pen turns a dashed outline into smooth strokes that close the shape", () => {
    // A square drawn in dashes: 8 cells on, 3 off — like a dotted worksheet.
    const mask = new Uint8Array(GRID * GRID);
    const dash = (k: number) => k % 11 < 8;
    for (let k = 150; k <= 350; k++) {
      for (const w of [0, 1]) {
        if (!dash(k)) continue;
        mask[(150 + w) * GRID + k] = 1;
        mask[(350 + w) * GRID + k] = 1;
        mask[k * GRID + 150 + w] = 1;
        mask[k * GRID + 350 + w] = 1;
      }
    }
    expect(partCount(labelAreas(itemOf(packMask(mask))))).toBe(1);
    let n = 0;
    const strokes = smoothLines(closeGaps(mask, 2), () => `s${n++}`);
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.length).toBeLessThanOrEqual(4);
    const areas = labelAreas({ strokes, paint: undefined });
    expect(partCount(areas)).toBe(2);
  });

  it("the eraser rubs lines out of the picture, and only where it went", () => {
    const px = page();
    // Rub out part of the square's left side (x = 300–306; the fitted square is 1000 px, so pixels are units).
    const rubbed = applyErase(px, [{ r: 30, points: [{ x: 303, y: 400 }, { x: 303, y: 600 }] }]);
    const lineAt = (p: Uint8ClampedArray, x: number, y: number) => findLines(p, 150).mask[y * GRID + x] === 1;
    expect(lineAt(px, 302, 400)).toBe(true);
    expect(lineAt(rubbed, 302, 400)).toBe(false);
    expect(lineAt(rubbed, 302, 320)).toBe(true);
    expect(px).not.toBe(rubbed);
  });

  it("keeps the picture's own colour when no crayon is close, and the crayon when one is", () => {
    for (const [fill, want] of [
      [[242, 140, 40], "orange"],
      [[214, 160, 120], /^#[0-9a-f]{6}$/],
    ] as const) {
      const px = page([...fill] as [number, number, number]);
      const areas = labelAreas(itemOf(packMask(findLines(px, 150).mask)));
      const [step] = stepsFromColours(areaColours(px, areas), areas, () => "s");
      if (typeof want === "string") expect(step.color).toBe(want);
      else expect(step.color).toMatch(want);
    }
  });

  describe("every white pixel can be painted", () => {
    const pic = (raw: Uint8Array, gap: number) =>
      ({ strokes: [], paint: { steps: [], picture: { lines: "", walls: packMask(closeGaps(raw, gap)), raw: packMask(raw), strength: 200 } } }) as Pick<TraceItem, "strokes" | "paint">;
    const box = () => {
      const m = new Uint8Array(GRID * GRID);
      const wall = (x0: number, x1: number, y0: number, y1: number) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * GRID + x] = 1;
      };
      wall(100, 400, 100, 101);
      wall(100, 400, 399, 400);
      wall(100, 101, 100, 400);
      wall(399, 400, 100, 400);
      return { m, wall };
    };
    const cellAt = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.5 });

    it("a thin strip between two close lines is a part of its own, not swallowed by them", () => {
      const { m, wall } = box();
      wall(102, 398, 250, 251);
      wall(102, 398, 254, 255); // two lines with a 2-cell strip between: thickening swallows it
      const before = labelAreas({ strokes: [], paint: { steps: [], picture: { lines: "", walls: packMask(closeGaps(m, 2)), strength: 200 } } });
      expect(before.labels[252 * GRID + 200]).toBe(-1);
      const areas = labelAreas(pic(m, 2));
      const strip = areas.labels[252 * GRID + 200];
      expect(strip).toBeGreaterThanOrEqual(0);
      expect(strip).not.toBe(areaAt(areas, cellAt(200, 200)));
      expect(strip).not.toBe(areaAt(areas, cellAt(200, 300)));
      // Cells right beside a line belong to the part on their side.
      expect(areas.labels[248 * GRID + 200]).toBe(areaAt(areas, cellAt(200, 200)));
    });

    it("a dashed outline still keeps inside and outside apart", () => {
      const m = new Uint8Array(GRID * GRID);
      for (let k = 150; k <= 350; k++) {
        if (k % 8 >= 6) continue; // 6 on, 2 off
        for (const w of [0, 1]) {
          m[(150 + w) * GRID + k] = 1;
          m[(350 + w) * GRID + k] = 1;
          m[k * GRID + 150 + w] = 1;
          m[k * GRID + 350 + w] = 1;
        }
      }
      const areas = labelAreas(pic(m, 2));
      expect(areaAt(areas, cellAt(250, 250))).not.toBe(areaAt(areas, cellAt(50, 50)));
      expect(partCount(areas)).toBe(2);
      // No unlined cell is left out of a part.
      let left = 0;
      for (let i = 0; i < m.length; i++) if (!m[i] && areas.labels[i] < 0) left++;
      expect(left).toBe(0);
    });
  });
});
