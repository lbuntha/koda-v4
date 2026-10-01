import { describe, expect, it } from "vitest";
import { strokeBox } from "../geometry/edit";
import { makeStroke } from "../fixtures/items";
import { expandGroups, groupStrokes, mirrorSelection, remapGroups, selectionBox, ungroupStrokes } from "./groups";

const a = makeStroke("a", 1, [[100, 100], [200, 100]]);
const b = makeStroke("b", 2, [[300, 300], [300, 400]]);
const c = makeStroke("c", 3, [[600, 600], [700, 700]]);

describe("groups", () => {
  it("picking one member of a group selects the whole group", () => {
    const g = groupStrokes([a, b, c], [0, 2], "g1");
    expect(expandGroups(g, [2])).toEqual([0, 2]);
    expect(expandGroups(g, [1])).toEqual([1]);
  });

  it("ungrouping one member ungroups the whole group", () => {
    const g = groupStrokes([a, b, c], [0, 1], "g1");
    expect(ungroupStrokes(g, [1]).every((s) => !s.group)).toBe(true);
  });

  it("a group flips about its own centre and stays where it was", () => {
    const strokes = [a, b];
    const before = selectionBox(strokes, [0, 1]);
    const after = selectionBox(mirrorSelection(strokes, [0, 1], "horizontal"), [0, 1]);
    expect(after.minX).toBeCloseTo(before.minX, 6);
    expect(after.maxX).toBeCloseTo(before.maxX, 6);
    expect(strokeBox(mirrorSelection(strokes, [0, 1], "horizontal")[0]).minX).toBeCloseTo(200, 6);
  });

  it("a pasted group gets its own id", () => {
    const g = groupStrokes([a, b], [0, 1], "g1");
    const pasted = remapGroups(g, () => "g2");
    expect(pasted.map((s) => s.group)).toEqual(["g2", "g2"]);
  });
});
