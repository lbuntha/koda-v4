/**
 * The learning event schema — one shape, every skill.
 *
 * This is deliberately not the same thing as `SkillActionLog`. That log answers
 * "what did the UI do?" with a free-text string, which is fine for debugging and
 * useless for teaching: you cannot compute mastery from `TAP_ITEM · "tapped a
 * rocket"`. These events answer "what did the child learn, and what tripped them
 * up?", in fields a program can fold.
 *
 * Two rules keep it replicable across skills:
 *
 *  1. **A skill reports facts, never statistics.** It says "this answer was
 *     wrong on attempt 2"; it never computes accuracy or response time. The SDK
 *     derives every number, so counting and addition cannot disagree about what
 *     "accuracy" means.
 *  2. **Mastery is keyed by `conceptKey`, not by skill.** A concept can be
 *     taught by more than one skill, and a skill teaches more than one concept.
 *     Recommendation works on concepts, so adding a skill never means teaching
 *     the recommender about it.
 *
 * Privacy: everything here is about the work, not the child. No names, no free
 * text a child typed, no audio. It stays in this browser (see `learningLog.ts`)
 * and exists so the app can pick a good next lesson.
 */

/**
 * Wire format version, carried on every batch.
 *
 * There is no backend yet, so the store is JSON in localStorage — but it is the
 * *same* JSON a server will be handed later. A version on the envelope is what
 * lets that server accept events written by an app version that predates it,
 * instead of the first migration being a data loss.
 */
export const LEARNING_SCHEMA_VERSION = 1;

/** One continuous sitting. Regenerated per app load. */
export type SessionId = string;

/**
 * Why an answer was wrong — a closed, cross-skill taxonomy.
 *
 * Closed because a recommender has to compare across skills: "off by one" must
 * mean the same in counting and in addition or the pattern can't be read. A
 * skill that genuinely cannot classify sends `unknown`, which is honest and
 * still counts towards accuracy.
 */
export type ErrorKind =
  /** Answer adjacent to the target — the classic slip; the child has the idea. */
  | "off_by_one"
  /** Not near the target — suggests the procedure was not run at all. */
  | "off_by_more"
  /** Right numbers, wrong direction: compared the wrong way, swapped operands. */
  | "reversed"
  /** Answered faster than thinking takes. Derived by the SDK, not reported. */
  | "guessed_fast"
  /** No answer inside the activity's window. */
  | "timed_out"
  /** Tapped/counted a different number of items than exist — one-to-one broke down. */
  | "miscounted_items"
  /** Wrong next term in a sequence — the pattern rule, not the arithmetic. */
  | "sequence_slip"
  /** Tens/ones confusion: 15 for 51, 3 tens read as 3. */
  | "place_value"
  | "unknown";

/** What kind of help was taken. Help is a signal, not a failure. */
export type SupportKind =
  /** The written hint. */
  | "hint"
  /** Heard the prompt again. */
  | "audio_replay"
  /** Re-showed a flashed set — the child needed longer than the flash allows. */
  | "reveal"
  /** Stepped through a worked example. */
  | "walkthrough";

/** How the learner arrived at the lesson. Preview traffic must not shape advice. */
export type LessonEntry = "path" | "picker" | "resume" | "recommendation" | "preview";

/**
 * Identity of the work, attached to every event.
 *
 * `conceptKey` is the one field a recommender reads, so it is required even
 * though `lessonId` would usually imply it — an implied key is one that goes
 * missing exactly when a skill is added in a hurry.
 */
export interface LearningContext {
  skillId: string;
  activityId: string;
  lessonId: string;
  /** Stable machine key for what is being mastered, e.g. "corresponder". */
  conceptKey: string;
  /** Position in the course, when the lesson has one. */
  levelNumber?: number;
  /** Curriculum codes, carried so reporting can roll up by standard. */
  standards?: string[];
  /** Intended age range, so advice can tell "too hard" from "too young". */
  ageBand?: [number, number];
  /**
   * Whether this was practice rather than teaching.
   *
   * Carried on every event because the two are different measurements and
   * averaging them together answers neither question. A teaching round is a
   * child being walked through a technique with hints, a voice and an
   * explanation; a practice round is the same child retrieving it unaided and
   * against the clock. Only the second is evidence of speed, so "how fast is
   * this learner?" is only answerable if the log says which rounds were which.
   *
   * Optional because events written before this existed have no answer, and
   * inventing one for them would put guessed rows in a table a grown-up is
   * meant to be able to verify.
   */
  practice?: boolean;
}

export interface LearningEventBase extends LearningContext {
  id: string;
  /** ISO 8601, UTC. */
  ts: string;
  sessionId: SessionId;

  /**
   * Who this is about.
   *
   * Not a name or an account — a random per-device id, so a backend can keep two
   * children on a shared tablet apart, and so a real account id has somewhere to
   * go later. Without it every uploaded event belongs to "whoever was holding
   * the device", which is not analysable.
   */
  learnerId: string;

  /**
   * Monotonic within a session, starting at 1.
   *
   * Timestamps collide at millisecond resolution — a `present` and the tap that
   * answers it can land in the same millisecond — and a server that sorts by
   * `ts` alone will occasionally read an answer as preceding its question. This
   * is the tiebreak.
   */
  seq: number;

  /** Build that produced the event. On the event, not just the batch: the ring
   *  outlives releases, so one upload can span several app versions. */
  appVersion?: string;

  /**
   * Minutes offset from UTC when the event happened.
   *
   * "Days practised" is a mastery criterion, so which calendar day an event
   * falls on changes when a child is judged to have mastered something. A
   * server bucketing by UTC would move an evening session in Asia into the next
   * day and a morning session in the Americas into the previous one.
   */
  tzOffsetMinutes: number;

  /** The learner's local calendar day, YYYY-MM-DD. Derived from the above. */
  localDay: string;

  entry?: LessonEntry;
}

/** A lesson was opened. */
export interface LessonStartedEvent extends LearningEventBase {
  type: "lesson_started";
  entry: LessonEntry;
}

/**
 * A question went on screen.
 *
 * Also starts the response clock, which is why a skill must send it even when it
 * has nothing interesting to say about the question.
 */
export interface QuestionPresentedEvent extends LearningEventBase {
  type: "question_presented";
  questionId: string;
  /** Position in the round, 1-based. */
  index: number;
  /** What the activity asked for, as a short machine key, e.g. "count_total". */
  taskKind: string;
  /**
   * The question as the child saw it, e.g. "Touch each rocket. Count as you go!"
   *
   * Authored copy, never anything a child typed, so it carries no personal data.
   * Without it the log can say an answer was wrong but not what was asked, which
   * is most of what a teacher reading the log wants to know.
   */
  prompt?: string;
  /** The correct answer, as text. Needed to classify errors after the fact. */
  expected?: string;
  /** How many things were on screen — the load the child was under. */
  itemCount?: number;
}

/** An answer was submitted. The core event: everything else is context for it. */
export interface AnswerSubmittedEvent extends LearningEventBase {
  type: "answer_submitted";
  questionId: string;
  correct: boolean;
  /** 1 for the first try at this question, 2 for the next, and so on. Derived. */
  attempt: number;
  /** Milliseconds from `question_presented` to this answer. Derived. */
  responseMs: number;
  given?: string;
  expected?: string;
  /** Only meaningful when `correct` is false. */
  errorKind?: ErrorKind;
  /** Supports taken on this question before answering. Derived. */
  supportsUsed: number;
}

/** Help was taken. Deliberately its own event: help before a correct answer is
 *  not the same learning state as an unaided correct answer. */
export interface SupportUsedEvent extends LearningEventBase {
  type: "support_used";
  questionId?: string;
  support: SupportKind;
  /** For laddered hints: 1 is the gentlest nudge. */
  hintLevel?: number;
}

/** The round finished. Every number here is derived by the SDK. */
export interface LessonCompletedEvent extends LearningEventBase {
  type: "lesson_completed";
  questionsAnswered: number;
  /** Answered right with no earlier attempt and no support — the honest one. */
  correctFirstTry: number;
  /** correctFirstTry / questionsAnswered, 0..1. */
  firstTryAccuracy: number;
  /** Median, not mean: one child staring out of the window skews a mean. */
  medianResponseMs: number;
  supportsUsed: number;
  durationMs: number;
  stars?: number;
  xpEarned?: number;
}

/** The learner left mid-round. Abandonment is a stronger difficulty signal than
 *  a low score, so it is recorded rather than inferred from a missing event. */
export interface LessonAbandonedEvent extends LearningEventBase {
  type: "lesson_abandoned";
  questionsAnswered: number;
  correctFirstTry: number;
  durationMs: number;
}

/**
 * A child talked to Koda, and what they asked.
 *
 * **This is the first event that stores a child's own words.** Every other one
 * carries authored copy — a lesson's prompt, an expected answer — which is why
 * `QuestionPresentedEvent.prompt` can say it holds no personal data. This one
 * cannot say that, and the difference is deliberate: a recommendation worth
 * making needs the misconception in the child's own phrasing. "Why is it
 * thirteen and not threeteen" is the finding; "asked 6 questions about teen
 * numbers" is not.
 *
 * So it is bounded on purpose. Koda's replies are **not** stored — only what the
 * child asked — and the questions are capped and truncated (`MAX_ASKED`,
 * `MAX_ASKED_CHARS`) so a long session cannot turn into an unbounded transcript.
 *
 * Only a subscribed family can produce one: Ask Koda is gated on the `ai.koda`
 * plan and on the parent's per-child switch, so a child whose grown-up has not
 * turned Koda on never reaches this code at all.
 *
 * Independent of the lesson tracker. A conversation can happen with no lesson
 * open — on the home page, mid-way through nothing — so `lessonId` and
 * `conceptKey` are optional here in a way they are not elsewhere.
 */
export interface KodaConversationEvent extends LearningEventBase {
  type: "koda_conversation";
  /** Typed, or spoken to the live coach. */
  mode: "chat" | "voice";
  /**
   * Which character answered — `personaId`, not "Koda".
   *
   * A deployment runs several teachers and a parent picks one per child. Two
   * children asking the same thing of Aoede and of Puck are not having the same
   * conversation, and a recommendation that cannot tell them apart is averaging
   * over the one variable the family chose.
   */
  personaId?: string;
  /** How many times the child said something. Koda's turns are not counted. */
  turns: number;
  /** Wall-clock length of the conversation. */
  durationMs: number;
  /** What the child asked, in their words. Capped and truncated. */
  asked: string[];
  /** Whether this began straight after a wrong answer — a help-seeking signal. */
  afterWrongAnswer?: boolean;
}

/** How many of a child's questions one conversation keeps. */
export const MAX_ASKED = 12;
/** How much of any one question is kept. */
export const MAX_ASKED_CHARS = 240;

export type LearningEvent =
  | LessonStartedEvent
  | QuestionPresentedEvent
  | AnswerSubmittedEvent
  | SupportUsedEvent
  | LessonCompletedEvent
  | LessonAbandonedEvent
  | KodaConversationEvent;

export type LearningEventType = LearningEvent["type"];

/**
 * The JSON body a backend will receive, and the shape persisted today.
 *
 * Batched rather than one-event-per-request because a round produces ~30 events
 * in a couple of minutes, and a child's tablet should not make 30 round trips.
 * `sentAt` is separate from each event's `ts` so a server can tell a delayed
 * upload from a delayed answer.
 */
export interface LearningEventBatch {
  schemaVersion: number;
  /** Which app produced these, for triaging a bad release. */
  appVersion?: string;
  sentAt: string;
  events: LearningEvent[];
}

/**
 * Below this, a wrong answer was a guess rather than an attempt.
 *
 * 700ms is under the time a 5-year-old needs to read a prompt, look at a set and
 * choose — so a wrong answer that fast tells you about engagement, not ability,
 * and should not be treated as a misconception to remediate. Applied only to
 * wrong answers: a fast *right* answer is fluency, which is the goal.
 */
export const GUESS_THRESHOLD_MS = 700;
