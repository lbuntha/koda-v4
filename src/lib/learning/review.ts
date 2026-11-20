import type { AnswerSubmittedEvent, LearningEvent, LessonCompletedEvent } from "./events";
import { SyncEngine } from "../sync";
import { storageKeyFor } from "../sync/kinds";

/**
 * What a child should see again, and when.
 *
 * Two lists, both kept per learner and both derived from the learning log as
 * events arrive:
 *
 *  - **Mistakes.** A lesson where the child got a question wrong on the first
 *    try. It comes back a day later as a *fresh* question from the same lesson
 *    (skills generate their questions, so it is never the same one to
 *    memorise), and counts as fixed after two right first tries on two
 *    different days after the slip. A new slip starts the count again.
 *  - **Topics.** Every concept a child has finished a lesson on, with the day it
 *    is next due. The gap grows each time it is remembered — 1, 3, 7, 14, 30
 *    days — and drops back to one day when a review goes badly. Spacing is the
 *    cheapest way to make practice last.
 *
 * The log itself cannot hold this: its events are a capped ring and a slip from
 * last month has aged out of it. So this is its own small store, never trimmed
 * except when a mistake is fixed.
 *
 * Everything here is a pure function of (store, event) or (store, day), so the
 * rules are testable without storage. Recording happens whatever the family's
 * `reviewEnabled` setting says — it is the same facts the log already keeps —
 * and the setting decides whether Today's plan *offers* any of it.
 */

/** Days until a topic is due again, by how many times it has been remembered. */
export const REVIEW_LADDER = [1, 3, 7, 14, 30] as const;
/** A finished lesson at or above this first-try accuracy moves a topic up the ladder. */
export const REMEMBERED_ACCURACY = 0.8;
/** Below this, the topic goes back to the bottom rung. */
export const FORGOTTEN_ACCURACY = 0.6;
/** Right first tries, on different days, that fix a mistake. */
export const FIX_DAYS = 2;
/** Examples kept per mistake — enough for a grown-up to see the pattern. */
export const MAX_EXAMPLES = 3;

export interface MistakeExample {
  prompt?: string;
  given?: string;
  expected?: string;
  day: string;
}

export interface Mistake {
  /** "skillId/lessonId" — the lesson the fresh question is drawn from. */
  key: string;
  skillId: string;
  lessonId: string;
  activityId: string;
  conceptKey: string;
  levelNumber?: number;
  /** Newest last. */
  examples: MistakeExample[];
  firstDay: string;
  lastWrongDay: string;
  /** How many first-try slips, in total. */
  misses: number;
  /** Days, after the last slip, with a right first try. */
  rightDays: string[];
  dueDay: string;
  /** Epoch ms of the last change; two devices' copies are merged by it. */
  updatedAt?: number;
}

export interface TopicReview {
  conceptKey: string;
  /** The lesson most recently finished on this concept: what a review replays. */
  skillId: string;
  lessonId: string;
  activityId: string;
  levelNumber?: number;
  /** Index into `REVIEW_LADDER`. */
  step: number;
  lastDay: string;
  dueDay: string;
  /** Epoch ms of the last change; two devices' copies are merged by it. */
  updatedAt?: number;
}

export interface FixedMistake {
  key: string;
  conceptKey: string;
  day: string;
}

export interface ReviewStore {
  version: 1;
  mistakes: Record<string, Mistake>;
  topics: Record<string, TopicReview>;
  /** Fixed mistakes, newest last, for the parent's "fixed this week". */
  fixed: FixedMistake[];
}

/** How many fixed mistakes are remembered; a report looks back weeks, not years. */
const MAX_FIXED = 200;

export const emptyStore = (): ReviewStore => ({ version: 1, mistakes: {}, topics: {}, fixed: [] });

/* ---------- days ---------- */

/** "2026-11-20" plus n days, by the calendar, not by 24-hour steps. */
export const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* ---------- the rules ---------- */

/**
 * Admin previews and a skill without a lesson are not a child's practice.
 * Neither is anything with no concept: the store is keyed by it.
 */
const counts = (e: LearningEvent): boolean =>
  e.entry !== "preview" && Boolean(e.lessonId) && Boolean(e.conceptKey) && Boolean(e.localDay);

const keyOf = (e: LearningEvent): string => `${e.skillId}/${e.lessonId}`;

function onAnswer(store: ReviewStore, e: AnswerSubmittedEvent): ReviewStore {
  /* Only the first try speaks: a second try after "try again" is the child
     being taught, not the child remembering. */
  if (e.attempt !== 1) return store;
  const key = keyOf(e);
  const day = e.localDay;
  const current = store.mistakes[key];

  if (!e.correct) {
    const example: MistakeExample = { day };
    if (e.given !== undefined) example.given = e.given;
    if (e.expected !== undefined) example.expected = e.expected;
    const mistake: Mistake = current
      ? {
          ...current,
          examples: [...current.examples, example].slice(-MAX_EXAMPLES),
          lastWrongDay: day,
          misses: current.misses + 1,
          rightDays: [],
          dueDay: addDays(day, 1),
        }
      : {
          key,
          skillId: e.skillId,
          lessonId: e.lessonId,
          activityId: e.activityId,
          conceptKey: e.conceptKey,
          ...(e.levelNumber !== undefined ? { levelNumber: e.levelNumber } : {}),
          examples: [example],
          firstDay: day,
          lastWrongDay: day,
          misses: 1,
          rightDays: [],
          dueDay: addDays(day, 1),
        };
    return { ...store, mistakes: { ...store.mistakes, [key]: mistake } };
  }

  /* Right, unaided, on a later day than the slip: evidence it has stuck.
     The same day proves nothing — the answer is still in the child's head. */
  if (!current || e.supportsUsed > 0 || day <= current.lastWrongDay || current.rightDays.includes(day)) {
    return store;
  }
  const rightDays = [...current.rightDays, day];
  if (rightDays.length >= FIX_DAYS) {
    const { [key]: _done, ...rest } = store.mistakes;
    void _done;
    return {
      ...store,
      mistakes: rest,
      fixed: [...store.fixed, { key, conceptKey: current.conceptKey, day }].slice(-MAX_FIXED),
    };
  }
  return {
    ...store,
    mistakes: { ...store.mistakes, [key]: { ...current, rightDays, dueDay: addDays(day, 2) } },
  };
}

function onCompleted(store: ReviewStore, e: LessonCompletedEvent): ReviewStore {
  if (e.questionsAnswered <= 0) return store;
  const day = e.localDay;
  const current = store.topics[e.conceptKey];
  const accuracy = e.firstTryAccuracy;
  let step: number;
  if (!current) {
    step = 0;
  } else if (accuracy < FORGOTTEN_ACCURACY) {
    step = 0;
  } else if (accuracy >= REMEMBERED_ACCURACY && day >= current.dueDay) {
    /* Only a review taken when it was due moves the topic up. Replaying a
       lesson the same afternoon is practice, not remembering. */
    step = Math.min(current.step + 1, REVIEW_LADDER.length - 1);
  } else {
    step = current.step;
  }
  const dueDay = current && step === current.step && day < current.dueDay
    ? current.dueDay
    : addDays(day, REVIEW_LADDER[step]);
  const topic: TopicReview = {
    conceptKey: e.conceptKey,
    skillId: e.skillId,
    lessonId: e.lessonId,
    activityId: e.activityId,
    ...(e.levelNumber !== undefined ? { levelNumber: e.levelNumber } : {}),
    step,
    lastDay: day,
    dueDay,
  };
  return { ...store, topics: { ...store.topics, [e.conceptKey]: topic } };
}

/** Fold one learning event into a learner's review store. */
export function applyEvent(store: ReviewStore, e: LearningEvent): ReviewStore {
  if (!counts(e)) return store;
  const at = Date.parse(e.ts) || 0;
  if (e.type === "answer_submitted") return stamp(store, onAnswer(store, e), `${e.skillId}/${e.lessonId}`, e.conceptKey, at);
  if (e.type === "lesson_completed") return stamp(store, onCompleted(store, e), `${e.skillId}/${e.lessonId}`, e.conceptKey, at);
  return store;
}

/** Marks the entries an event changed, so a merge knows which copy is newer. */
function stamp(before: ReviewStore, after: ReviewStore, key: string, conceptKey: string, at: number): ReviewStore {
  if (after === before) return after;
  const mistakes = after.mistakes[key] && after.mistakes[key] !== before.mistakes[key]
    ? { ...after.mistakes, [key]: { ...after.mistakes[key], updatedAt: at } }
    : after.mistakes;
  const topics = after.topics[conceptKey] && after.topics[conceptKey] !== before.topics[conceptKey]
    ? { ...after.topics, [conceptKey]: { ...after.topics[conceptKey], updatedAt: at } }
    : after.topics;
  return { ...after, mistakes, topics };
}

/**
 * Two devices' copies of one child's store, joined.
 *
 * Each mistake and topic keeps whichever copy changed last. A mistake one
 * device has since fixed stays fixed: it is dropped if the joined `fixed` list
 * holds it from a day on or after its last slip. The server runs the same
 * rule (`merge_review_progress`); this one is for tests and for the record.
 */
export function mergeStores(a: ReviewStore, b: ReviewStore): ReviewStore {
  const newer = <T extends { updatedAt?: number }>(x: T | undefined, y: T | undefined): T | undefined =>
    !x ? y : !y ? x : (y.updatedAt ?? 0) >= (x.updatedAt ?? 0) ? y : x;
  const seen = new Set<string>();
  const fixed = [...a.fixed, ...b.fixed]
    .filter((f) => {
      const id = `${f.key}@${f.day}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0))
    .slice(-MAX_FIXED);
  const mistakes: Record<string, Mistake> = {};
  for (const key of new Set([...Object.keys(a.mistakes), ...Object.keys(b.mistakes)])) {
    const m = newer(a.mistakes[key], b.mistakes[key])!;
    if (fixed.some((f) => f.key === key && f.day >= m.lastWrongDay)) continue;
    mistakes[key] = m;
  }
  const topics: Record<string, TopicReview> = {};
  for (const key of new Set([...Object.keys(a.topics), ...Object.keys(b.topics)])) {
    topics[key] = newer(a.topics[key], b.topics[key])!;
  }
  return { version: 1, mistakes, topics, fixed };
}

/* ---------- what is due ---------- */

/** Mistakes due on or before `day`, longest-waiting first. */
export const dueMistakes = (store: ReviewStore, day: string): Mistake[] =>
  Object.values(store.mistakes)
    .filter((m) => m.dueDay <= day)
    .sort((a, b) => (a.dueDay === b.dueDay ? b.misses - a.misses : a.dueDay < b.dueDay ? -1 : 1));

/** Topics due on or before `day`, most overdue first. A topic with an open
 *  mistake is left out: the mistake already brings it back. */
export const dueTopics = (store: ReviewStore, day: string): TopicReview[] => {
  const open = new Set(Object.values(store.mistakes).map((m) => m.conceptKey));
  return Object.values(store.topics)
    .filter((t) => t.dueDay <= day && !open.has(t.conceptKey))
    .sort((a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : 0));
};

/** Mistakes fixed on or after `since`. */
export const fixedSince = (store: ReviewStore, since: string): FixedMistake[] =>
  store.fixed.filter((f) => f.day >= since);

/* ---------- storage ---------- */

/** `koda_review_v1__<learnerId>`, the key the sync engine writes pulled copies to. */
const keyFor = (learnerId: string) => storageKeyFor("reviewProgress", learnerId)!;
/* A function, not a constant: this module is loaded by the learning log, which
   the sync engine also loads, so nothing from sync may run at import time. */
const prefix = () => keyFor("");

export function readReview(learnerId: string): ReviewStore {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<ReviewStore>;
    if (parsed?.version !== 1) return emptyStore();
    return {
      version: 1,
      mistakes: parsed.mistakes && typeof parsed.mistakes === "object" ? parsed.mistakes : {},
      topics: parsed.topics && typeof parsed.topics === "object" ? parsed.topics : {},
      fixed: Array.isArray(parsed.fixed) ? parsed.fixed : [],
    };
  } catch {
    return emptyStore();
  }
}

const writeReview = (learnerId: string, store: ReviewStore) => {
  try {
    localStorage.setItem(keyFor(learnerId), JSON.stringify(store));
  } catch {
    /* Full or blocked storage: the log still has the facts; review just waits. */
  }
  /* Sent like a child's Rebus and Trace records, so a parent's device can
     show "fixed this week" and a second tablet picks up the same list. */
  try {
    SyncEngine.recordDoc("reviewProgress", learnerId, store as unknown as Record<string, unknown>, { learnerId });
  } catch {
    /* Offline or signed out: it stays on this device until it can go. */
  }
};

/**
 * Called by the learning log for every event it records.
 *
 * Never throws: a fault here must not cost the child the event itself.
 */
export function recordForReview(e: LearningEvent): void {
  try {
    if (!counts(e) || (e.type !== "answer_submitted" && e.type !== "lesson_completed")) return;
    const before = readReview(e.learnerId);
    const after = applyEvent(before, e);
    if (after !== before) writeReview(e.learnerId, after);
  } catch {
    /* see above */
  }
}

/** Every learner's review store. Used by "reset progress", like the log's own clear. */
export function clearAllReview(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix())) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nothing to clear */
  }
}
