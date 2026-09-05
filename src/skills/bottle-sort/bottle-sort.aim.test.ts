import { describe, expect, it } from "vitest";
import { PIVOT_Y, POUR_ANGLE, aimPour, type Box } from "./internal/bottle";

/**
 * Where the tilted bottle ends up, checked as arithmetic.
 *
 * The first version guessed with a fixed percentage offset and put the lip
 * wherever the neighbour happened to be; the second was only checkable by
 * racing a one-second animation in a browser. This is the same maths the
 * component applies, so the aim can be wrong in a test rather than on a screen.
 */
const bottle = (left: number): Box => ({ left, top: 300, width: 60, height: 160 });
const mouthOf = (b: Box): Box => ({ left: b.left + b.width / 2 - 2, top: b.top + 6, width: 4, height: 4 });

/** Apply the transform the component writes, and report where the lip lands. */
function lipAfter(source: Box, lip: Box, angle: number, dx: number, dy: number) {
  const origin = { x: source.left + source.width * 0.5, y: source.top + source.height * PIVOT_Y };
  const c = { x: lip.left + lip.width / 2, y: lip.top + lip.height / 2 };
  const rad = (angle * Math.PI) / 180;
  const v = { x: c.x - origin.x, y: c.y - origin.y };
  return {
    x: origin.x + v.x * Math.cos(rad) - v.y * Math.sin(rad) + dx,
    y: origin.y + v.x * Math.sin(rad) + v.y * Math.cos(rad) + dy,
  };
}

describe("aiming a pour", () => {
  it("leans far enough to pour, without turning the bottle over", () => {
    // Under about 60 the neck still points upward and it reads as a bottle
    // knocked over; past about 90 the body swings up out of the rack.
    expect(POUR_ANGLE).toBeGreaterThan(60);
    expect(POUR_ANGLE).toBeLessThan(90);
  });

  it("keeps the tilted bottle near the rack it came from", () => {
    // The lip can be placed perfectly while the rest of the bottle ends up
    // somewhere absurd. Both have to be true.
    const src = bottle(100);
    const aim = aimPour(src, mouthOf(src), mouthOf(bottle(200)), 1);
    expect(Math.abs(aim.dx), "shifted too far sideways").toBeLessThan(src.width * 2);
    expect(Math.abs(aim.dy), "lifted too far off the rack").toBeLessThan(src.height);
  });

  it("puts the lip just above the receiving mouth, both directions", () => {
    ([[100, 200, 1], [300, 200, -1]] as const).forEach(([a, b, dir]) => {
      const src = bottle(a);
      const dst = bottle(b);
      const target = mouthOf(dst);
      const aim = aimPour(src, mouthOf(src), target, dir);
      const landed = lipAfter(src, mouthOf(src), aim.angle, aim.dx, aim.dy);
      const mouth = { x: target.left + target.width / 2, y: target.top + target.height / 2 };

      // Over the mouth, on the near side, and above it — liquid falls downward.
      expect(landed.y).toBeLessThan(mouth.y);
      expect(mouth.y - landed.y).toBeLessThan(40);
      expect(Math.abs(landed.x - mouth.x)).toBeLessThan(20);
      expect(Math.sign(mouth.x - landed.x)).toBe(dir);
    });
  });

  it("aims correctly whatever the two bottles' heights", () => {
    // Mixed-capacity racks put a short bottle beside a tall one.
    const short: Box = { left: 100, top: 360, width: 60, height: 100 };
    const tall: Box = { left: 200, top: 280, width: 60, height: 180 };
    ([[short, tall, 1], [tall, short, -1]] as const).forEach(([src, dst, dir]) => {
      const aim = aimPour(src, mouthOf(src), mouthOf(dst), dir as 1 | -1);
      const landed = lipAfter(src, mouthOf(src), aim.angle, aim.dx, aim.dy);
      const mouth = { x: dst.left + dst.width / 2, y: dst.top + 8 };
      expect(Math.abs(landed.x - mouth.x), "lip drifted off the mouth").toBeLessThan(22);
      expect(landed.y, "lip must sit above the mouth it pours into").toBeLessThan(mouth.y);
    });
  });

  it("moves the bottle further when the target is further away", () => {
    const src = bottle(100);
    const near = aimPour(src, mouthOf(src), mouthOf(bottle(200)), 1);
    const far = aimPour(src, mouthOf(src), mouthOf(bottle(400)), 1);
    expect(far.dx).toBeGreaterThan(near.dx);
  });
});
