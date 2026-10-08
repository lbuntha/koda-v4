import { useEffect, useSyncExternalStore } from "react";
import { SkillStoreAPI, type InstalledSkill } from "../lib/skillStore";
import { describeSkill } from "./describe";
import type { AnyActivityDefinition, Lesson, Skill, SkillInfo } from "./types";
import type { Viewer } from "./viewer";
import { releaseStatusOf } from "../lib/skillRegistryApi";

/**
 * Every skill in the build, in course order. Adding one is a single entry here
 * and a folder with a manifest.json, lessons.json and index.ts.
 */
const SKILL_IDS = [
  "counting", "addition", "subtraction", "multiplication", "division",
  "fractions", "observation", "bottle-sort", "color-sweeper",
] as const;

/*
 * Two halves of every skill, loaded at different times.
 *
 * The descriptions are two small JSON files each, read eagerly: the course,
 * the catalog, Home and the Skill Manager all need every skill's lessons and
 * manifest before anything is played. The games — every activity, its art and
 * its recorded voice — are `index.ts`, and are fetched only when a round or a
 * worksheet needs them. They used to be in the first download: a third of the
 * app's entry bundle was activities a child had not opened.
 *
 * Offline is unaffected: the service worker precaches every chunk, so a skill
 * fetched on demand comes from the cache with no network.
 */
const manifests = import.meta.glob<Parameters<typeof describeSkill>[0]>("./*/manifest.json", { eager: true, import: "default" });
const lessonFiles = import.meta.glob<{ lessons: unknown }>("./*/lessons.json", { eager: true, import: "default" });
const modules = import.meta.glob<{ skill: Skill }>("./*/index.ts");

export const SKILLS: SkillInfo[] = SKILL_IDS.map((id) =>
  describeSkill(manifests[`./${id}/manifest.json`], lessonFiles[`./${id}/lessons.json`]),
);

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

export const getSkill = (id: string): SkillInfo | undefined =>
  SKILLS.find((p) => p.manifest.id === id);

const loaded = new Map<string, Skill>();
const loading = new Map<string, Promise<Skill | undefined>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

/** The whole skill, games included, fetched once and kept. Unknown ids resolve to undefined. */
export function loadSkill(id: string): Promise<Skill | undefined> {
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  const load = modules[`./${id}/index.ts`];
  if (!getSkill(id) || !load) return Promise.resolve(undefined);
  let pending = loading.get(id);
  if (!pending) {
    pending = load().then(
      ({ skill }) => {
        loaded.set(id, skill);
        failed.delete(id);
        version += 1;
        listeners.forEach((fn) => fn());
        return skill;
      },
      (error: unknown) => {
        // Forgotten, so the next ask retries rather than repeating the failure.
        loading.delete(id);
        failed.add(id);
        version += 1;
        listeners.forEach((fn) => fn());
        throw error;
      },
    );
    loading.set(id, pending);
  }
  return pending;
}

/**
 * Whether the last attempt to fetch a skill failed — offline on a device that
 * has not yet cached it. Cleared by the next `loadSkill` that succeeds.
 */
export const skillLoadFailed = (id: string): boolean => failed.has(id);

/** The whole skill if it has already been loaded, without asking for it. */
export const loadedSkill = (id: string): Skill | undefined => loaded.get(id);

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/**
 * The whole skill for a component: starts the download and re-renders when it
 * lands. `undefined` until then — and for good, when the id is not a skill.
 */
export function useLoadedSkill(id: string | null | undefined): Skill | undefined {
  useLoadedSkills(id ? [id] : []);
  return id ? loaded.get(id) : undefined;
}

/** `useLoadedSkill` for several at once — the skills behind a page of lessons. */
export function useLoadedSkills(ids: readonly string[]): void {
  useSyncExternalStore(subscribe, () => version, () => version);
  const key = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    for (const id of key ? key.split(",") : []) void loadSkill(id).catch(() => {});
  }, [key]);
}

/**
 * Resolve an activity reference of the form "skillId/activityId", from a skill
 * already loaded — see `useLoadedSkill`.
 *
 * This flat namespace is the reuse surface: a lesson in any skill may point at
 * any activity, so overlapping pedagogy (counting teaching "making 10") reuses
 * one implementation instead of duplicating it. No cross-folder imports.
 */
export const resolveActivity = (ref: string): AnyActivityDefinition | undefined => {
  const [skillId, activityId] = ref.split("/");
  if (!skillId || !activityId) return undefined;
  return loaded.get(skillId)?.activities[activityId];
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
export function hiddenReason(p: SkillInfo, viewer: Viewer): HiddenReason {
  if (viewer.showAllSkills) return null;
  if (releaseStatusOf(p) === "draft") {
    // A draft is a developer preview, and previewing it ignores the audience
    // band. It does not ignore the parent's switch: returning early here left a
    // skill turned off in the Skill Manager still filling the Learn page.
    if (!viewer.isDeveloper) return "draft";
  } else {
    const [minAge, maxAge] = p.manifest.audience.ages;
    if (viewer.age < minAge || viewer.age > maxAge) return "outside-age-range";
  }

  return isEnabledHere(p) ? null : "disabled-here";
}

export const visibleTo = (p: SkillInfo, viewer: Viewer): boolean =>
  hiddenReason(p, viewer) === null;

/**
 * A skill the store has never seen is enabled by default: its manifest is the
 * source of truth until someone changes it in the Skill Manager. Asking the
 * store about an unknown id returns `false`, which would silently hide a freshly
 * registered skill — and take its lessons out of the course with it.
 */
export function isEnabledHere(p: SkillInfo): boolean {
  const known = SkillStoreAPI.getSkill(p.manifest.id) !== undefined;
  return known ? SkillStoreAPI.isSkillEnabled(p.manifest.id) : true;
}

export const visibleSkills = (viewer: Viewer): SkillInfo[] =>
  SKILLS.filter((p) => visibleTo(p, viewer));

