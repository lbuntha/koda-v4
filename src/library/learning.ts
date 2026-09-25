/**
 * A book, in the learning log.
 *
 * The same five calls every skill makes — start, present, answered, support used,
 * complete — through the same `LessonTracker`, so response times, first-try
 * accuracy and the parent summary are computed exactly as they are for lessons.
 *
 * Identity: `skillId` "koda-library" (a parent notification reads it as "Koda
 * Library"); `lessonId` is the book and its revision, so answers to revision 2
 * never mix with revision 1; `conceptKey` is read-and-answer by band. The
 * recommender only ever walks the course's lesson list, so a library concept can
 * appear in the log without it ever being recommended as a lesson.
 *
 * Literacy has no error kinds yet — the taxonomy is arithmetic-shaped — so a
 * wrong answer carries `expected` and `given` and the kind is left for the
 * tracker to call `unknown`. Decide the kinds once there is real data.
 */

import { LessonTracker, type SupportKind } from "../lib/learning";
import type { Passage } from "./data/passage";
import { ageBandOf, conceptFor, itemId, taskKindOf, type QuizItem } from "./session";

export const LIBRARY_SKILL_ID = "koda-library";

export class BookRecorder {
  private tracker: LessonTracker;
  private index = 0;

  constructor(private passage: Passage) {
    this.tracker = new LessonTracker({
      skillId: LIBRARY_SKILL_ID,
      activityId: "passage",
      lessonId: `${passage.id}@${passage.rev}`,
      conceptKey: conceptFor(passage.band),
      ageBand: ageBandOf(passage.band),
      practice: false,
    });
  }

  /** `preview` keeps an author's test run out of every child's record. */
  start(entry: "picker" | "preview" = "picker") {
    this.index = 0;
    this.tracker.startLesson(entry);
  }

  present(item: QuizItem) {
    const p = this.passage;
    this.tracker.present({
      questionId: itemId(p, item),
      index: this.index++,
      taskKind: taskKindOf(item.part),
      prompt: item.part === "spell" ? item.word.gapped : item.question.prompt,
      expected: item.part === "understand" ? item.question.options[item.question.answer] : item.part === "words" ? item.question.options[item.question.answer] : item.word.word,
      itemCount: item.part === "spell" ? item.word.tiles.length : item.question.options.length,
    });
  }

  answered(item: QuizItem, correct: boolean, given: string) {
    this.tracker.answered({ questionId: itemId(this.passage, item), correct, given });
  }

  support(kind: SupportKind, level?: number) {
    this.tracker.supportUsed(kind, level);
  }

  complete(stars: number, xpEarned: number) {
    this.tracker.completeLesson({ stars, xpEarned });
  }

  abandon() {
    this.tracker.abandonLesson();
  }
}
