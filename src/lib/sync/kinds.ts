/**
 * Which local store owns each kind of synced document.
 *
 * One table, deliberately. Without it, "apply a pulled document" becomes a
 * switch statement that every new setting has to remember to update — the same
 * reason the skill registry exists. Adding a synced setting is one row here.
 *
 * Every entry maps a `kind` to the `localStorage` key the store already reads
 * and the notify it already calls, so applying a change from another device
 * updates the UI by the path the app uses anyway.
 */

export type DocKind =
  | "skill"
  | "lessonContent"
  | "progress"
  | "levels"
  | "goals"
  | "preferences"
  | "nav"
  | "art"
  | "childSettings";

export interface KindSpec {
  /**
   * The key the owning store reads.
   *
   * `null` for a kind whose store is not `localStorage` — art lives in
   * IndexedDB, because SVG markup would exhaust the quota everything else
   * shares. `apply.ts` routes those by kind instead.
   */
  storageKey: string | null;
  /**
   * Whose document this is.
   *
   * `family` settings are shared by everyone — skill toggles, lesson wording,
   * scoring. `learner` documents belong to one child, and are keyed by their id.
   */
  scope: "family" | "learner";
  /**
   * How the owning store holds the body.
   *
   * This used to be a list inside `apply.ts`, which quietly made this table a
   * half-truth: adding a setting was one row *here* and one entry *there*, and
   * forgetting the second wrote a document into the wrong shape rather than
   * failing. Naming it here is what makes the sentence above true.
   *
   * `whole` — the body *is* the stored value: one document, one key.
   * `map`   — merged into a nested map the store keeps, keyed by the doc key.
   * `list`  — an array of entries carrying their own `id`.
   */
  shape: "whole" | "map" | "list";
  /** Nudges the store to re-read after a pulled change lands. */
  notify: () => void;
}

/** The `storage` event only fires in *other* tabs, so this one is nudged by hand. */
export const nudgeKey = (key: string): void => {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: localStorage.getItem(key) }));
};

const nudge = (key: string) => () => nudgeKey(key);

/**
 * The key a document actually lands under on this device.
 *
 * Family documents are one per family, so the kind's key is the whole answer.
 * A learner's is not: one tablet is used by every child in the household in
 * turn, and while their records shared `koda_learner_progress_v1` the second
 * child to sign in inherited the first one's XP, stars and streak — and then
 * synced them back up under their own name. The learner id is part of the key
 * for the same reason it is part of the document.
 */
export const storageKeyFor = (kind: DocKind, docKey: string): string | null => {
  const spec = SYNC_KINDS[kind];
  if (!spec.storageKey) return null;
  return spec.scope === "learner" ? `${spec.storageKey}__${docKey}` : spec.storageKey;
};

export const SYNC_KINDS: Record<DocKind, KindSpec> = {
  skill: {
    storageKey: "koda_learning_skills_v2",
    scope: "family",
    shape: "list",
    notify: nudge("koda_learning_skills_v2"),
  },
  lessonContent: {
    storageKey: "koda_lesson_content_v1",
    scope: "family",
    shape: "map",
    notify: nudge("koda_lesson_content_v1"),
  },
  progress: {
    storageKey: "koda_learner_progress_v1",
    scope: "learner",
    shape: "whole",
    notify: nudge("koda_learner_progress_v1"),
  },
  levels: {
    storageKey: "koda_completed_levels_v1",
    scope: "learner",
    shape: "whole",
    notify: nudge("koda_completed_levels_v1"),
  },
  // How many rounds a day this learner is aiming for. A learner document a
  // *parent* writes, which is exactly why it is not a field in `progress`:
  // their device has no truthful progress record for the child to send.
  goals: {
    storageKey: "koda_daily_goal_v1",
    scope: "learner",
    shape: "whole",
    notify: nudge("koda_daily_goal_v1"),
  },
  // Sound, voice and theme. Family-scoped on purpose: a parent setting these
  // once should hold on the tablet the child actually uses.
  preferences: {
    storageKey: "koda_preferences_v1",
    scope: "family",
    shape: "whole",
    notify: nudge("koda_preferences_v1"),
  },
  // The sidebar, when a family has customised it. The bundled JSON is still
  // what a fresh install draws, so a first run needs no server.
  nav: {
    storageKey: "koda_sidebar_nav_v1",
    scope: "family",
    shape: "whole",
    notify: nudge("koda_sidebar_nav_v1"),
  },
  // The exception the table exists to absorb: same sync machinery, different
  // store. Nothing else in the app has to know.
  art: {
    storageKey: null,
    scope: "family",
    // Routed by kind before shape is consulted — IndexedDB, not localStorage.
    shape: "whole",
    notify: () => undefined,
  },

  /*
   * What a parent decides for one child: a time cap, whether Koda's help is
   * offered, how the goal is counted, where they start.
   *
   * Learner-scoped, so it lands under that child's key and reaches the tablet
   * they actually use — which is where every one of those rules is enforced,
   * with or without a connection. The server holds the matching half: writing
   * it needs `learner:update`, which a parent has over any of their children,
   * a student has over only themselves, and a child does not have at all.
   *
   * Deliberately one document rather than a kind per control. Everything a
   * parent may set for a child is a *field* in this body, so the next one costs
   * nothing here.
   */
  childSettings: {
    storageKey: "koda_child_settings_v1",
    scope: "learner",
    shape: "whole",
    notify: nudge("koda_child_settings_v1"),
  },
};

export const isDocKind = (value: string): value is DocKind => value in SYNC_KINDS;
