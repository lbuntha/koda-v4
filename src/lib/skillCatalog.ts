import type { ResolvedLesson } from "../curriculum";
import type { ReleaseStatus } from "../skills/types";

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  tagline: string;
  thumbnail?: string;
  iconName?: string;
  author?: string;
  version?: string;
  category: string;
  ages?: [number, number];
  status: ReleaseStatus;
  publishedAt?: number | null;
  modified?: number;
  lessons: ResolvedLesson[];
  completedLessons: number;
  progressPercent: number;
  nextLesson: ResolvedLesson;
}

export type SkillCatalogSource = Omit<
  SkillCatalogEntry,
  "completedLessons" | "progressPercent" | "nextLesson"
>;

export function buildSkillCatalog(
  sources: SkillCatalogSource[],
  completedLevels: Record<number, number>,
): SkillCatalogEntry[] {
  return sources
    .filter((source) => source.lessons.length > 0)
    .map((source) => {
      const completedLessons = source.lessons.filter(
        (lesson) => (completedLevels[lesson.levelNumber] ?? 0) > 0,
      ).length;
      const nextLesson =
        source.lessons.find((lesson) => (completedLevels[lesson.levelNumber] ?? 0) === 0) ??
        source.lessons[source.lessons.length - 1];

      return {
        ...source,
        completedLessons,
        progressPercent: Math.round((completedLessons / source.lessons.length) * 100),
        nextLesson,
      };
    });
}

/** When a deployment last touched a skill. Publication wins; an edit is the fallback. */
const updatedAt = (entry: SkillCatalogEntry): number => entry.publishedAt ?? entry.modified ?? 0;

/**
 * Where a skill stands with this learner. The Learn page's first sort key.
 *
 * Three states, not a score. "Started and unfinished" is the only one a learner
 * has an open question about, so it leads; a skill nobody has opened is an
 * offer; a finished one is a record of work done and belongs at the bottom
 * rather than at the top of a list of things to do.
 */
const standing = (entry: SkillCatalogEntry): 0 | 1 | 2 => {
  if (entry.progressPercent >= 100) return 2;
  return entry.completedLessons > 0 ? 0 : 1;
};

/**
 * The Learn page's order: what is on the go, then what changed most recently.
 *
 * This replaced a "Recommended for you" shelf, and the weighted score behind
 * it. Two things were wrong with that. The score read five signals a server
 * rollup was meant to supply and none of them ever arrived — nothing in the app
 * built a catalog source carrying them — so every entry scored `undefined` and
 * the shelf silently fell through to "most progressed first", putting the skill
 * a child had nearly finished above the one they are in the middle of. And a
 * recommendation is a claim about what a learner should do next; the catalogue
 * is a shelf they are browsing, and a shelf only has to be in a sensible order.
 * What is worth recommending is decided in `lib/learning/recommend.ts`, from
 * evidence, and offered on Home where a child is asking "what now?".
 *
 * Ties break on the name so the page does not reshuffle between renders when a
 * deployment carries no timestamps at all.
 */
export function learnOrder(entries: SkillCatalogEntry[]): SkillCatalogEntry[] {
  return [...entries].sort(
    (a, b) =>
      standing(a) - standing(b) ||
      updatedAt(b) - updatedAt(a) ||
      a.name.localeCompare(b.name),
  );
}

/** Newest server publication/update first; registry insertion order is the offline LIFO fallback. */
export function newestSkills(entries: SkillCatalogEntry[], limit = 2): SkillCatalogEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => updatedAt(b.entry) - updatedAt(a.entry) || b.index - a.index)
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => entry);
}

export function filterSkillCatalog(
  entries: SkillCatalogEntry[],
  query: string,
  category: string,
): SkillCatalogEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (!needle) return true;
    return [entry.name, entry.tagline, entry.description, entry.category, entry.author]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(needle));
  });
}
