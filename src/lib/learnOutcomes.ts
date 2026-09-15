import type { ResolvedLesson } from "../curriculum";

/** How many finished outcomes to show — enough to feel like progress, not a transcript. */
const RECENT = 3;
/** How many to preview beyond the one being learned now. */
const AHEAD = 2;

export interface OutcomeSummary {
  /** The outcome being learned now — the lesson Continue opens. */
  now?: ResolvedLesson;
  /** Nothing is finished yet, so "now" is where they start rather than where they are. */
  starting: boolean;
  /** The furthest-along finished outcomes, in path order. */
  learned: ResolvedLesson[];
  learnedCount: number;
  comingUp: ResolvedLesson[];
  /** Teaching lessons on the path — the same total the progress bar uses. */
  total: number;
  allLearned: boolean;
}

/** Keeps the first lesson for each outcome, so two lessons on one idea read once. */
const distinctConcepts = (lessons: ResolvedLesson[], skip?: string): ResolvedLesson[] => {
  const seen = new Set(skip ? [skip] : []);
  return lessons.filter((lesson) => {
    if (seen.has(lesson.concept)) return false;
    seen.add(lesson.concept);
    return true;
  });
};

/**
 * What a skill's "What you'll learn" panel says to this learner.
 *
 * It listed the first five outcomes of the skill for everyone, forever — so a
 * learner eight units in was still told they would learn to join two groups —
 * and counted "+59 more" over practice rounds that all share one outcome,
 * against a skill that teaches 52. It is now about where this learner is: what
 * they are on, what they have done, and what is next.
 *
 * `taught` is the teaching path only; practice teaches no new outcome.
 */
export function outcomeSummary(
  taught: ResolvedLesson[],
  isDone: (lesson: ResolvedLesson) => boolean,
  current?: ResolvedLesson,
): OutcomeSummary {
  const done = taught.filter(isDone);
  const at = current ? taught.findIndex((lesson) => lesson.ref === current.ref) : -1;
  const now = at >= 0 ? current : undefined;
  const ahead = taught.filter((lesson, index) => index > at && !isDone(lesson));

  return {
    now,
    starting: done.length === 0,
    learned: distinctConcepts(done).slice(-RECENT),
    learnedCount: done.length,
    // Without a "now" (a path blocked by another skill) the preview carries the panel alone.
    comingUp: distinctConcepts(ahead, now?.concept).slice(0, now ? AHEAD : AHEAD + 1),
    total: taught.length,
    allLearned: taught.length > 0 && done.length === taught.length,
  };
}
