import { SkillStoreAPI, type InstalledSkill } from "../lib/skillStore";
import { skill as counting } from "./counting";
import type { AnyActivityDefinition, Lesson, Skill } from "./types";
import type { Viewer } from "./viewer";
import { releaseStatusOf } from "../lib/skillRegistryApi";

/**
 * Every skill in the build. Adding one is a single import and a single entry —
 * this is the only file outside a skill folder that a new skill touches.
 */
export const SKILLS: Skill[] = [counting];

/**
 * Publish every registered skill into the settings store.
 *
 * The manifest is the single source of truth for a skill's shape; the store
 * owns only persisted user choices. Before this, counting was declared twice —
 * once in the registry as "counting" and again in the store's hardcoded
 * DEFAULT_SKILLS as "counting-mastery" — and the two disagreed about how many
 * features exist.
 *
 * Runs at import time so the Skill Manager and every feature check see the same list
 * regardless of which loads first.
 */
function publishToStore(): void {
  for (const p of SKILLS) {
    const asLearningSkill: InstalledSkill = {
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      category: p.manifest.category,
      author: p.manifest.author,
      iconName: p.manifest.iconName,
      tagline: p.manifest.tagline,
      thumbnail: p.manifest.thumbnail,
      isEnabled: true,
      features: p.features,
      settings: p.settings,
    };
    SkillStoreAPI.registerSkill(asLearningSkill);
  }
}

publishToStore();

export const getSkill = (id: string): Skill | undefined =>
  SKILLS.find((p) => p.manifest.id === id);

/**
 * Resolve an activity reference of the form "skillId/activityId".
 *
 * This flat namespace is the reuse surface: a lesson in any skill may point at
 * any activity, so overlapping pedagogy (counting teaching "making 10") reuses
 * one implementation instead of duplicating it. No cross-folder imports.
 */
export const resolveActivity = (ref: string): AnyActivityDefinition | undefined => {
  const [skillId, activityId] = ref.split("/");
  if (!skillId || !activityId) return undefined;
  return getSkill(skillId)?.activities[activityId];
};

/** Look up a lesson by "skillId/lessonId". */
export const resolveLesson = (ref: string): Lesson | undefined => {
  const [skillId, lessonId] = ref.split("/");
  return getSkill(skillId)?.lessons.find((l) => l.id === lessonId);
};

/** Why a skill is not reaching the learner. `null` means it is. */
export type HiddenReason =
  | "draft"
  | "outside-age-range"
  | "disabled-here"
  | null;

/**
 * The one gate. The sidebar, dashboard and course all resolve visibility here,
 * so a skill cannot be hidden in one place and showing in another.
 *
 *   draft      → developers only
 *   published  → anyone in its audience
 *
 * On top of status, a parent's per-install choice can always switch a skill off.
 */
export function hiddenReason(p: Skill, viewer: Viewer): HiddenReason {
  if (viewer.showAllSkills) return null;
  if (releaseStatusOf(p) === "draft") {
    return viewer.isDeveloper ? null : "draft";
  }
  const [minAge, maxAge] = p.manifest.audience.ages;
  if (viewer.age < minAge || viewer.age > maxAge) return "outside-age-range";

  return isEnabledHere(p) ? null : "disabled-here";
}

export const visibleTo = (p: Skill, viewer: Viewer): boolean =>
  hiddenReason(p, viewer) === null;

/**
 * A skill the store has never seen is enabled by default: its manifest is the
 * source of truth until someone changes it in the Skill Manager. Asking the
 * store about an unknown id returns `false`, which would silently hide a freshly
 * registered skill — and take its lessons out of the course with it.
 */
export function isEnabledHere(p: Skill): boolean {
  const known = SkillStoreAPI.getSkill(p.manifest.id) !== undefined;
  return known ? SkillStoreAPI.isSkillEnabled(p.manifest.id) : true;
}

export const visibleSkills = (viewer: Viewer): Skill[] =>
  SKILLS.filter((p) => visibleTo(p, viewer));

/** All lessons from all visible skills, in registry order. */
export const allLessons = (viewer: Viewer): Lesson[] =>
  visibleSkills(viewer).flatMap((p) => p.lessons);
