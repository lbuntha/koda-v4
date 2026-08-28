import type { ResolvedLesson } from "../curriculum";
import type { ReleaseStatus } from "../skills/types";

export interface RecommendationSignals {
  ageRelevance: number;
  meaningfulPlays: number;
  completionRate: number;
  recentPopularity: number;
  freshness: number;
}

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
  recommendationScore?: number;
}

export interface SkillCatalogSource
  extends Omit<
    SkillCatalogEntry,
    "completedLessons" | "progressPercent" | "nextLesson" | "recommendationScore"
  > {
  recommendationSignals?: RecommendationSignals;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

/** Inputs are normalized to 0–100 by server rollups before reaching the catalog. */
export function totalRecommendationScore(signals: RecommendationSignals): number {
  return Math.round(
    (clampScore(signals.ageRelevance) * 0.3 +
      clampScore(signals.meaningfulPlays) * 0.25 +
      clampScore(signals.completionRate) * 0.2 +
      clampScore(signals.recentPopularity) * 0.15 +
      clampScore(signals.freshness) * 0.1) *
      100,
  ) / 100;
}

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
        recommendationScore: source.recommendationSignals
          ? totalRecommendationScore(source.recommendationSignals)
          : undefined,
      };
    });
}

/** Deterministic offline fallback. Real server scores win whenever available. */
export function recommendedSkills(entries: SkillCatalogEntry[]): SkillCatalogEntry[] {
  return [...entries].sort((a, b) => {
    const scoreDifference = (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1);
    if (scoreDifference !== 0) return scoreDifference;
    const progressDifference = b.progressPercent - a.progressPercent;
    if (progressDifference !== 0) return progressDifference;
    return a.name.localeCompare(b.name);
  });
}

/** Newest server publication/update first; registry insertion order is the offline LIFO fallback. */
export function newestSkills(entries: SkillCatalogEntry[], limit = 2): SkillCatalogEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const timeDifference =
        (b.entry.publishedAt ?? b.entry.modified ?? 0) -
        (a.entry.publishedAt ?? a.entry.modified ?? 0);
      return timeDifference || b.index - a.index;
    })
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
