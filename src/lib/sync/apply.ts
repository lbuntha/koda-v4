/**
 * Writing a pulled document back into the store that owns it.
 *
 * The store is not asked to cooperate: the document is written to the same
 * `localStorage` key it already reads, then nudged, so it re-reads by the path
 * it uses when this tab changes something itself. That is what keeps sync out
 * of every store's code.
 *
 * Revisions are kept beside the documents rather than inside them, because the
 * body must stay exactly what the store expects — a store that suddenly finds a
 * `rev` field in its settings blob is a store that will one day write it back.
 */

import { ArtStore } from "./artStore";
import { SYNC_KINDS, isDocKind, nudgeKey, storageKeyFor, type DocKind } from "./kinds";

const REV_KEY = "koda_sync_revs_v1";
const CURSOR_KEY = "koda_sync_cursor_v1";
const BODY_KEY = "koda_sync_bodies_v1";

export interface SyncDoc {
  kind: string;
  key: string;
  learnerId?: string | null;
  body: Record<string, unknown>;
  rev: number;
  serverSeq: number;
  deleted?: boolean;
}

type RevMap = Record<string, number>;

const revId = (kind: string, key: string) => `${kind}/${key}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full store must not break a round. The next write tries again.
  }
};

/** What revision this device last saw for a document. `0` means never. */
export const revisionOf = (kind: string, key: string): number =>
  readJson<RevMap>(REV_KEY, {})[revId(kind, key)] ?? 0;

export const rememberRevision = (kind: string, key: string, rev: number): void => {
  const revs = readJson<RevMap>(REV_KEY, {});
  revs[revId(kind, key)] = rev;
  writeJson(REV_KEY, revs);
};

/**
 * The body this device last agreed with the server about.
 *
 * The app re-saves its stores on boot — registering a skill writes the same
 * settings back — and without this every launch would look like an edit,
 * inflating revisions and letting a device that booted with stale state
 * overwrite a change another device had just made.
 */
export const lastSentBody = (kind: string, key: string): string | undefined =>
  readJson<Record<string, string>>(BODY_KEY, {})[revId(kind, key)];

export const rememberBody = (kind: string, key: string, body: unknown): void => {
  const bodies = readJson<Record<string, string>>(BODY_KEY, {});
  bodies[revId(kind, key)] = JSON.stringify(body);
  writeJson(BODY_KEY, bodies);
};

export const cursor = (): number => Number(localStorage.getItem(CURSOR_KEY) ?? 0);
export const rememberCursor = (value: number): void =>
  localStorage.setItem(CURSOR_KEY, String(value));

/**
 * Apply one pulled document.
 *
 * How the body is written is the kind's own `shape`, from the table: `whole`
 * replaces the stored value, while `map` and `list` merge into what the store
 * already holds — a family with two skills must not lose one because the other
 * synced.
 */
export function applyDoc(doc: SyncDoc): boolean {
  if (!isDocKind(doc.kind)) return false;

  const spec = SYNC_KINDS[doc.kind as DocKind];

  if (doc.kind === "art") {
    // Its own store, and asynchronous — the only kind that is. Fire and forget:
    // the revision is remembered below either way, and a failed write means the
    // asset is simply missing until the next pull, not that sync is stuck.
    if (doc.deleted) void ArtStore.remove(doc.key);
    else
      void ArtStore.put({
        id: doc.key,
        markup: String(doc.body.markup ?? ""),
        category: String(doc.body.category ?? "uncategorised"),
        rev: doc.rev,
      });
    rememberRevision(doc.kind, doc.key, doc.rev);
    rememberBody(doc.kind, doc.key, doc.body);
    return true;
  }

  // A learner's document lands under their own key, so two children sharing a
  // tablet do not overwrite each other's record — see `storageKeyFor`.
  const target = storageKeyFor(doc.kind as DocKind, doc.key)!;
  const stored = readJson<Record<string, unknown>>(target, {});

  if (spec.shape === "whole") {
    // Single-document stores: the body *is* the stored value.
    if (doc.deleted) localStorage.removeItem(target);
    else writeJson(target, doc.body);
  } else if (spec.shape === "map") {
    const [skillId, lessonId] = doc.key.split("/");
    const map = { ...(stored as Record<string, Record<string, unknown>>) };
    map[skillId] = { ...(map[skillId] ?? {}) };
    if (doc.deleted) delete map[skillId][lessonId];
    else map[skillId][lessonId] = doc.body;
    writeJson(spec.storageKey, map);
  } else {
    // `skill`: the store keeps an array, one entry per skill.
    const list = Array.isArray(stored) ? (stored as Record<string, unknown>[]) : [];
    const next = list.filter((entry) => entry.id !== doc.key);
    if (!doc.deleted) next.push({ ...doc.body, id: doc.key });
    writeJson(spec.storageKey!, next);
  }

  rememberRevision(doc.kind, doc.key, doc.rev);
  // The pulled body is now what this device agrees with, so re-saving it
  // unchanged must not look like a fresh edit.
  rememberBody(doc.kind, doc.key, doc.body);
  // The kind's own notify nudges the family key; a learner's record has to
  // nudge the key it was actually written to.
  if (spec.scope === "learner") nudgeKey(target);
  else spec.notify();
  return true;
}

export function applyChanges(docs: SyncDoc[], nextCursor: number): number {
  let applied = 0;
  for (const doc of docs) if (applyDoc(doc)) applied += 1;
  rememberCursor(nextCursor);
  return applied;
}
