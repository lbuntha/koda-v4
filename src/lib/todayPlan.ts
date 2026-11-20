import type { LearningEvent } from "./learning/events";
import { dueMistakes, dueTopics, type ReviewStore } from "./learning/review";

/**
 * Today's plan: a short, ordered list of what to do today.
 *
 * One review that is due, up to two mistakes to fix, one new lesson, and a book
 * and some writing when there are picks for them. Ten minutes or so for a
 * young child — long enough to move forward, short enough to finish.
 *
 * The plan is frozen for the day once built. Without that it would reshuffle
 * under the child: finishing the new lesson makes the recommender pick a newer
 * one, and the step they just ticked would disappear instead of staying ticked.
 *
 * Which steps are done is never stored; it is read off the learning log, so a
 * step done from anywhere in the app — the path, a subject page — ticks here.
 */

export type PlanStepKind = "review" | "fix" | "new" | "continue" | "read" | "write" | "puzzle";

export interface PlanStep {
  kind: PlanStepKind;
  /** "skillId/lessonId" for the three lesson kinds. */
  ref?: string;
  bookId?: string;
  collectionId?: string;
  /** Snapshot for a book or collection; lessons are titled live by the caller. */
  title?: string;
}

export interface TodayPlan {
  day: string;
  /** ISO; only work after this counts as doing the plan. */
  createdAt: string;
  /** Whether review steps were allowed when it was built. */
  reviewOn: boolean;
  /** Back after a break: the card says hello and the plan starts gently. */
  welcomeBack?: boolean;
  steps: PlanStep[];
}

export const MAX_FIX_STEPS = 2;
/** Days away after which the plan welcomes a child back and eases in. */
export const WELCOME_BACK_DAYS = 3;

export interface PlanInput {
  day: string;
  now: Date;
  reviewOn: boolean;
  store: ReviewStore;
  /** Whether a lesson can be started today: registered, in the plan, still in the course. */
  canStart(ref: string): boolean;
  /** The recommender's first pick, or the round the child left unfinished. */
  newRef?: string | null;
  /** `newRef` is a round the child started and left, so it is carried on, not new. */
  newIsResume?: boolean;
  read?: { bookId: string; title: string } | null;
  write?: { collectionId: string; title: string } | null;
  /** Whole days since the child last finished a lesson; null if never. */
  daysAway?: number | null;
  /** End the day with the daily Word Guess. */
  puzzle?: boolean;
}

/** Word Guess, as its learning-log skill id (`src/puzzles/learning.ts`). */
const WORD_GUESS = "koda-word-guess";

export function buildPlan(input: PlanInput): TodayPlan {
  const steps: PlanStep[] = [];
  const used = new Set<string>();
  const welcomeBack = (input.daysAway ?? 0) >= WELCOME_BACK_DAYS;
  const addLesson = (kind: PlanStepKind, ref: string) => {
    if (used.has(ref) || !input.canStart(ref)) return false;
    used.add(ref);
    steps.push({ kind, ref });
    return true;
  };

  if (input.reviewOn) {
    for (const topic of dueTopics(input.store, input.day)) {
      if (addLesson("review", `${topic.skillId}/${topic.lessonId}`)) break;
    }
    /* After a break, one mistake rather than two: the first day back should
       feel like a warm-up, not a bill. The rest wait for the next days. */
    const maxFixes = welcomeBack ? 1 : MAX_FIX_STEPS;
    let fixes = 0;
    for (const mistake of dueMistakes(input.store, input.day)) {
      if (fixes >= maxFixes) break;
      if (addLesson("fix", mistake.key)) fixes += 1;
    }
  }
  if (input.newRef) addLesson(input.newIsResume ? "continue" : "new", input.newRef);
  if (input.read) steps.push({ kind: "read", bookId: input.read.bookId, title: input.read.title });
  if (input.write) steps.push({ kind: "write", collectionId: input.write.collectionId, title: input.write.title });
  /* Last on purpose: the fun one is the reward for the rest. */
  if (input.puzzle) steps.push({ kind: "puzzle" });

  return {
    day: input.day,
    createdAt: input.now.toISOString(),
    reviewOn: input.reviewOn,
    ...(welcomeBack ? { welcomeBack: true } : {}),
    steps,
  };
}

/** Whether the log shows this step done since the plan was made. */
export function stepDone(step: PlanStep, plan: TodayPlan, events: readonly LearningEvent[], learnerId: string): boolean {
  return events.some((e) => {
    if (e.learnerId !== learnerId || e.ts < plan.createdAt || e.entry === "preview") return false;
    switch (step.kind) {
      case "read":
        return e.type === "reading_finished" && Boolean(step.bookId) && e.lessonId.startsWith(`${step.bookId}@`);
      case "puzzle":
        return e.type === "lesson_completed" && e.skillId === WORD_GUESS;
      case "write":
        /* A trace item's completion does not say which collection it came
           from, so any finished writing counts — which is what the step asks. */
        return e.type === "lesson_completed" && e.skillId === "koda-trace";
      default:
        return e.type === "lesson_completed" && `${e.skillId}/${e.lessonId}` === step.ref;
    }
  });
}

/* ---------- storage: one plan per learner per day ---------- */

const keyFor = (learnerId: string) => `koda_today_plan_v1__${learnerId}`;

const readPlan = (learnerId: string): TodayPlan | null => {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    const plan = raw ? (JSON.parse(raw) as TodayPlan) : null;
    return plan && typeof plan.day === "string" && Array.isArray(plan.steps) ? plan : null;
  } catch {
    return null;
  }
};

/**
 * Today's plan for a learner: the one already made today, or a new one.
 *
 * Rebuilt when the day changes or the review switch was flipped since. An
 * empty plan is not kept, so a child who has nothing yet gets one as soon as
 * there is something to put in it.
 */
export function planFor(learnerId: string, input: PlanInput): TodayPlan {
  const stored = readPlan(learnerId);
  if (stored && stored.day === input.day && stored.reviewOn === input.reviewOn && stored.steps.length) {
    /* A plan made before the puzzle step existed (or before the game was on)
       gains it at the end, keeping its start time so the ticks it has stay. */
    if (input.puzzle && !stored.steps.some((s) => s.kind === "puzzle")) {
      const grown = { ...stored, steps: [...stored.steps, { kind: "puzzle" as const }] };
      try {
        localStorage.setItem(keyFor(learnerId), JSON.stringify(grown));
      } catch {
        /* fine for this visit */
      }
      return grown;
    }
    return stored;
  }
  const plan = buildPlan(input);
  if (plan.steps.length) {
    try {
      localStorage.setItem(keyFor(learnerId), JSON.stringify(plan));
    } catch {
      /* the plan still works for this visit */
    }
  }
  return plan;
}
