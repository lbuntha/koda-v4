import { getSkillLessons } from "../curriculum";
import type { Viewer } from "../skills/viewer";
import { Billing } from "./billing";
import { SkillStoreAPI } from "./skillStore";

/**
 * Which lessons a plan pays for.
 *
 * A skill opens with a run of free lessons and charges for the rest — counting
 * gives away levels 1 to 10, and level 11 onwards needs the plan. The split is
 * per skill and set by an operator, not by this file: a skill declares the
 * switch and the count in its own manifest, so the Skill Manager renders both
 * without knowing what they mean, and a deployment that sells nothing leaves
 * the switch off and behaves exactly as it did before.
 *
 * Three separate questions, deliberately not merged:
 *
 *  - **Is this lesson premium?** A fact about the course and the operator's
 *    settings. True whether or not anybody has paid.
 *  - **Is it locked?** That, and this family's plan. What a padlock draws.
 *  - **May they open it?** `requireFeature`, which also explains the answer.
 *
 * None of this is enforcement, and it cannot be. Lessons are bundled with the
 * app and a round is played offline against no server — there is no request to
 * refuse. What the plan actually buys is what the app *offers*, which is the
 * same bargain the padlocks on the learning path already make. Anything that
 * must be enforced (adding a learner, calling the tutor) is refused server-side
 * and always was; see `services/entitlements.py`.
 */

/** The plan feature that opens the paid lessons. Declared in `plan_defaults.py`. */
export const PREMIUM_FEATURE = "course.premium";

/**
 * What a skill gives away when it says nothing.
 *
 * Ten, which is the shape of the ask and long enough to be a real course rather
 * than a demo. It only applies where a manifest declares the setting and leaves
 * it empty, because the switch above still has to be turned on.
 */
export const DEFAULT_FREE_LESSONS = 10;

/**
 * Every lesson a skill contributes, in course order, whoever is looking.
 *
 * `getSkillLessons` normally answers for a viewer, and age-gating changes the
 * list — so a five-year-old and a nine-year-old would disagree about which
 * lesson is the eleventh, and the same lesson would be free for one child and
 * paid for the other. Which lessons a plan covers is a fact about the course
 * and the price list, so it is asked of the whole course.
 */
const ALL_AGES = { age: 99, showAllSkills: true } as Viewer;

/**
 * Whether this skill charges for anything at all — its manifest switch, which an
 * operator flips in Skill Manager. Off by default, so adding this feature to the
 * build sells nothing until somebody decides to.
 *
 * The id is written out rather than held in a constant on purpose: the skill
 * contract scans this file for the spelling, and that is how a switch shown in
 * the Skill Manager is proved to be one something actually reads.
 */
export const premiumEnabled = (skillId: string): boolean =>
  SkillStoreAPI.isFeatureEnabled(skillId, "premium_lessons", false);

/**
 * How many of this skill's lessons are free — the count beside the switch, in
 * the skill's own manifest settings.
 *
 * Coerced and floored rather than trusted: the value is typed into a settings
 * form, and a blank field or a negative number must not quietly make the whole
 * skill paid. The key is written out for the reason the switch's id is.
 */
export const freeLessonCount = (skillId: string): number => {
  const raw = SkillStoreAPI.getSkillSetting<unknown>(skillId, "freeLessons", DEFAULT_FREE_LESSONS);
  const value = Math.floor(Number(raw));
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/**
 * The first paid position in a skill, 1-based. `Infinity` when nothing is paid.
 *
 * Positions rather than level numbers, because "level 11" means the eleventh
 * lesson *of this skill* — addition's eleventh lesson is course level 26, and
 * an operator setting a free count is counting the path in front of them.
 */
export const premiumFrom = (skillId: string): number =>
  premiumEnabled(skillId) ? freeLessonCount(skillId) + 1 : Infinity;

/** Where a lesson sits in its own skill, 1-based. Zero when it is not in the course. */
const positionOf = (skillId: string, levelNumber: number): number =>
  getSkillLessons(skillId, ALL_AGES).findIndex((l) => l.levelNumber === levelNumber) + 1;

/** Whether a lesson is one of the paid ones, whatever this family's plan says. */
export const isPremiumLesson = (lesson: { skillId: string; levelNumber: number }): boolean => {
  const from = premiumFrom(lesson.skillId);
  if (from === Infinity) return false;
  const position = positionOf(lesson.skillId, lesson.levelNumber);
  return position > 0 && position >= from;
};

/**
 * Whether a lesson is closed to this family — premium, and not paid for.
 *
 * The question every padlock and every "what next" asks. A family on a plan
 * that includes the feature sees no difference at all.
 */
export const premiumLocked = (lesson: { skillId: string; levelNumber: number }): boolean =>
  isPremiumLesson(lesson) && !Billing.has(PREMIUM_FEATURE);
