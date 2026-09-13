import { describeSkillContract, describeActivitySmoke } from "../kit/testing";
import { skill } from ".";

/**
 * Fractions' structural tests — the whole file.
 *
 * Both suites are inherited from the kit. They prove the skill is shaped like a
 * skill and that every registered activity mounts; they do not prove any mode
 * works, which is what `fractions.strip.test.tsx` is for.
 */
describeSkillContract(skill);
describeActivitySmoke(skill);
