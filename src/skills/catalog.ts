import type { Catalog, CatalogLesson, CatalogSkill } from "../lib/learning/recommend";
import { getCourseLessons } from "../curriculum";
import { visibleSkills } from "./registry";
import type { Viewer } from "./viewer";

/**
 * The registry, flattened into what the recommender needs.
 *
 * Kept here rather than inside `lib/learning` so the recommender stays free of
 * any dependency on the skill system — it can be unit-tested against a
 * hand-written catalog, and a future server-side recommender can be handed the
 * same JSON shape.
 *
 * Lessons come from the course, not straight from the skills, so that the
 * viewer's age gate and any disabled skill are already applied: the app can
 * never recommend a lesson the learner cannot open.
 */
export function buildCatalog(viewer: Viewer): Catalog {
  const lessons: CatalogLesson[] = getCourseLessons(viewer)
    .filter((l) => Boolean(l.conceptKey))
    .map((l) => ({
      ref: `${l.skillId}/${l.id}`,
      skillId: l.skillId,
      lessonId: l.id,
      title: l.title,
      conceptKey: l.conceptKey as string,
      requires: l.requires ?? [],
      levelNumber: l.levelNumber,
      ageBand: l.ageBand,
    }));

  const skills: CatalogSkill[] = visibleSkills(viewer).map((p) => ({
    skillId: p.manifest.id,
    name: p.manifest.name,
    teaches: p.manifest.teaches ?? [],
    requires: p.manifest.requires ?? [],
    ageBand: p.manifest.audience?.ages,
  }));

  return { lessons, skills };
}
