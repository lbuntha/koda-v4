import { BASE_LANGUAGE, registerMessages, translate, type TranslateVars } from "../../lib/i18n";
import { LESSON_PLAY_FIELDS, LESSON_QUESTION_LISTS, LESSON_TEXT_FIELDS } from "../../lib/lessonText";

/**
 * A skill's own words, in every language it ships a catalog for.
 *
 * The pattern, the same for every skill:
 *
 *   my-skill/
 *     locales/en.json   ← every line the activities say or show
 *     locales/km.json   ← the same keys, translated (plus `lessons.*`, below)
 *     internal/i18n.ts  ← `export const { t, listAnd } = skillLocales("my-skill")`
 *
 * Every skill's catalogs are registered here, eagerly, under
 * `skills.<skillId>.*` — not when the skill's own code loads. A skill's code is
 * fetched only when a round opens, but its lesson titles are on the Learn page
 * and its lines on the Translations page long before that. Adding a language is
 * adding a file: the glob finds it.
 *
 * Lesson copy is not duplicated into `en.json` — `lessons.json` stays its
 * source. Its child-facing fields are registered as English from there, under
 * `skills.<skillId>.lessons.<lessonId>.*`, and a translation only has to supply
 * the same keys under `lessons` in its own catalog. `withLessonEdits` reads them
 * when it resolves a lesson, for every skill alike.
 */

type Tree = { [key: string]: string | Tree };

interface LessonLike {
  id: string;
  title?: string;
  concept?: string;
  pedagogyTip?: string;
  params?: unknown;
}

/** `lessons.json`'s child-facing copy as a catalog tree, keyed by lesson id. */
export function lessonCatalog(lessons: readonly LessonLike[]): Tree {
  const out: Tree = {};
  for (const lesson of lessons) {
    const play = (lesson.params as { play?: Record<string, unknown> } | undefined)?.play ?? {};
    const entry: Tree = {};
    const put = (key: string, value: unknown) => {
      if (typeof value === "string" && value.trim()) entry[key] = value;
    };
    for (const key of LESSON_TEXT_FIELDS) put(key, lesson[key]);
    for (const key of LESSON_PLAY_FIELDS) put(key, play[key]);
    const steps = Array.isArray(play.stepByStep) ? play.stepByStep : [];
    const stepTree: Tree = {};
    steps.forEach((step, i) => {
      if (typeof step === "string" && step.trim()) stepTree[String(i)] = step;
    });
    if (Object.keys(stepTree).length) entry.steps = stepTree;

    const prompts: Tree = {};
    for (const [name, line] of Object.entries((play.prompts as Record<string, unknown> | undefined) ?? {})) {
      if (typeof line === "string" && line.trim()) prompts[name] = line;
    }
    if (Object.keys(prompts).length) entry.prompts = prompts;

    const question = (lesson.params as { question?: Record<string, unknown> } | undefined)?.question ?? {};
    const lists: Tree = {};
    for (const list of LESSON_QUESTION_LISTS) {
      const lines = Array.isArray(question[list]) ? (question[list] as unknown[]) : [];
      const tree: Tree = {};
      lines.forEach((line, i) => {
        if (typeof line === "string" && line.trim()) tree[String(i)] = line;
      });
      if (Object.keys(tree).length) lists[list] = tree;
    }
    if (Object.keys(lists).length) entry.question = lists;
    out[lesson.id] = entry;
  }
  return out;
}

/** Every skill's catalogs and lesson files, keyed `../<skill>/…`. */
const catalogs = import.meta.glob<Tree>("../*/locales/*.json", { eager: true, import: "default" });
const lessonFiles = import.meta.glob<{ lessons: LessonLike[] }>("../*/lessons.json", { eager: true, import: "default" });

for (const [path, tree] of Object.entries(catalogs)) {
  const [, skillId, code] = path.match(/^\.\.\/([^/]+)\/locales\/([^/]+)\.json$/) ?? [];
  if (!skillId || !code) continue;
  const own: Tree = { ...tree };
  const lessons = lessonFiles[`../${skillId}/lessons.json`]?.lessons;
  if (code === BASE_LANGUAGE && lessons) own.lessons = lessonCatalog(lessons);
  registerMessages(code, { skills: { [skillId]: own } });
}

export interface SkillLocales {
  /** One of this skill's lines, in the language on screen. */
  t(key: string, vars?: TranslateVars): string;
  /** "a, b and c", joined the way the language on screen joins a list. */
  listAnd(items: string[]): string;
}

/**
 * A skill's `t`. The catalogs themselves are already registered (above); a
 * catalog that wants `listAnd` defines `listAnd: "{a} and {b}"`.
 */
export function skillLocales(skillId: string): SkillLocales {
  const t = (key: string, vars?: TranslateVars) => translate(`skills.${skillId}.${key}`, vars);
  return {
    t,
    listAnd: (items) =>
      items.length <= 1 ? (items[0] ?? "") : t("listAnd", { a: items.slice(0, -1).join(", "), b: items[items.length - 1] }),
  };
}
