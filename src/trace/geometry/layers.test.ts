import { describe, expect, it } from "vitest";
import { canFill, isSolid, restack, stackOrder } from "./layers";
import type { Stroke } from "./types";

const stroke = (id: string, extra: Partial<Stroke> = {}): Stroke => ({
  id,
  order: 1,
  shape: "loop",
  nodes: [
    { x: 0, y: 0, type: "corner" },
    { x: 10, y: 0, type: "corner" },
  ],
  closed: true,
  join: "lift",
  width: 60,
  checkpoints: [],
  ...extra,
});

const ids = (strokes: Stroke[]) => stackOrder(strokes).map((i) => strokes[i].id);

describe("layers", () => {
  it("stacks in writing order until a layer is set", () => {
    expect(stackOrder([stroke("a"), stroke("b"), stroke("c")])).toEqual([0, 1, 2]);
    expect(ids([stroke("a", { layer: 5 }), stroke("b"), stroke("c")])).toEqual(["b", "c", "a"]);
  });

  it("brings to front and sends to back, keeping the picked strokes' own order", () => {
    const s = [stroke("a"), stroke("b"), stroke("c"), stroke("d")];
    expect(ids(restack(s, [0, 1], "front"))).toEqual(["c", "d", "a", "b"]);
    expect(ids(restack(s, [2, 3], "back"))).toEqual(["c", "d", "a", "b"]);
  });

  it("steps forward and backward past one stroke", () => {
    const s = [stroke("a"), stroke("b"), stroke("c"), stroke("d")];
    expect(ids(restack(s, [1], "forward"))).toEqual(["a", "c", "b", "d"]);
    expect(ids(restack(s, [1], "backward"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(restack(s, [1, 2], "forward"))).toEqual(["a", "d", "b", "c"]);
    expect(ids(restack(s, [3], "forward"))).toEqual(["a", "b", "c", "d"]);
  });

  it("a new stroke lands in front of a restacked picture", () => {
    const s = restack([stroke("a"), stroke("b"), stroke("c")], [0], "front");
    expect(ids([...s, stroke("new")])).toEqual(["b", "c", "a", "new"]);
  });

  it("fills only closed shapes", () => {
    expect(canFill(stroke("a"))).toBe(true);
    expect(canFill(stroke("a", { closed: false }))).toBe(false);
    expect(isSolid(stroke("a", { fill: "paper" }))).toBe(true);
    expect(isSolid(stroke("a", { fill: "paper", closed: false }))).toBe(false);
  });
});
