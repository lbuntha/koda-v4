/**
 * Word Guess in the learning log: one finished game is one lesson.
 *
 * The same `LessonTracker` the skills, Rebus and books use, so a game counts as
 * a day practised and shows in the parent's summary, and Today's plan can tick
 * its puzzle step. A single answer is recorded at the end — solved or not —
 * because a wrong guess is how the game is played, not a mistake: the review
 * bank leaves this skill out (`learning/review.ts`).
 */

import { LessonTracker } from "../lib/learning";
import type { DailyPuzzle } from "./types";

export const WORD_GUESS_SKILL_ID = "koda-word-guess";
export const WORD_GUESS_CONCEPT = "word-spelling";

export class WordGuessRecorder {
  private tracker: LessonTracker;
  private open = false;

  constructor(private puzzle: DailyPuzzle, practice: boolean) {
    this.tracker = new LessonTracker({
      skillId: WORD_GUESS_SKILL_ID,
      activityId: "word-guess",
      lessonId: `word-guess:${puzzle.lang}:${puzzle.level}`,
      conceptKey: WORD_GUESS_CONCEPT,
      practice,
    });
  }

  /** The first guess opens the game. */
  begin() {
    if (this.open) return;
    this.open = true;
    this.tracker.startLesson("picker");
    this.tracker.present({ questionId: this.puzzle.id, index: 0, taskKind: "word_guess", prompt: this.puzzle.data.category, expected: this.puzzle.data.word });
  }

  hint(level: number) {
    if (this.open) this.tracker.supportUsed("hint", level);
  }

  finish(won: boolean, guesses: number, xpEarned: number) {
    if (!this.open) return;
    this.tracker.answered({ questionId: this.puzzle.id, correct: won, given: won ? `solved in ${guesses}` : "not solved" });
    this.tracker.completeLesson({ stars: won ? (guesses <= 3 ? 3 : guesses <= 5 ? 2 : 1) : 0, xpEarned });
    this.open = false;
  }

  abandon() {
    if (!this.open) return;
    this.tracker.abandonLesson();
    this.open = false;
  }
}
