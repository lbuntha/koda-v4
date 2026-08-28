import type { ErrorKind } from "./events";
import { type ConceptTotals, LearningLog } from "./learningLog";

/**
 * Turning the log into a judgement about a concept.
 *
 * The thresholds below are the pedagogy, so they live in one named place rather
 * than scattered through the UI as magic numbers. They are tuned for 5–6 year
 * olds: short rounds, high tolerance for slow answers, and a strong preference
 * for evidence gathered on more than one day.
 */

export type MasteryStatus = "not-started" | "learning" | "practising" | "mastered" | "struggling";

export interface ConceptMastery {
  conceptKey: string;
  status: MasteryStatus;
  /** Right first time, unaided, over first attempts. 0..1. */
  firstTryAccuracy: number;
  questionsAnswered: number;
  lessonsCompleted: number;
  /** Help taken per question answered. High + accurate means "not yet solo". */
  supportRate: number;
  averageResponseMs: number;
  /** Distinct days practised — spacing, which predicts retention. */
  daysPractised: number;
  /** Most frequent error kinds, commonest first. Drives the "why" of advice. */
  topErrors: { kind: ErrorKind; count: number }[];
  lastSeenTs?: string;
}

/** Below this many first attempts, any accuracy figure is noise. */
export const MIN_EVIDENCE = 8;

/** Unaided first-try accuracy needed to call a concept mastered. */
export const MASTERY_ACCURACY = 0.85;

/** Practise on at least this many separate days before claiming mastery. */
export const MASTERY_DAYS = 2;

/** Below this, the child is not making progress and needs a different approach. */
export const STRUGGLING_ACCURACY = 0.5;

/**
 * Read one concept's totals as a judgement about the learner.
 *
 * Pure, and exported, because two different callers need the *same* answer:
 * the child's own device reading its local log, and a parent's screen reading
 * the server's rollup for a child who plays on another tablet. The rollup folds
 * events exactly the way the log does — `docs/ARCHITECTURE.md` §5 states that
 * as a contract — so the same thresholds may be applied to either.
 *
 * A second implementation of these thresholds, anywhere, is how the app and a
 * parent come to disagree about the same child.
 */
export const masteryFrom = (t: ConceptTotals): ConceptMastery => {
  const answered = t.questionsAnswered;
  const firstTryAccuracy = answered > 0 ? t.correctFirstTry / answered : 0;
  const topErrors = Object.entries(t.errors)
    .map(([kind, count]) => ({ kind: kind as ErrorKind, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  let status: MasteryStatus;
  if (answered === 0) {
    status = "not-started";
  } else if (answered < MIN_EVIDENCE) {
    // Not enough evidence to judge either way — but a child who has already
    // abandoned twice is telling us something a small sample doesn't hide.
    status = t.lessonsAbandoned >= 2 ? "struggling" : "learning";
  } else if (firstTryAccuracy < STRUGGLING_ACCURACY) {
    status = "struggling";
  } else if (
    firstTryAccuracy >= MASTERY_ACCURACY &&
    t.lessonsCompleted >= 1 &&
    t.practisedOn.length >= MASTERY_DAYS
  ) {
    status = "mastered";
  } else {
    status = "practising";
  }

  return {
    conceptKey: t.conceptKey,
    status,
    firstTryAccuracy,
    questionsAnswered: answered,
    lessonsCompleted: t.lessonsCompleted,
    supportRate: answered > 0 ? t.supportsUsed / answered : 0,
    averageResponseMs: answered > 0 ? Math.round(t.totalResponseMs / answered) : 0,
    daysPractised: t.practisedOn.length,
    topErrors,
    lastSeenTs: t.lastSeenTs,
  };
};

const NOT_STARTED = (conceptKey: string): ConceptMastery => ({
  conceptKey,
  status: "not-started",
  firstTryAccuracy: 0,
  questionsAnswered: 0,
  lessonsCompleted: 0,
  supportRate: 0,
  averageResponseMs: 0,
  daysPractised: 0,
  topErrors: [],
});

/** Mastery for one concept. Never undefined — "not started" is a real answer. */
export const getConceptMastery = (conceptKey: string): ConceptMastery => {
  const totals = LearningLog.totals(conceptKey);
  return totals ? masteryFrom(totals) : NOT_STARTED(conceptKey);
};

/** Every concept the learner has touched. */
export const getAllMastery = (): ConceptMastery[] =>
  Object.values(LearningLog.profile().concepts).map(masteryFrom);

export const isMastered = (conceptKey: string): boolean =>
  getConceptMastery(conceptKey).status === "mastered";
