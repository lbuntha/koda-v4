import type { Lesson } from "../skills/types";
import { BASE_LANGUAGE, currentLanguage, hasMessage, translate } from "./i18n";

/**
 * A lesson's child-facing copy, in the language on screen.
 *
 * `lessons.json` is written in English and stays the source. A skill that ships
 * translations puts them in its own catalog under `lessons.<lessonId>.<field>`
 * (see `skills/kit/i18n.ts`), and this swaps them in field by field — a lesson
 * with no Khmer for its `kidTip` keeps the English one rather than losing it.
 */

/** Fields on the lesson itself. */
export const LESSON_TEXT_FIELDS = ["title", "concept", "pedagogyTip"] as const;
/** Fields on `params.play`. `stepByStep` is handled alongside, as `steps.<n>`. */
export const LESSON_PLAY_FIELDS = ["kidTip", "audioPrompt", "targetObjective", "shortDesc", "category"] as const;

export function localizeLesson<T extends Lesson>(skillId: string, lesson: T, language = currentLanguage()): T {
  if (language === BASE_LANGUAGE) return lesson;
  const key = (field: string) => `skills.${skillId}.lessons.${lesson.id}.${field}`;
  const pick = <V,>(field: string, fallback: V): V | string =>
    hasMessage(key(field), language) ? translate(key(field), undefined, language) : fallback;

  const out = { ...lesson } as unknown as Record<string, unknown>;
  for (const field of LESSON_TEXT_FIELDS) out[field] = pick(field, lesson[field]);

  const params = lesson.params as { play?: Record<string, unknown> } | undefined;
  if (params?.play) {
    const play = { ...params.play };
    for (const field of LESSON_PLAY_FIELDS) play[field] = pick(field, play[field]);
    if (Array.isArray(play.stepByStep)) {
      play.stepByStep = (play.stepByStep as unknown[]).map((step, i) => pick(`steps.${i}`, step));
    }
    out.params = { ...params, play };
  }
  return out as unknown as T;
}
