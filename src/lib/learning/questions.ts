import type { AnswerSubmittedEvent, LearningEvent, QuestionPresentedEvent } from "./events";
import { LearningLog } from "./learningLog";

/**
 * The log, folded to one row per question.
 *
 * The event stream is the right shape to *record* — it is append-only, each
 * entry is independent, and a backend can ingest it without knowing anything
 * about rounds. It is the wrong shape to *read*: three rows to say "this child
 * was asked how many rockets, said 6, and took three seconds" is a stream you
 * decode rather than a table you scan.
 *
 * This is the reading shape. Nothing is stored in it — it is derived, so it can
 * never drift from the events it came from.
 */
export interface QuestionRecord {
  questionId: string;
  /** When the question went on screen. ISO, UTC. */
  askedAt: string;
  skillId: string;
  lessonId: string;
  conceptKey: string;
  levelNumber?: number;
  /** Position in the round. */
  index: number;
  taskKind: string;
  /** The question as the child saw it, when the skill reported it. */
  prompt?: string;
  expected?: string;

  /** What the child answered — their last answer, which is what they settled on. */
  given?: string;
  /** Right on the first try, with no help. The honest measure. */
  correctFirstTry: boolean;
  /** Right in the end, however many tries it took. */
  eventuallyCorrect: boolean;
  attempts: number;
  /** Time from the question appearing to the first answer. */
  timeMs: number;
  /** Help taken before answering. */
  supports: number;
  errorKind?: string;
  /** True when the child left without answering this one. */
  unanswered: boolean;
}

const isPresented = (e: LearningEvent): e is QuestionPresentedEvent =>
  e.type === "question_presented";
const isAnswer = (e: LearningEvent): e is AnswerSubmittedEvent => e.type === "answer_submitted";

/**
 * Build question rows from the event log.
 *
 * Walks the stream once, in order, keyed by `questionId` — so a question the
 * child never answered still appears (as `unanswered`), which is exactly the
 * row a teacher looking for where a child gave up needs to see.
 */
export function getQuestionRecords(filter?: {
  skillId?: string;
  conceptKey?: string;
}): QuestionRecord[] {
  const events = LearningLog.all(filter);
  const byId = new Map<string, QuestionRecord>();

  for (const e of events) {
    if (isPresented(e)) {
      byId.set(e.questionId, {
        questionId: e.questionId,
        askedAt: e.ts,
        skillId: e.skillId,
        lessonId: e.lessonId,
        conceptKey: e.conceptKey,
        levelNumber: e.levelNumber,
        index: e.index,
        taskKind: e.taskKind,
        prompt: e.prompt,
        expected: e.expected,
        correctFirstTry: false,
        eventuallyCorrect: false,
        attempts: 0,
        timeMs: 0,
        supports: 0,
        unanswered: true,
      });
      continue;
    }

    if (e.type === "support_used" && e.questionId) {
      const row = byId.get(e.questionId);
      if (row) row.supports += 1;
      continue;
    }

    if (isAnswer(e)) {
      const row = byId.get(e.questionId);
      // An answer whose question was trimmed out of the ring: skip rather than
      // invent a row with no prompt, which would read as a question nobody asked.
      if (!row) continue;

      row.attempts = e.attempt;
      row.given = e.given ?? row.given;
      row.expected = e.expected ?? row.expected;
      row.unanswered = false;

      if (e.attempt === 1) {
        row.timeMs = e.responseMs;
        row.correctFirstTry = e.correct && e.supportsUsed === 0;
      }
      if (e.correct) row.eventuallyCorrect = true;
      if (!e.correct) row.errorKind = e.errorKind;
    }
  }

  return [...byId.values()];
}
