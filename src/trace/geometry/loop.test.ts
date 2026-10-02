import { describe, expect, it } from "vitest";
import { strokePolyline } from "./bezier";
import { addLoop } from "./edit";
import { polylineLength } from "./polyline";
import { makeStroke } from "../fixtures/items";

// Straight up from the bottom: the head of ង goes on its top end.
const up = () => makeStroke("s1", 1, [[500, 800], [500, 300]]);

describe("adding a loop", () => {
  it("goes round a circle beside the end and comes back to it", () => {
    const s = addLoop(up(), 1, "right", 100);
    expect(s.nodes).toHaveLength(6);
    const end = s.nodes[5];
    expect([end.x, end.y]).toEqual([500, 300]);
    // Travelling up and curling right: the circle's centre is 100 to the right.
    const xs = s.nodes.slice(2, 5).map((n) => Math.round(n.x));
    const ys = s.nodes.slice(2, 5).map((n) => Math.round(n.y));
    expect(xs).toEqual([600, 700, 600]);
    expect(ys).toEqual([200, 300, 400]);
    // The loop is a circle: its drawn length is 2πr on top of the line's.
    expect(polylineLength(strokePolyline(s, 0.02))).toBeCloseTo(500 + 2 * Math.PI * 100, -1);
  });

  it("curls the other way when turned left", () => {
    const s = addLoop(up(), 1, "left", 100);
    expect(Math.round(s.nodes[3].x)).toBe(300);
  });

  it("leaves the rest of the stroke as it was when put in the middle", () => {
    const line = makeStroke("s1", 1, [[200, 500], [500, 500], [800, 500]]);
    const s = addLoop(line, 1, "left", 80);
    expect(s.nodes.map((n) => [n.x, n.y])[0]).toEqual([200, 500]);
    expect(s.nodes.at(-1)).toMatchObject({ x: 800, y: 500 });
    expect(s.nodes).toHaveLength(7);
  });

  it("ignores a dot", () => {
    const dot = { ...up(), shape: "dot" as const };
    expect(addLoop(dot, 0, "left")).toBe(dot);
  });
});
