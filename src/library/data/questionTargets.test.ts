import { describe, expect, it } from "vitest";
import { meetsTarget, minimumQuestions } from "./passage";

describe("question targets", () => {
  it("lets a section be skipped with a target of 0", () => {
    expect(minimumQuestions(0)).toBe(0);
    expect(meetsTarget(0, 0)).toBe(true);
    expect(meetsTarget(1, 0)).toBe(false);
  });

  it("needs 85% of the target, rounded up, and never more than it", () => {
    expect(meetsTarget(2, 3)).toBe(false);
    expect(meetsTarget(3, 3)).toBe(true);
    expect(meetsTarget(9, 10)).toBe(true);
    expect(meetsTarget(8, 10)).toBe(false);
    expect(meetsTarget(4, 3)).toBe(false);
  });
});
