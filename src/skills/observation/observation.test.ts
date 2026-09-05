import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { SCENES } from "./internal/scenes";

describeSkillContract(skill);
describeActivitySmoke(skill);

describe("Observation registration", () => {
  it("bundles 130 object SVGs and twenty-eight scene backdrops", () => {
    expect(Object.keys(skill.assets)).toHaveLength(158);
    expect(SCENES).toHaveLength(28);
    expect(skill.lessons).toHaveLength(21);
  });
});
