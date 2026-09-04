import { describe, expect, it } from "vitest";
import { describeActivitySmoke, describeSkillContract } from "../kit/testing";
import { skill } from ".";
import { SCENES } from "./internal/scenes";

describeSkillContract(skill);
describeActivitySmoke(skill);

describe("Observation registration", () => {
  it("bundles 110 object SVGs and twenty-two scene backdrops", () => {
    expect(Object.keys(skill.assets)).toHaveLength(132);
    expect(SCENES).toHaveLength(22);
    expect(skill.lessons).toHaveLength(13);
  });
});
