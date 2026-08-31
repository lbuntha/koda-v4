import { describeSkillContract, describeActivitySmoke } from "../kit/testing";
import { skill } from ".";

/**
 * Addition's structural tests — the whole file.
 *
 * Everything here is inherited from the kit: the manifest, every lesson's
 * references, the `requires` chain, the level numbering and the settings
 * schema. Adding a lesson never means adding a test here, which is the only
 * way a 52-lesson skill stays checkable.
 */
describeSkillContract(skill);
describeActivitySmoke(skill);
