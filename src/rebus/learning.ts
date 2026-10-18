/**
 * Rebus Rush, in the learning log.
 *
 * The same `LessonTracker` every skill, book and tracing item uses, so a round
 * counts as a day practised and as a Think round in the parent's summary, and
 * nothing downstream needs to know Rebus exists.
 *
 * The mapping:
 *
 * - **A lesson is one round**, opened when the first puzzle appears and closed
 *   by the summary. A round left before any puzzle is answered records nothing.
 * - **A question is one puzzle.** `correct` is whether the child solved it;
 *   `given` is only ever a reason ("wrong", "skipped", "time", "machine"),
 *   never what was typed: the log holds no free text from a child.
 * - **A wrong answer is a wrong attempt** at the puzzle on screen, so the
 *   solve that follows is its second attempt, not a first try.
 * - **A replay is practice.** A round of puzzles the child has all played
 *   before is logged with `practice: true`, the same flag the practice screen
 *   uses: retrieving what they met earlier, unaided, is the evidence of speed
 *   and accuracy, while a first play is still teaching. Time per puzzle,
 *   correctness, wrong tries and hints are already on every event.
 * - **A hint** is `support_used`, with the rung as its level.
 * - **The Machine winning is not a mistake the child made.** It is recorded
 *   as an unanswered puzzle ("machine"), which the server's first-try accuracy
 *   would count against them, so Rebus concepts never raise mastered or stuck
 *   (`mastery.is_ladder_concept`).
 */

import { LessonTracker } from "../lib/learning";
import type { AgeRange } from "../lib/ages";
import type { PuzzleOutcome } from "./engine";
import { meaningfulPieces, pieceName } from "./puzzle";
import type { CategoryId, Puzzle } from "./types";

export const REBUS_SKILL_ID = "koda-rebus";
export const REBUS_CONCEPT = "rebus-decoder";

/** What a parent reads for the concept, as the other modules name theirs. */
export const REBUS_CONCEPT_NAMES: Readonly<Record<string, { lesson: string; skill: string }>> = {
  [REBUS_CONCEPT]: { lesson: "Solving picture puzzles", skill: "Rebus Rush" },
};

const reasonOf = (o: PuzzleOutcome): string => (o.reason === "solved" ? "solved" : o.reason);

export class RebusRecorder {
  private tracker: LessonTracker;
  private open = false;

  constructor(options: { category: CategoryId | "mixed"; ages?: AgeRange | null; replay?: boolean }) {
    this.tracker = new LessonTracker({
      skillId: REBUS_SKILL_ID,
      activityId: "rebus",
      lessonId: `rebus:${options.category}`,
      conceptKey: REBUS_CONCEPT,
      ageBand: options.ages ? [options.ages[0], options.ages[1]] : undefined,
      practice: options.replay === true,
    });
  }

  /** A puzzle is put on screen. The first one opens the round. */
  present(puzzle: Puzzle, index: number) {
    if (!this.open) {
      this.open = true;
      this.tracker.startLesson("picker");
    }
    this.tracker.present({
      questionId: puzzle.id,
      index,
      taskKind: `rebus_${puzzle.trick}`,
      prompt: meaningfulPieces(puzzle.pieces).map(pieceName).join(" + "),
      expected: puzzle.answer,
    });
  }

  /** A wrong answer was typed or built. */
  wrong(puzzle: Puzzle) {
    if (this.open) this.tracker.answered({ questionId: puzzle.id, correct: false, given: "wrong" });
  }

  /** A hint was taken; `rung` is 1 for the category, up to 3. */
  hint(rung: number) {
    if (this.open) this.tracker.supportUsed("hint", rung);
  }

  /** The puzzle ended: solved, or nobody got it, or the Machine did. */
  settle(outcome: PuzzleOutcome) {
    if (!this.open) return;
    if (outcome.reason === "solved") this.tracker.answered({ questionId: outcome.puzzle.id, correct: true, given: "solved" });
    else this.tracker.answered({ questionId: outcome.puzzle.id, correct: false, given: reasonOf(outcome) });
  }

  complete(stars: number, xpEarned: number) {
    if (!this.open) return;
    this.tracker.completeLesson({ stars, xpEarned });
    this.open = false;
  }

  /** Left before the end. A no-op when nothing was attempted. */
  abandon() {
    if (!this.open) return;
    this.tracker.abandonLesson();
    this.open = false;
  }
}
