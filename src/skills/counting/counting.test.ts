import { describeSkillContract, describeActivitySmoke } from "../kit/testing";
import { skill } from ".";

/**
 * Counting's structural tests — the whole file.
 *
 * Everything here is inherited from the kit, so this is what a new skill copies:
 * two lines, and the skill is held to the same standard as this one.
 */
describeSkillContract(skill);
describeActivitySmoke(skill);
