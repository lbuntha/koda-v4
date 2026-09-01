import { currentLearnerId } from "./learnerProgress";

/**
 * How far a child got through a practice run they did not finish.
 *
 * A lesson is a step on the path: leaving one half-done and coming back to it
 * fresh costs nothing, because the point is the teaching and the teaching is
 * still there. Practice is not a step. It is a set of questions a child chose
 * to sit, and losing six of them because a tablet was put down is the app
 * throwing away work — the one thing that makes a child not want to start.
 *
 * So the position is written down after every answered question and read back
 * when the same practice is opened again.
 *
 * **Device-local, and deliberately not synced.** Every other record here is a
 * fact about the learner that belongs on all their devices; this is the state
 * of one interrupted sitting. Resuming question 7 of 8 on a different tablet an
 * hour later is not a feature anybody asked for, and syncing it would mean a
 * half-finished round on the family iPad quietly reopening on a phone.
 *
 * Keyed by learner, not by device, for the reason `learnerProgress` gives: a
 * family tablet is used by each child in turn, and one key for all of them
 * hands the second child the first one's half-finished round.
 */
export interface PracticeProgress {
  /** Position in the course. What the app calls "level N", and what identifies the lesson. */
  levelNumber: number;
  /** Questions already answered. The run resumes at the one after. */
  answered: number;
  /**
   * Right first time so far.
   *
   * Carried so a resumed run is scored over the whole sitting. Without it a
   * child who answered six perfectly, stopped, and came back would be scored on
   * the last two alone — which can turn a strong run into one star.
   */
  correctFirstTry: number;
  /** How many questions the run has in total, so a card can say "6 of 8". */
  total: number;
  /** ISO timestamp of the last answer. Shown to a grown-up; not what orders these. */
  updatedTs: string;
  /**
   * Which save came last, counted rather than timed.
   *
   * Ordering on the timestamp alone is not a total order: two saves inside the
   * same millisecond compare equal, and the tie then falls to whatever order
   * the keys happen to enumerate in — which is ascending level number, so the
   * *older* run wins. "Where was I" is this store's only real question, so it
   * gets an answer that cannot tie.
   */
  seq: number;
}

const keyFor = (learnerId: string): string => `koda_practice_progress_v1:${learnerId}`;

const readAll = (): Record<number, PracticeProgress> => {
  try {
    const raw = localStorage.getItem(keyFor(currentLearnerId()));
    return raw ? (JSON.parse(raw) as Record<number, PracticeProgress>) : {};
  } catch {
    /* A tablet with storage disabled still plays; it just cannot resume. */
    return {};
  }
};

const writeAll = (all: Record<number, PracticeProgress>): void => {
  try {
    localStorage.setItem(keyFor(currentLearnerId()), JSON.stringify(all));
  } catch {
    /* Quota or a private window. Losing the position is not worth an error. */
  }
};

export const PracticeProgressAPI = {
  /** Where this practice was left, if it was left part-way. */
  get(levelNumber: number): PracticeProgress | undefined {
    const saved = readAll()[levelNumber];
    /* A run with nothing answered is not a run to resume, and a saved position
       at or past the end is a finish that failed to clear itself. */
    if (!saved || saved.answered <= 0 || saved.answered >= saved.total) return undefined;
    return saved;
  },

  /** Every interrupted run, newest first. */
  all(): PracticeProgress[] {
    return Object.values(readAll())
      .filter((p) => p.answered > 0 && p.answered < p.total)
      .sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0));
  },

  /** The one to offer first. */
  latest(): PracticeProgress | undefined {
    return PracticeProgressAPI.all()[0];
  },

  save(progress: Omit<PracticeProgress, "updatedTs" | "seq">): void {
    const all = readAll();
    const highest = Math.max(0, ...Object.values(all).map((p) => p.seq ?? 0));
    all[progress.levelNumber] = {
      ...progress,
      updatedTs: new Date().toISOString(),
      seq: highest + 1,
    };
    writeAll(all);
  },

  /** Finished, or started again from the top. Either way there is nothing to resume. */
  clear(levelNumber: number): void {
    const all = readAll();
    if (!(levelNumber in all)) return;
    delete all[levelNumber];
    writeAll(all);
  },

  clearAll(): void {
    writeAll({});
  },
};
