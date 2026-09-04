import { describe, expect, it } from "vitest";
import { OBJECT_CATALOG } from "./internal/data";
import { SCENES } from "./internal/scenes";
import { validateCatalog, validateScene } from "./internal/validation";

describe("observation content data", () => {
  it("freezes exactly 100 unique objects", () => {
    expect(OBJECT_CATALOG).toHaveLength(100);
    expect(validateCatalog()).toEqual([]);
  });

  it("keeps authored beach placements reachable and unambiguous", () => {
    expect(SCENES).toHaveLength(1);
    expect(validateScene(SCENES[0])).toEqual([]);
  });
});
