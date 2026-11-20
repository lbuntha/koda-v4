import type { AnswerSubmittedEvent, LearningEvent, LessonCompletedEvent } from "./events";

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
  if (e.type === "answer_submitted") return onAnswer(store, e);
  if (e.type === "lesson_completed") return onCompleted(store, e);
  return store;
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

const PREFIX = "koda_review_v1:";
const keyFor = (learnerId: string) => `${PREFIX}${learnerId}`;

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
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nothing to clear */
  }
}
