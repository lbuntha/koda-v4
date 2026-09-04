import { describe, expect, it } from "vitest";
import { buildQuestion, objectHuntHints } from "./activities/ObjectHunt";

describe("observation hint ladder", () => {
  it("moves from scan strategy to a truthful broad region", () => {
    const question = buildQuestion({ objectCount: 10, targetCount: 2 }, 1);
    const hints = objectHuntHints(question, new Set());
    const placement = question.objects.find((object) => object.id === question.targets[0])!;
    expect(hints).toHaveLength(3);
    expect(hints[0]).toMatch(/left to right/i);
    expect(hints[1]).toContain(placement.region.replace("-", " "));
    expect(hints[2]).not.toContain("Tap");
  });
});
