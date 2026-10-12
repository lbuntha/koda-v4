import { describe, expect, it } from "vitest";
import { partIndexes, partsOf } from "./parts";

describe("parts", () => {
  it("the first stroke begins part 1; a marked stroke begins the next", () => {
    const strokes = [{ part: { title: "Draw the body" } }, {}, { part: { title: "Add the roof" } }, { part: {} }, {}];
    expect(partIndexes(strokes)).toEqual([0, 0, 1, 2, 2]);
    expect(partsOf(strokes)).toEqual([
      { index: 0, title: "Draw the body", strokes: [0, 1] },
      { index: 1, title: "Add the roof", strokes: [2] },
      { index: 2, title: undefined, strokes: [3, 4] },
    ]);
  });

  it("no marks: one part", () => {
    expect(partIndexes([{}, {}, {}])).toEqual([0, 0, 0]);
    expect(partsOf([])).toEqual([]);
  });
});
