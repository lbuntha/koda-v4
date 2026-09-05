import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { RACK_SPECS } from "./internal/specs";

describeSkillContract(skill);
describeActivitySmoke(skill);

describe("Bottle Sort registration", () => {
  it("ships Phase 1's five lessons on one engine, with no artwork", () => {
    expect(skill.lessons).toHaveLength(5);
    expect(Object.keys(skill.activities)).toEqual(["sort"]);
    // Bottles are geometry; there is deliberately nothing in assets/.
    expect(skill.assets).toEqual([]);
    expect(skill.manifest.status).toBe("draft");
  });

  it("names a real rack spec in every lesson", () => {
    skill.lessons.forEach((lesson) => {
      const spec = (lesson.params as { question: { spec: string } }).question.spec;
      expect(RACK_SPECS.some((s) => s.id === spec), `${lesson.id} -> ${spec}`).toBe(true);
    });
  });
});
