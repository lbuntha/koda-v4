import lessonsJson from "../lessons.json";

/**
 * Whether a lesson reads its question aloud when the round opens.
 *
 * The spoken prompt is for a child who cannot read the instruction yet. A lesson
 * whose youngest learner is 8 or older stays quiet: reading a scale question or a
 * word problem to a reader takes the reading out of it (SKILL_DEVELOPMENT §0.1).
 * The speaker button stays, for a child stuck on the words rather than the maths.
 * No lesson (a preview with defaults) speaks, as the youngest lessons do.
 */
export const READER_AGE = 8;

const youngest = new Map(
  (lessonsJson.lessons as { id: string; ageBand?: number[] }[]).map((l) => [l.id, l.ageBand?.[0]]),
);

export function readsAloud(lessonId: string | undefined): boolean {
  const age = lessonId ? youngest.get(lessonId) : undefined;
  return age === undefined || age < READER_AGE;
}
