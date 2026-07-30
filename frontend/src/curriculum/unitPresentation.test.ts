import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultUnitPresentation } from "./unitPresentation";

describe("defaultUnitPresentation", () => {
  it("is stable for a unit id", () => {
    assert.deepEqual(defaultUnitPresentation("unit-counting"), defaultUnitPresentation("unit-counting"));
  });

  it("offers more than one fallback across different unit ids", () => {
    const values = new Set(Array.from({ length: 20 }, (_, index) =>
      JSON.stringify(defaultUnitPresentation(`unit-${index}`)),
    ));
    assert.ok(values.size > 1);
  });
});
