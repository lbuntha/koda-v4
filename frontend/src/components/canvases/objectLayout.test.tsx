import { describe, it, expect } from "vitest";
import {
  OBJECT_SIZE,
  binSizeForStage,
  contentZone,
  countingObjectSize,
  fitObjectSize,
  bestGrid,
  pilePosition,
  slotPosition,
  type Rect
} from "./objectLayout";

/** The bin geometry a stage of this size produces, as the canvases compute it. */
const binFor = (stageWidth: number, stageHeight: number, count: number) => {
  const stacked = stageWidth < 640;
  const bin = binSizeForStage(stageWidth, stageHeight, { stacked });
  return { ...bin, size: fitObjectSize({ ...bin, count }) };
};

/** Does the whole grid fit inside the zone it was laid out in? */
const gridExtent = (count: number, zone: Rect, size: number) => {
  const positions = Array.from({ length: count }, (_, i) => slotPosition(i + 1, count, zone, size));
  const left = Math.min(...positions.map(p => p.x));
  const top = Math.min(...positions.map(p => p.y));
  return {
    left,
    top,
    right: Math.max(...positions.map(p => p.x)) + size,
    bottom: Math.max(...positions.map(p => p.y)) + size
  };
};

describe("object layout", () => {
  it("grows objects with the screen instead of pinning them to one size", () => {
    const phone = binFor(390, 620, 6).size;
    const tablet = binFor(1024, 620, 6).size;
    const desktop = binFor(1600, 700, 6).size;

    expect(phone).toBeLessThan(tablet);
    expect(tablet).toBeLessThanOrEqual(desktop);
    expect(desktop).toBe(OBJECT_SIZE.max);
  });

  it("shrinks objects as more of them share the same bin", () => {
    const few = binFor(1280, 640, 4).size;
    const many = binFor(1280, 640, 20).size;
    expect(many).toBeLessThan(few);
    expect(many).toBeGreaterThanOrEqual(OBJECT_SIZE.min);
  });

  it("never returns a size outside the touch-target limits", () => {
    const tiny = binFor(200, 160, 12).size;
    const huge = binFor(3840, 2160, 2).size;
    expect(tiny).toBeGreaterThanOrEqual(OBJECT_SIZE.min);
    expect(huge).toBeLessThanOrEqual(OBJECT_SIZE.max);
  });

  it("keeps the whole grid inside the bin it was measured against", () => {
    const stages: Array<[number, number]> = [
      [390, 620],
      [768, 560],
      [1024, 620],
      [1440, 700],
      [1920, 820]
    ];

    for (const [stageWidth, stageHeight] of stages) {
      for (const count of [1, 3, 6, 10, 20]) {
        const bin = binFor(stageWidth, stageHeight, count);
        const zone = contentZone({ left: 0, top: 0, width: bin.width, height: bin.height }, bin.size);
        const extent = gridExtent(count, zone, bin.size);

        expect(extent.left).toBeGreaterThanOrEqual(zone.left - 1);
        expect(extent.top).toBeGreaterThanOrEqual(zone.top - 1);
        expect(extent.right).toBeLessThanOrEqual(zone.left + zone.width + 1);
        expect(extent.bottom).toBeLessThanOrEqual(zone.top + zone.height + 1);
      }
    }
  });

  it("keeps a pile inside the container it was piled into", () => {
    // A jar's mouth, roughly: much smaller than the objects would like.
    const zone: Rect = { left: 40, top: 20, width: 240, height: 300 };

    for (const count of [1, 3, 5, 8, 12]) {
      const size = fitObjectSize({ width: zone.width, height: zone.height, count, padding: 4, captionInset: 0 });
      const spots = Array.from({ length: count }, (_, i) => pilePosition(i + 1, count, zone, size));

      for (const spot of spots) {
        expect(spot.x).toBeGreaterThanOrEqual(zone.left - 1);
        expect(spot.y).toBeGreaterThanOrEqual(zone.top - 1);
        expect(spot.x + size).toBeLessThanOrEqual(zone.left + zone.width + 1);
        expect(spot.y + size).toBeLessThanOrEqual(zone.top + zone.height + 1);
      }
      // Piles fill from the bottom, so the last row sits on the floor.
      expect(Math.max(...spots.map(s => s.y)) + size).toBeGreaterThan(zone.top + zone.height - size);
    }
  });

  it("sizes a counting object the same way whoever asks", () => {
    // The rule Move & Count uses is the rule every counting canvas starts from.
    const stage = { stageWidth: 1000, stageHeight: 700, count: 5 };
    const shared = countingObjectSize({ ...stage, stacked: false });
    const bin = binSizeForStage(stage.stageWidth, stage.stageHeight, { stacked: false });

    expect(shared).toBe(fitObjectSize({ width: bin.width, height: bin.height, count: stage.count }));
    expect(shared).toBeGreaterThan(countingObjectSize({ ...stage, count: 20, stacked: false }));
  });

  it("splits the stage across the axis the bins are stacked on", () => {
    const side = binSizeForStage(1000, 600, { stacked: false });
    expect(side.width).toBeLessThan(1000);
    expect(side.height).toBe(600);

    const stack = binSizeForStage(400, 600, { stacked: true });
    expect(stack.width).toBe(400);
    expect(stack.height).toBeLessThan(600);
  });

  it("picks the arrangement that fills the space it is given", () => {
    // Square space: the square-ish grid wins.
    expect(bestGrid(4, 400, 400)).toMatchObject({ columns: 2, rows: 2 });
    // Wide, short space — a phone's stacked bin: one row beats 3+2.
    expect(bestGrid(5, 400, 90)).toMatchObject({ columns: 5, rows: 1 });
    // Tall, narrow space: a column.
    expect(bestGrid(4, 90, 400)).toMatchObject({ columns: 1, rows: 4 });

    const zone: Rect = { left: 0, top: 0, width: 400, height: 400 };
    const only = slotPosition(1, 1, zone, 100);
    expect(only).toEqual({ x: 150, y: 150 });
  });
});
