/**
 * What is waiting to reach the server.
 *
 * A queue in `localStorage`, capped. Deliberately not IndexedDB yet: the whole
 * queue is parsed on append, which is fine at this size and would not be once
 * art moves into Mongo or a tablet is shared by a class. That is the signal to
 * move this one file — not before.
 *
 * Events never coalesce. They are the record, and two taps are two facts.
 * (Document mutations will coalesce by key when P2 adds them, because only the
 * latest body of a setting matters.)
 */

import type { LearningEvent } from "../learning/events";

export interface Mutation {
  opId: string;
  kind: string;
  key: string;
  learnerId?: string | null;
  body: Record<string, unknown>;
  baseRev: number;
  deleted?: boolean;
}

const STORAGE_KEY = "koda_outbox_v1";

/**
 * Roughly 65 rounds of full detail — comfortably more than a child produces
 * between connections, and small enough to stay inside a storage quota next to
 * everything else the app keeps.
 */
const MAX_EVENTS = 2000;

interface Outbox {
  events: LearningEvent[];
  mutations: Mutation[];
}

const listeners = new Set<() => void>();
let queue: Outbox = load();

function load(): Outbox {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Outbox) : null;
    if (!parsed || !Array.isArray(parsed.events)) return { events: [], mutations: [] };
    return { events: parsed.events, mutations: parsed.mutations ?? [] };
  } catch {
    return { events: [], mutations: [] };
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // A full or blocked store must not take a round down. The local learning
    // log is still the record; this copy is what is *pending upload*.
  }
  listeners.forEach((fn) => fn());
}

export const Outbox = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  size: (): number => queue.events.length + queue.mutations.length,

  peek: (limit: number): LearningEvent[] => queue.events.slice(0, limit),

  peekMutations: (limit: number): Mutation[] => queue.mutations.slice(0, limit),

  add(events: LearningEvent[]): void {
    if (!events.length) return;
    queue.events.push(...events);
    // Oldest first when trimming: recent work is what a recommendation reads,
    // and the server's rollup already has whatever arrived earlier.
    if (queue.events.length > MAX_EVENTS) {
      queue.events = queue.events.slice(-MAX_EVENTS);
    }
    save();
  },

  /**
   * Queue a document edit.
   *
   * Coalesced by `(kind, key)`: only the latest body of a setting matters, so
   * toggling a feature ten times offline is one op rather than ten. Events do
   * not coalesce — they are the record, and two taps are two facts.
   */
  put(mutation: Mutation): void {
    const at = queue.mutations.findIndex(
      (m) => m.kind === mutation.kind && m.key === mutation.key,
    );
    if (at >= 0) {
      // Keep the *oldest* baseRev: it is the revision this device last agreed
      // with the server about, and the newer edits were made on top of it.
      queue.mutations[at] = { ...mutation, baseRev: queue.mutations[at].baseRev };
    } else {
      queue.mutations.push(mutation);
    }
    save();
  },

  /** Drop what the server accepted, by id. Duplicates count as accepted. */
  ack(ids: string[]): void {
    if (!ids.length) return;
    const done = new Set(ids);
    queue.events = queue.events.filter((event) => !done.has(event.id));
    queue.mutations = queue.mutations.filter((m) => !done.has(m.opId));
    save();
  },

  clear(): void {
    queue = { events: [], mutations: [] };
    save();
  },

  /** Remove learning work while preserving unrelated offline settings edits. */
  clearLearning(): void {
    queue = {
      events: [],
      mutations: queue.mutations.filter(
        (mutation) => mutation.kind !== "progress" && mutation.kind !== "levels",
      ),
    };
    save();
  },
};
