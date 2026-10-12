import { describe, expect, it } from "vitest";
import { GOLDEN_ITEMS } from "../fixtures/items";
import { applyPreset, presetOf } from "./presets";

describe("style presets", () => {
  it("sets a picture for an age, and recognises it", () => {
    const item = { ...structuredClone(GOLDEN_ITEMS[0]), paint: { steps: [] } };
    const older = applyPreset(item, "older");
    expect(older.look).toEqual({ thin: true, dotted: true, hideNumbers: true, hideArrows: true });
    expect(older.sensitivity).toBe("strict");
    expect(older.strokes.every((s) => s.width === 12)).toBe(true);
    expect(older.paint).toMatchObject({ brush: "xs", allowFill: false });
    expect(presetOf(older)).toBe("older");

    const young = applyPreset(older, "young");
    expect(young.look).toBeUndefined();
    expect(young.paint?.allowFill).toBeUndefined();
    expect(presetOf(young)).toBe("young");
  });

  it("a picture changed by hand shows no preset", () => {
    const middle = applyPreset(structuredClone(GOLDEN_ITEMS[0]), "middle");
    expect(presetOf({ ...middle, look: { thin: true, dashed: true } })).toBeNull();
  });
});
