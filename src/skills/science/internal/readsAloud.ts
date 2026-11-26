import lessonsJson from "../lessons.json";

/**
 * Whether a lesson reads its question aloud when the round opens.
 *
 * The spoken prompt is for a child who cannot read yet. Grade 1 science is for
 * ages 6–7, so every Grade 1 lesson speaks; from Grade 3 (age 8) a lesson stays
 * quiet and keeps the speaker button (SKILL_DEVELOPMENT §0.1).
 */
export const READER_AGE = 8;

const youngest = new Map(
  (lessonsJson.lessons as { id: string; ageBand?: number[] }[]).map((l) => [l.id, l.ageBand?.[0]]),
);

export function readsAloud(lessonId: string | undefined): boolean {
  const age = lessonId ? youngest.get(lessonId) : undefined;
  return age === undefined || age < READER_AGE;
}
