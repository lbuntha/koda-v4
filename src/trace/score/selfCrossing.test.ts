import { describe, expect, it } from "vitest";
import { addLoop } from "../geometry/edit";
import { makeStroke } from "../fixtures/items";
import { ideal, scribble, wobble } from "../fixtures/traces";
import { measureStroke, prepareStroke } from "./score";

// ង in one motion, roughly: a short tick right, down, a zigzag along the
// bottom, up the right side, a head loop, then back across the middle — a path
// that passes close to itself in several places.
const NGO = addLoop(
  makeStroke("s1", 1, [[300, 560], [380, 560], [380, 780], [520, 660], [620, 760], [600, 520], [560, 430]], { width: 60 }),
  6,
  "right",
  50,
);

describe("a stroke that passes close to itself", () => {
  const target = prepareStroke(NGO, 0);
  const r = 40;

  it("is accepted when traced along its path", () => {
    const res = measureStroke(target, ideal(NGO), r);
    expect(res.measures.reversals).toBe(0);
    expect(res).toMatchObject({ accepted: true });
  });

  it("is accepted when traced with a wobbly hand", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const res = measureStroke(target, wobble(ideal(NGO), 8, seed), r);
      expect(res.fault, `seed ${seed}`).toBeUndefined();
    }
  });

  it("still catches scribbling back and forth over it", () => {
    expect(measureStroke(target, scribble(ideal(NGO)), r).fault).toBe("scribble");
  });
});
