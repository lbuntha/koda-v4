import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANNER, PORTRAIT, SAFE_AREA, SHAPES, describeShape, ratioOf } from "./pictureShape";

/**
 * A picture's shape is defined once, and three places have to agree with it:
 * the reader that reserves the room, the AI that draws to it, and the words an
 * author is given. They fail quietly when they drift — a page with the wrong
 * hole in it looks fine until the picture lands and everything moves.
 */

describe("the shape of a picture", () => {
  it("is a 2:1 banner and a 3:4 portrait", () => {
    expect(BANNER.width / BANNER.height).toBe(2);
    expect(PORTRAIT.width / PORTRAIT.height).toBe(0.75);
  });

  it("is written as a CSS aspect ratio the reader can reserve", () => {
    expect(ratioOf(BANNER)).toBe("1600 / 800");
    expect(ratioOf(PORTRAIT)).toBe("1200 / 1600");
  });

  it("tells an author the pixels, the proportion and the safe area", () => {
    expect(describeShape("banner")).toContain("1600 × 800");
    expect(describeShape("banner")).toContain("2:1");
    expect(describeShape("portrait")).toContain("1200 × 1600");
    expect(describeShape("portrait")).toContain(`${Math.round(SAFE_AREA * 100)}%`);
  });

  it("is the same shape the AI is told to draw", () => {
    // server.ts is not importable from here; what it tells the model is read as text.
    const server = readFileSync("server.ts", "utf8");
    for (const kind of ["banner", "portrait"] as const) {
      const { width, height } = SHAPES[kind];
      expect(server).toContain(`viewBox=\\"0 0 ${width} ${height}\\"`);
    }
  });
});
