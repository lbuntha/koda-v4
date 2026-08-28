import {
  type AnswerSubmittedEvent,
  type ErrorKind,
  GUESS_THRESHOLD_MS,
  type LearningContext,
  type LearningEvent,
  type LessonEntry,
  type SupportKind,
} from "./events";
import {
  APP_VERSION,
  LearningLog,
  currentSessionId,
  learnerId,
  localDayOf,
  newEventId,
  newId,
  nextSeq,
} from "./learningLog";

/**
 * The per-activity recorder behind `koda.learning`.
 *
 * This exists so that a skill reports only what happened and never what it
 * means. It owns the response clock, the attempt counter, the support tally and
 * every rollup in `lesson_completed`. Counting and addition therefore cannot
 * disagree about what "accuracy" or "response time" is, because neither of them
 * calculates it.
 *
 * It is also the reason instrumenting a new skill is five calls, not a design
 * exercise: start, present, answered, supportUsed, complete.
 */

export interface AnswerReport {
  /** Must match the id given to `present`. */
  questionId: string;
  correct: boolean;
  /** What the child chose, as text. Kept for error analysis, never free text. */
  given?: string;
  /**
   * The right answer, when the skill only knows it at answer time.
   *
   * Several activities pick their target inside a state update, so it is not
   * available when `present` fires. Supplied here it takes precedence, which is
   * what turns a wrong answer into `off_by_one` rather than `unknown`.
   */
  expected?: string;
  /**
   * Why it was wrong, when the skill can tell. Leave unset and the tracker
   * classifies what it can (`guessed_fast`, `off_by_one`) from the numbers.
   */
  errorKind?: ErrorKind;
}

export interface LessonSummaryExtras {
  stars?: number;
  xpEarned?: number;
}

/**
 * One event minus the envelope the tracker fills in.
 *
 * Distributive on purpose: a plain `Omit<LearningEvent, ...>` over a union
 * collapses to the keys every member shares, which would silently reject every
 * field that makes an event useful.
 */
/** Everything the tracker stamps for you. Listed once, so adding an envelope
 *  field is a one-line change rather than a hunt through call sites. */
type TrackerSuppliedField =
  | keyof LearningContext
  | "id"
  | "ts"
  | "sessionId"
  | "learnerId"
  | "seq"
  | "appVersion"
  | "tzOffsetMinutes"
  | "localDay";

type LearningEventBody<E extends LearningEvent = LearningEvent> = E extends LearningEvent
  ? Omit<E, TrackerSuppliedField>
  : never;

interface OpenQuestion {
  /** The skill's own id, used only to match `answered` to `present`. */
  localId: string;
  /**
   * The id that goes in the log.
   *
   * Stamped here rather than trusting the skill's, because a skill has no way to
   * be globally unique — counting's was `q_<level>_<timestamp>`, so two children
   * on level 1 in the same millisecond produced the same id. Locally that is
   * harmless; the moment those rows share a table it silently merges two
   * children's questions into one.
   */
  uid: string;
  presentedAt: number;
  expected?: string;
  attempts: number;
  supports: number;
}

/** Numeric answers a digit apart are a slip, not a misconception. */
const classify = (
  report: AnswerReport,
  expected: string | undefined,
  responseMs: number,
): ErrorKind | undefined => {
  if (report.correct) return undefined;
  if (report.errorKind) return report.errorKind;
  if (responseMs < GUESS_THRESHOLD_MS) return "guessed_fast";

  const given = Number(report.given);
  const target = Number(expected);
  if (Number.isFinite(given) && Number.isFinite(target)) {
    return Math.abs(given - target) === 1 ? "off_by_one" : "off_by_more";
  }
  return "unknown";
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
};

export class LessonTracker {
  private context: LearningContext;
  private startedAt = 0;
  private open: OpenQuestion | null = null;
  private isOpen = false;

  /** First-attempt outcomes only — the round summary is about first tries. */
  private firstAttempts: { correct: boolean; unaided: boolean; responseMs: number }[] = [];
  private supportsThisLesson = 0;

  constructor(context: LearningContext) {
    this.context = context;
  }

  /** Later events can carry a lesson id the activity only learns at runtime. */
  updateContext(patch: Partial<LearningContext>) {
    this.context = { ...this.context, ...patch };
  }

  private emit(event: LearningEventBody) {
    const now = new Date();
    LearningLog.record({
      ...this.context,
      id: newEventId(),
      ts: now.toISOString(),
      sessionId: currentSessionId,
      learnerId,
      seq: nextSeq(),
      appVersion: APP_VERSION,
      tzOffsetMinutes: -now.getTimezoneOffset(),
      localDay: localDayOf(now),
      ...event,
    } as LearningEvent);
  }

  startLesson(entry: LessonEntry = "path") {
    // A second start without a finish means the child re-entered; close the old
    // round as abandoned so the log never contains two overlapping lessons.
    if (this.isOpen) this.abandonLesson();

    this.startedAt = Date.now();
    this.isOpen = true;
    this.firstAttempts = [];
    this.supportsThisLesson = 0;
    this.open = null;
    this.emit({ type: "lesson_started", entry });
  }

  present(question: {
    questionId: string;
    index: number;
    taskKind: string;
    prompt?: string;
    expected?: string;
    itemCount?: number;
  }) {
    const uid = newId("q");
    this.open = {
      localId: question.questionId,
      uid,
      presentedAt: Date.now(),
      expected: question.expected,
      attempts: 0,
      supports: 0,
    };
    this.emit({ ...question, type: "question_presented", questionId: uid });
  }

  supportUsed(support: SupportKind, hintLevel?: number) {
    if (this.open) this.open.supports += 1;
    this.supportsThisLesson += 1;
    this.emit({ type: "support_used", questionId: this.open?.uid, support, hintLevel });
  }

  answered(report: AnswerReport) {
    const q = this.open;
    // An answer with no question on screen is a bug in the skill, not a data
    // point — recording it would corrupt every average it touches.
    if (!q || q.localId !== report.questionId) return;

    q.attempts += 1;
    const responseMs = Date.now() - q.presentedAt;
    const expected = report.expected ?? q.expected;
    const errorKind = classify(report, expected, responseMs);

    if (q.attempts === 1) {
      this.firstAttempts.push({
        correct: report.correct,
        unaided: q.supports === 0,
        responseMs,
      });
    }

    const event: LearningEventBody<AnswerSubmittedEvent> = {
      type: "answer_submitted",
      questionId: q.uid,
      correct: report.correct,
      attempt: q.attempts,
      responseMs,
      given: report.given,
      expected,
      errorKind,
      supportsUsed: q.supports,
    };
    this.emit(event);
  }

  completeLesson(extras: LessonSummaryExtras = {}) {
    if (!this.isOpen) return;
    const answered = this.firstAttempts.length;
    const correctFirstTry = this.firstAttempts.filter((a) => a.correct && a.unaided).length;

    this.emit({
      type: "lesson_completed",
      questionsAnswered: answered,
      correctFirstTry,
      firstTryAccuracy: answered > 0 ? correctFirstTry / answered : 0,
      medianResponseMs: median(this.firstAttempts.map((a) => a.responseMs)),
      supportsUsed: this.supportsThisLesson,
      durationMs: Date.now() - this.startedAt,
      ...extras,
    });
    this.isOpen = false;
    this.open = null;
  }

  abandonLesson() {
    // Nothing attempted is a mis-tap, not a struggle; recording it would make
    // browsing the level picker look like repeated failure. It is a true no-op,
    // leaving the round open — "abandoned before answering anything" is not an
    // abandonment, and closing the round here would strand a live one under
    // React's development double-invoke of effects.
    if (!this.isOpen || this.firstAttempts.length === 0) return;
    this.emit({
      type: "lesson_abandoned",
      questionsAnswered: this.firstAttempts.length,
      correctFirstTry: this.firstAttempts.filter((a) => a.correct && a.unaided).length,
      durationMs: Date.now() - this.startedAt,
    });
    this.isOpen = false;
    this.open = null;
  }
}
