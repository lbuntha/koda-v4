import { describe, expect, it } from "vitest";
import { autoSubmits, backspace, dragStep, hitTile, labelsOf, releaseAction, tapStep } from "./traceModel";

describe("hitTile", () => {
  const centres = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];

  it("finds the tile under the pointer", () => {
    expect(hitTile(centres, { x: 48, y: 3 }, 30)).toBe(1);
  });

  it("returns null over nothing", () => {
    expect(hitTile(centres, { x: 50, y: 80 }, 30)).toBeNull();
  });

  it("picks the nearest of two tiles the pointer is within reach of, not the first", () => {
    expect(hitTile(centres, { x: 40, y: 0 }, 60)).toBe(1); // 40 from tile 0, 10 from tile 1
    expect(hitTile(centres, { x: 90, y: 0 }, 60)).toBe(2);
  });

  it("includes the edge of the radius", () => {
    // Exactly 20 from tile 0 and more than 20 from every other tile.
    expect(hitTile(centres, { x: 0, y: 20 }, 20)).toBe(0);
    expect(hitTile(centres, { x: 0, y: 20.01 }, 20)).toBeNull();
  });
});

describe("dragStep", () => {
  it("adds an unused tile", () => {
    expect(dragStep([0], 1)).toEqual([0, 1]);
    expect(dragStep([], 3)).toEqual([3]);
  });

  it("does nothing while the pointer stays on the last tile, or over nothing", () => {
    expect(dragStep([0, 1], 1)).toEqual([0, 1]);
    expect(dragStep([0, 1], null)).toEqual([0, 1]);
  });

  it("takes the last tile off when the pointer returns to the one before — the string unwinds", () => {
    expect(dragStep([0, 1], 0)).toEqual([0]);
    expect(dragStep([2, 0, 1], 0)).toEqual([2, 0]);
  });

  it("ignores any other used tile, so a wobble cannot undo three letters", () => {
    expect(dragStep([0, 1, 2], 0)).toEqual([0, 1, 2]);
  });

  it("never mutates what it was given", () => {
    const picked = [0, 1];
    dragStep(picked, 2);
    dragStep(picked, 0);
    expect(picked).toEqual([0, 1]);
  });

  it("never lists a tile twice, whatever the pointer does", () => {
    let picked: number[] = [];
    const path = [0, 1, 0, 2, 1, 3, 2, 3, 0, 1, 2, 3, 3, null, 1];
    for (const hit of path) {
      picked = dragStep(picked, hit);
      expect(new Set(picked).size).toBe(picked.length);
    }
  });
});

describe("tapStep", () => {
  it("adds an unused tile and removes the last one", () => {
    expect(tapStep([], 2)).toEqual([2]);
    expect(tapStep([2], 0)).toEqual([2, 0]);
    expect(tapStep([2, 0], 0)).toEqual([2]);
  });

  it("does nothing for a used tile that is not the last", () => {
    expect(tapStep([2, 0], 2)).toEqual([2, 0]);
  });
});

describe("backspace, labels and release", () => {
  it("takes the last tile off, and is safe on nothing", () => {
    expect(backspace([1, 2])).toEqual([1]);
    expect(backspace([])).toEqual([]);
  });

  it("reads the labels in the order chosen, so two identical letters stay two", () => {
    const tiles = [{ label: "S" }, { label: "E" }, { label: "E" }];
    expect(labelsOf(tiles, [2, 0, 1])).toEqual(["E", "S", "E"]);
  });

  it("drops a trace shorter than the minimum and submits anything else", () => {
    expect(releaseAction([0], 2)).toBe("drop");
    expect(releaseAction([0, 1], 2)).toBe("submit");
    expect(releaseAction([], 1)).toBe("drop");
    expect(releaseAction([0], 0)).toBe("submit"); // a minimum of 0 still needs a tile
  });

  it("submits itself only at exactly the length asked for", () => {
    expect(autoSubmits([0, 1, 2], 3)).toBe(true);
    expect(autoSubmits([0, 1], 3)).toBe(false);
    expect(autoSubmits([0, 1, 2, 3], 3)).toBe(false);
    expect(autoSubmits([0, 1, 2], undefined)).toBe(false);
    expect(autoSubmits([0, 1, 2], 0)).toBe(false);
  });
});
