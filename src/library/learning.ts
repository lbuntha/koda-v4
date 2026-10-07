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

import {
  APP_VERSION,
  LearningLog,
  LessonTracker,
  MAX_WORDS_TAPPED,
  activeLearnerId,
  currentSessionId,
  localDayOf,
  newEventId,
  newId,
  nextSeq,
  type LearningContext,
  type LearningEvent,
  type LearningEventBase,
  type LessonEntry,
  type PageReadEvent,
  type ReadingAbandonedEvent,
  type ReadingFinishedEvent,
  type ReadingStartedEvent,
  type SupportKind,
} from "../lib/learning";
import type { Passage } from "./data/passage";
import { ageBandOf, conceptFor, itemId, taskKindOf, type QuizItem } from "./session";

import { LIBRARY_SKILL_ID } from "./ids";

export { LIBRARY_SKILL_ID };

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
      expected:
        item.part === "spell" ? item.word.word
        : item.question.kind === "match" ? item.question.pairs.map((pr) => `${pr.left} → ${pr.right}`).join("; ")
        : item.question.options[item.question.answer],
      itemCount: item.part === "spell" ? item.word.tiles.length : item.question.kind === "match" ? item.question.pairs.length : item.question.options.length,
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

/** What each reading event adds to the envelope `emit` fills in. */
type Body<E> = Omit<E, keyof LearningEventBase | "readId">;
type ReadingBody = Body<ReadingStartedEvent> | Body<PageReadEvent> | Body<ReadingFinishedEvent> | Body<ReadingAbandonedEvent>;

/**
 * A book being read, in the learning log — the pages before the quiz.
 *
 * Same envelope and same outbox as every lesson event, so it syncs, lands in
 * the server's `events` collection and shows in the learning-log viewer with
 * nothing else to wire. Page 0 is the cover: opening a book and shutting it
 * there records the start and nothing more.
 *
 * Safe under React's development double-mount: `start` twice is one start,
 * and `close` with no story page reached sends nothing.
 */
export class ReadingRecorder {
  private context: LearningContext;
  private readId = "";
  private started = 0;
  private done = true;
  private page = 0;
  private pageAt = 0;
  private aloud = 0;
  private tapped: string[] = [];
  private seen = new Set<number>();
  private aloudPages = new Set<number>();
  private tappedTotal = 0;
  private furthest = 0;

  constructor(passage: Passage, private pageCount: number, private entry: LessonEntry = "picker", private now: () => number = Date.now) {
    this.context = {
      skillId: LIBRARY_SKILL_ID,
      activityId: "reading",
      lessonId: `${passage.id}@${passage.rev}`,
      conceptKey: conceptFor(passage.band),
      ageBand: ageBandOf(passage.band),
      practice: false,
    };
  }

  private emit(body: ReadingBody) {
    const at = new Date(this.now());
    LearningLog.record({
      ...this.context,
      id: newEventId(),
      ts: at.toISOString(),
      sessionId: currentSessionId,
      learnerId: activeLearnerId(),
      seq: nextSeq(),
      appVersion: APP_VERSION,
      tzOffsetMinutes: -at.getTimezoneOffset(),
      localDay: localDayOf(at),
      entry: this.entry,
      readId: this.readId,
      ...body,
    } as LearningEvent);
  }

  start() {
    if (!this.done) return;
    this.done = false;
    this.readId = newId("r");
    this.started = this.pageAt = this.now();
    this.page = this.furthest = this.aloud = this.tappedTotal = 0;
    this.tapped = [];
    this.seen.clear();
    this.aloudPages.clear();
    this.emit({ type: "reading_started", pageCount: this.pageCount });
  }

  /** Report the page being left, then open `page`. */
  turnTo(page: number) {
    if (this.done || page === this.page) return;
    this.leavePage();
    this.page = page;
    this.pageAt = this.now();
    if (page > 0) this.seen.add(page);
    this.furthest = Math.max(this.furthest, page);
  }

  readAloud() {
    if (this.done || this.page < 1) return;
    this.aloud += 1;
    this.aloudPages.add(this.page);
  }

  tapWord(word: string) {
    if (this.done || this.page < 1 || !word) return;
    this.tappedTotal += 1;
    if (this.tapped.length < MAX_WORDS_TAPPED && !this.tapped.includes(word)) this.tapped.push(word);
  }

  finish() {
    if (this.done) return;
    this.leavePage();
    this.emit({
      type: "reading_finished",
      pageCount: this.pageCount,
      pagesSeen: this.seen.size,
      durationMs: this.now() - this.started,
      readAloudPages: this.aloudPages.size,
      wordsTapped: this.tappedTotal,
    });
    this.done = true;
  }

  /** The book was shut. Past the cover that is an abandonment; on it, a mis-tap. */
  close() {
    if (this.done || this.furthest === 0) return;
    this.leavePage();
    this.emit({
      type: "reading_abandoned",
      pageCount: this.pageCount,
      furthestPage: this.furthest,
      pagesSeen: this.seen.size,
      durationMs: this.now() - this.started,
    });
    this.done = true;
  }

  private leavePage() {
    if (this.page > 0)
      this.emit({ type: "page_read", page: this.page, pageCount: this.pageCount, dwellMs: this.now() - this.pageAt, readAloud: this.aloud, wordsTapped: this.tapped });
    this.aloud = 0;
    this.tapped = [];
  }
}
