import { describeSkillContract, describeActivitySmoke } from "../kit/testing";
import { skill } from ".";

/**
 * Multiplication's structural tests — the whole file.
 *
 * Both suites are inherited from the kit. They prove the skill is shaped like a
 * skill and that every registered activity mounts; they do not prove any mode
 * works, which is what `multiplication.activities.test.tsx` is for.
 */
describeSkillContract(skill);
describeActivitySmoke(skill);
