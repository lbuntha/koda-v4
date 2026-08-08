import { describe, expect, test } from "vitest";
import { generateDynamicMathFact, getXtraMathLevel } from "./xtraMathLevels";

describe("xtraMathLevels dynamic fact generator", () => {
  test("generates 4 unique options including the correct answer", () => {
    const level = getXtraMathLevel("xm_level_1");
    for (let i = 0; i < 20; i++) {
      const fact = generateDynamicMathFact(level, i);
      expect(fact.options).toHaveLength(4);
      expect(new Set(fact.options).size).toBe(4);
      expect(fact.options).toContain(fact.answer);
      fact.options.forEach((opt) => expect(opt).toBeGreaterThanOrEqual(0));
    }
  });

  test("randomly distributes answer positions across all 4 option buttons", () => {
    const level = getXtraMathLevel("xm_level_3");
    const positionCounts = [0, 0, 0, 0];

    for (let i = 0; i < 200; i++) {
      const fact = generateDynamicMathFact(level, i);
      const ansIndex = fact.options.indexOf(fact.answer);
      expect(ansIndex).toBeGreaterThanOrEqual(0);
      expect(ansIndex).toBeLessThan(4);
      positionCounts[ansIndex]++;
    }

    // Assert that the answer appears in all 4 button positions across 200 iterations
    for (let pos = 0; pos < 4; pos++) {
      expect(positionCounts[pos]).toBeGreaterThan(10);
    }
  });
});
