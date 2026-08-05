import { describe, it, expect } from "vitest";
import { OBJECT_SIZE } from "./objectLayout";
import { minSpacing, oneToOneLayout, patternCentres, type OneToOnePattern } from "./oneToOneLayout";

const PATTERNS: OneToOnePattern[] = ["grid", "columns", "pairs", "line", "circle", "wave", "scatter", "ring", "dice"];

/** Centres of the objects a layout produced. */
const centresOf = (layout: ReturnType<typeof oneToOneLayout>) =>
  layout.positions.map(p => ({ x: p.x + layout.size / 2, y: p.y + layout.size / 2 }));

describe("one-to-one layout", () => {
  it("keeps every object inside the stage, in every pattern", () => {
    const stages: Array<[number, number]> = [
      [360, 420],
      [700, 380],
      [1100, 560],
      [1600, 700]
    ];

    for (const pattern of PATTERNS) {
      for (const [width, height] of stages) {
        for (const count of [1, 3, 5, 8, 12]) {
          const { size, positions } = oneToOneLayout({ count, width, height, pattern });
          expect(positions).toHaveLength(count);
          for (const position of positions) {
            expect(position.x).toBeGreaterThanOrEqual(0);
            expect(position.y).toBeGreaterThanOrEqual(0);
            expect(position.x + size).toBeLessThanOrEqual(width);
            expect(position.y + size).toBeLessThanOrEqual(height);
          }
        }
      }
    }
  });

  it("never lets two objects overlap, in every pattern", () => {
    for (const pattern of PATTERNS) {
      for (const count of [2, 4, 6, 9, 12]) {
        const layout = oneToOneLayout({ count, width: 900, height: 500, pattern });
        // Centres at least one object apart means no two objects share pixels.
        expect(minSpacing(centresOf(layout))).toBeGreaterThanOrEqual(layout.size);
      }
    }
  });

  it("grows objects with the stage rather than with a breakpoint", () => {
    const phone = oneToOneLayout({ count: 5, width: 380, height: 420, pattern: "grid" }).size;
    const tablet = oneToOneLayout({ count: 5, width: 1024, height: 560, pattern: "grid" }).size;
    const desktop = oneToOneLayout({ count: 5, width: 1600, height: 700, pattern: "grid" }).size;

    expect(phone).toBeLessThan(tablet);
    expect(tablet).toBeLessThanOrEqual(desktop);
    expect(desktop).toBe(OBJECT_SIZE.max);
  });

  it("shrinks objects as the slide asks for more of them", () => {
    const few = oneToOneLayout({ count: 3, width: 900, height: 500, pattern: "grid" }).size;
    const many = oneToOneLayout({ count: 15, width: 900, height: 500, pattern: "grid" }).size;
    expect(many).toBeLessThan(few);
    expect(many).toBeGreaterThanOrEqual(OBJECT_SIZE.min);
  });

  it("honours the teacher's column count", () => {
    const centres = patternCentres("pairs", 6, { left: 0, top: 0, width: 600, height: 400 });
    const columns = new Set(centres.map(c => Math.round(c.x))).size;
    expect(columns).toBe(2);

    const three = patternCentres("grid", 9, { left: 0, top: 0, width: 600, height: 400 }, 3);
    expect(new Set(three.map(c => Math.round(c.x))).size).toBe(3);
  });

  it("keeps a line on one row while it fits, and wraps when it cannot", () => {
    const roomy = patternCentres("line", 6, { left: 0, top: 0, width: 900, height: 300 });
    expect(new Set(roomy.map(c => Math.round(c.y))).size).toBe(1);

    const cramped = patternCentres("line", 12, { left: 0, top: 0, width: 300, height: 400 });
    expect(new Set(cramped.map(c => Math.round(c.y))).size).toBeGreaterThan(1);
  });

  it("closes a ring, where a circle only arcs", () => {
    const area = { left: 0, top: 0, width: 600, height: 400 };
    const ring = patternCentres("ring", 8, area);
    const arc = patternCentres("circle", 8, area);

    // Every object the same distance from the middle, and objects both above and
    // below it — an arc has none below.
    const radii = ring.map(p => Math.hypot((p.x - 300) / 300, (p.y - 200) / 200));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.01);
    expect(ring.some(p => p.y > 200)).toBe(true);
    expect(arc.every(p => p.y <= 201)).toBe(true);
  });

  it("gives 1 to 6 a real dice face, and falls back to a grid above it", () => {
    const area = { left: 0, top: 0, width: 600, height: 400 };

    // A five is four corners around a centre dot: exactly three distinct columns.
    const five = patternCentres("dice", 5, area);
    expect(new Set(five.map(p => Math.round(p.x))).size).toBe(3);
    expect(five.some(p => Math.round(p.x) === 300 && Math.round(p.y) === 200)).toBe(true);

    // A six is two columns of three; seven has no face, so it grids.
    expect(new Set(patternCentres("dice", 6, area).map(p => Math.round(p.x))).size).toBe(2);
    expect(patternCentres("dice", 7, area)).toEqual(patternCentres("grid", 7, area));
  });

  it("reads a circle left to right, as a child counts it", () => {
    const centres = patternCentres("circle", 5, { left: 0, top: 0, width: 600, height: 400 });
    const xs = centres.map(c => c.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});
