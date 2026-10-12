import { describe, expect, it } from "vitest";
import { shade } from "./shade";

describe("soft gradient colours", () => {
  it("lightens a part's top and deepens its bottom, keeping its hue", () => {
    const blue = [60, 120, 220];
    const [tr, tg, tb] = shade(blue, 0);
    const [br, bg, bb] = shade(blue, 1);
    expect(tr).toBeGreaterThan(60);
    expect(br).toBeLessThan(60);
    // Still blue at both ends.
    expect(tb).toBeGreaterThan(tr);
    expect(bb).toBeGreaterThan(br);
    expect(tg).toBeGreaterThan(bg);
  });
});
