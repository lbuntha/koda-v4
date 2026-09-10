/**
 * What a device learned that the server will never be told, event by event.
 *
 * The outbox is a queue with a ceiling, and a ceiling means dropping. A tablet
 * used on a bus for three weeks produces more than the 2000 events it holds, and
 * the oldest went over the side — silently, and for good. The stars and the XP
 * survived that, because those are documents and documents coalesce; what did
 * not survive was the evidence underneath them. The server's per-concept totals
 * are what a parent's screen reads on a second device, and they were quietly
 * short by however much a long journey had produced.
 *
 * The same hole with a different lid on it: history from before a family ever
 * had an account. The ring is capped too, so a child who played for a term
 * before anyone signed up has a rollup covering all of it and events covering
 * the tail — and `installLearningSink`'s backfill can only upload the tail.
 *
 * So: when an event is about to become unsendable, fold it into a running total
 * *first*, and send that instead. It is the same fold the local profile uses
 * (`learningLog.foldConcept`) and the same shape the server keeps, so the two
 * add up. An event is either acknowledged by the server or absorbed here, never
 * both, which is the whole of why this cannot double-count.
 *
 * What is genuinely lost is the event *detail* — which question, in what order,
 * how long it took. That is inherent in any cap and is the right thing to lose:
 * totals are what mastery, the recommender and every report are computed from.
 */

import { foldConcept, foldConcepts, activeLearnerId, learnerId as deviceId } from "../learning/learningLog";
import type { ConceptTotals } from "../learning/learningLog";
import type { LearningEvent } from "../learning/events";
import { SyncEngine } from "./engine";

const STORAGE_KEY = "koda_unsent_totals_v1";

/** Learner id -> concept key -> the totals that learner's dropped events came to. */
type Unsent = Record<string, Record<string, ConceptTotals>>;

const read = (): Unsent => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Unsent) : {};
  } catch {
    return {};
  }
};

const write = (value: Unsent): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A full store must not take a round down. The totals stay in memory for
    // this session and the document has already been queued.
  }
};

/**
 * The document key: one per learner *per device*.
 *
 * Not per learner. This body is cumulative, and the server reads it as "how much
 * this device could not send" — two devices writing one key would each see the
 * other's total as the previous value and post the difference, which subtracts.
 */
const keyFor = (learner: string): string => `${learner}:${deviceId}`;

/**
 * Who this belongs to, as the server should file it.
 *
 * `null` for work done before anyone signed in — the id on those events is the
 * device's own, which names a tablet rather than a child. The push endpoint
 * already re-stamps events like that with whoever the device is signed in as,
 * and a baseline has to be filed the same way or a child's first term would
 * land under an id nothing reads.
 */
const attribute = (learner: string): string | null => (learner === deviceId ? null : learner);

const send = (learner: string, concepts: Record<string, ConceptTotals>): void => {
  SyncEngine.recordDoc(
    "conceptBaseline",
    keyFor(learner),
    { concepts } as unknown as Record<string, unknown>,
    { learnerId: attribute(learner) },
  );
};

export const UnsentTotals = {
  /**
   * Fold events that are never going to be sent, and queue the result.
   *
   * Cumulative: the document is the whole running total, not the delta, so a
   * re-send after a failed acknowledgement is the same document rather than a
   * second helping.
   */
  absorb(events: readonly LearningEvent[]): void {
    if (!events.length) return;

    const unsent = read();
    const touched = new Set<string>();

    for (const event of events) {
      if (!event.conceptKey) continue;
      const learner = event.learnerId || activeLearnerId();
      unsent[learner] = foldConcept(unsent[learner] ?? {}, event);
      touched.add(learner);
    }

    if (!touched.size) return;
    write(unsent);
    for (const learner of touched) send(learner, unsent[learner]);
  },

  /**
   * Add totals that were never events on this device at all.
   *
   * The pre-account case: the rollup remembers a term the ring has long since
   * trimmed. The caller works out what is missing; this only has to add it.
   */
  absorbTotals(learner: string, concepts: Record<string, ConceptTotals>): void {
    const keys = Object.keys(concepts);
    if (!keys.length) return;

    const unsent = read();
    const existing = unsent[learner] ?? {};
    for (const key of keys) {
      const add = concepts[key];
      const into = existing[key];
      existing[key] = into ? mergeTotals(into, add) : add;
    }
    unsent[learner] = existing;
    write(unsent);
    send(learner, existing);
  },

  /**
   * Offer every learner's total again.
   *
   * For the one case a conflict cannot mean what it usually means — see
   * `SyncEngine.flush`. `recordDoc` still compares against what the server is
   * known to hold, so this is a no-op whenever the two already agree.
   */
  resend(): void {
    const unsent = read();
    for (const learner of Object.keys(unsent)) send(learner, unsent[learner]);
  },

  /** Everything this device is holding on behalf of the server. */
  all: (): Unsent => read(),

  clear(): void {
    write({});
  },
};

/** Two sets of totals for one concept, added. Counters sum; days are a union. */
const mergeTotals = (a: ConceptTotals, b: ConceptTotals): ConceptTotals => ({
  conceptKey: a.conceptKey,
  skillIds: [...new Set([...(a.skillIds ?? []), ...(b.skillIds ?? [])])],
  questionsAnswered: a.questionsAnswered + b.questionsAnswered,
  correctFirstTry: a.correctFirstTry + b.correctFirstTry,
  supportsUsed: a.supportsUsed + b.supportsUsed,
  lessonsCompleted: a.lessonsCompleted + b.lessonsCompleted,
  lessonsAbandoned: a.lessonsAbandoned + b.lessonsAbandoned,
  totalResponseMs: a.totalResponseMs + b.totalResponseMs,
  errors: Object.entries(b.errors ?? {}).reduce(
    (into, [kind, count]) => ({ ...into, [kind]: (into[kind] ?? 0) + count }),
    { ...(a.errors ?? {}) } as Record<string, number>,
  ),
  practisedOn: [...new Set([...(a.practisedOn ?? []), ...(b.practisedOn ?? [])])],
  lastSeenTs: a.lastSeenTs > b.lastSeenTs ? a.lastSeenTs : b.lastSeenTs,
});

/**
 * The rollup, less whatever the ring can still prove — what was trimmed away.
 *
 * Counters clamp at zero rather than going negative: a rollup written by an
 * older build may fold slightly differently from the current one, and a
 * negative total sent to the server would subtract from a sibling device's
 * work. The day and skill lists are left whole, because the server unions them
 * and a day counted twice is still one day.
 */
export function trimmedAway(
  profile: Record<string, ConceptTotals>,
  ring: readonly LearningEvent[],
): Record<string, ConceptTotals> {
  const accounted = foldConcepts([...ring]);
  const missing: Record<string, ConceptTotals> = {};

  for (const [key, total] of Object.entries(profile)) {
    const seen = accounted[key];
    const less = (a: number, b: number) => Math.max(0, a - b);
    const remainder: ConceptTotals = {
      conceptKey: key,
      skillIds: total.skillIds ?? [],
      questionsAnswered: less(total.questionsAnswered, seen?.questionsAnswered ?? 0),
      correctFirstTry: less(total.correctFirstTry, seen?.correctFirstTry ?? 0),
      supportsUsed: less(total.supportsUsed, seen?.supportsUsed ?? 0),
      lessonsCompleted: less(total.lessonsCompleted, seen?.lessonsCompleted ?? 0),
      lessonsAbandoned: less(total.lessonsAbandoned, seen?.lessonsAbandoned ?? 0),
      totalResponseMs: less(total.totalResponseMs, seen?.totalResponseMs ?? 0),
      errors: Object.fromEntries(
        Object.entries(total.errors ?? {}).map(([kind, count]) => [
          kind,
          less(count, seen?.errors?.[kind] ?? 0),
        ]),
      ),
      practisedOn: total.practisedOn ?? [],
      lastSeenTs: total.lastSeenTs,
    };

    // Nothing was trimmed for this concept: the ring accounts for all of it.
    const empty =
      remainder.questionsAnswered === 0 &&
      remainder.supportsUsed === 0 &&
      remainder.lessonsCompleted === 0 &&
      remainder.lessonsAbandoned === 0 &&
      Object.values(remainder.errors).every((n) => n === 0);
    if (!empty) missing[key] = remainder;
  }

  return missing;
}
