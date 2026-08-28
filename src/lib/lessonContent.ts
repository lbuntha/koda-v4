import type { Lesson } from "../skills/types";
import { queueLocalSkillConfiguration } from "./skillRegistryApi";

/**
 * Lesson wording, editable in the app.
 *
 * The lesson file stays the source: it is versioned with the code and is what a
 * fresh install ships. What a teacher changes here is an overlay — the title, the
 * concept line, the teaching note and the prompts a child reads — saved on this
 * device and applied over the file wherever a lesson is resolved.
 *
 * Deliberately not everything: `conceptKey`, standards, ages and params decide
 * how the app behaves and what a child's record means. Those stay in the file,
 * where a change is reviewed.
 */

export interface LessonContentOverride {
  title?: string;
  concept?: string;
  pedagogyTip?: string;
  /** Keyed the same way the lesson's own `params.play.prompts` is. */
  prompts?: Record<string, string>;
}

/** skillId → lessonId → what was changed. */
type Store = Record<string, Record<string, LessonContentOverride>>;

const STORAGE_KEY = "koda_lesson_content_v1";

const listeners = new Set<() => void>();
let version = 0;

const load = (): Store => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
};

let store: Store = load();

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    // Mongo owns the complete skill configuration. One queued snapshot per
    // skill coalesces repeated offline wording edits without losing siblings.
    for (const skillId of Object.keys(store)) queueLocalSkillConfiguration(skillId);
  } catch {
    // A blocked store must not take the app down: the edit applies for this
    // session and simply does not survive a reload.
  }
  version += 1;
  for (const cb of listeners) cb();
};

// Server registry hydration writes the offline snapshot directly. Re-read it
// in this tab so lesson lists and running rounds see the deployed wording now.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    store = load();
    version += 1;
    for (const cb of listeners) cb();
  });
}

/** Drops blanks, so clearing a field falls back to the lesson file. */
const clean = (patch: LessonContentOverride): LessonContentOverride => {
  const out: LessonContentOverride = {};
  if (patch.title?.trim()) out.title = patch.title.trim();
  if (patch.concept?.trim()) out.concept = patch.concept.trim();
  if (patch.pedagogyTip?.trim()) out.pedagogyTip = patch.pedagogyTip.trim();
  if (patch.prompts) {
    const prompts: Record<string, string> = {};
    for (const [key, text] of Object.entries(patch.prompts)) {
      if (text.trim()) prompts[key] = text.trim();
    }
    if (Object.keys(prompts).length > 0) out.prompts = prompts;
  }
  return out;
};

export const LessonContentAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  get(skillId: string, lessonId: string): LessonContentOverride | undefined {
    return store[skillId]?.[lessonId];
  },

  isEdited(skillId: string, lessonId: string): boolean {
    const edit = store[skillId]?.[lessonId];
    return Boolean(edit && Object.keys(edit).length > 0);
  },

  set(skillId: string, lessonId: string, patch: LessonContentOverride): void {
    const merged = clean({ ...store[skillId]?.[lessonId], ...patch });
    store = {
      ...store,
      [skillId]: { ...(store[skillId] ?? {}), [lessonId]: merged },
    };
    persist();
  },

  reset(skillId: string, lessonId: string): void {
    const forSkill = { ...(store[skillId] ?? {}) };
    delete forSkill[lessonId];
    store = { ...store, [skillId]: forSkill };
    persist();
  },
};

/**
 * A lesson as it should be read, file plus any edit.
 *
 * Applied wherever a lesson is resolved rather than at each display, so the
 * Learn page, the round and the log cannot disagree about what a lesson says.
 */
export function withLessonEdits<T extends Lesson>(skillId: string, lesson: T): T {
  const edit = LessonContentAPI.get(skillId, lesson.id);
  if (!edit) return lesson;

  const params = lesson.params as { play?: { prompts?: Record<string, string> } } | undefined;
  return {
    ...lesson,
    title: edit.title ?? lesson.title,
    concept: edit.concept ?? lesson.concept,
    pedagogyTip: edit.pedagogyTip ?? lesson.pedagogyTip,
    ...(edit.prompts && params?.play
      ? {
          params: {
            ...lesson.params,
            play: { ...params.play, prompts: { ...params.play.prompts, ...edit.prompts } },
          },
        }
      : {}),
  };
}

/**
 * The edited fields, shaped the way `lessons.json` holds them.
 *
 * The app is where wording is drafted and the file is where it is committed —
 * this is what closes that loop, so a change that works in a round can be pasted
 * into the lesson rather than retyped from a screenshot.
 *
 * Only the fields that were actually changed appear, so what you paste is a
 * patch to read against the lesson, not a wall of unchanged text.
 */
export function editsAsLessonJson(skillId: string, lessonId: string): string | null {
  const edit = LessonContentAPI.get(skillId, lessonId);
  if (!edit || Object.keys(edit).length === 0) return null;

  const out: Record<string, unknown> = { id: lessonId };
  if (edit.title) out.title = edit.title;
  if (edit.concept) out.concept = edit.concept;
  if (edit.pedagogyTip) out.pedagogyTip = edit.pedagogyTip;
  // Nested exactly as the lesson file nests it, so the paste target is obvious.
  if (edit.prompts) out.params = { play: { prompts: edit.prompts } };

  return JSON.stringify(out, null, 2);
}
