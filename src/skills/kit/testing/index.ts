/**
 * The skill test kit.
 *
 * A new skill's whole test file can be:
 *
 *   import { describeSkillContract, describeActivitySmoke } from "../kit/testing";
 *   import { skill } from ".";
 *
 *   describeSkillContract(skill);
 *   describeActivitySmoke(skill);
 *
 * and it is already covered against every mistake that broke counting. Add one
 * `expectStandardRound` per activity to cover the round loop as well.
 */
export { createFakeKoda, type FakeKoda, type RecordedCall } from "./fakeKoda";
export { describeSkillContract } from "./skillContract";
export {
  renderActivity,
  expectStandardRound,
  mountsCleanly,
  type ActivityHarness,
  type RenderActivityOptions,
} from "./renderActivity";
export { describeActivitySmoke } from "./activitySmoke";
