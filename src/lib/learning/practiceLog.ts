import type { LearningEvent } from "./events";
import { GUESS_THRESHOLD_MS } from "./events";
import { LearningLog } from "./learningLog";

/**
 * Practice, read as a record of speed.
 *
 * The learning log already answers "does this child understand it?" — that is
 * mastery, and it is deliberately slow to judge. This answers a different
 * question a grown-up asks out loud: *who is quick, and how quick?* Those are
 * not the same measurement and must not be folded together, which is why
 * everything here is derived from practice rounds alone.
 *
 * A teaching round is a child being walked through a technique with hints, a
 * spoken prompt and an explanation after every answer. Timing that measures how
 * long Koda talked for. A practice round has all of it switched off
 * (`kit/practice.ts`), so the clock between the question appearing and the
 * answer landing is the child thinking — the only interval worth calling speed.
 *
 * Nothing is stored: every row is folded out of the events on each read, so this
 * can never drift from the log it claims to summarise, and a grown-up reading a
 * standing can always drill into the individual answers that produced it. That
 * matters more here than anywhere else in the app — a speed table is the one
 * screen someone will want to argue with.
 */

/**
 * Answers needed before a speed figure is reported at all.
 *
 * The same bar mastery uses (`MIN_EVIDENCE`), for the same reason: three quick
 * answers is a child who drew three easy questions. Below this the standing is
 * still listed — hiding a learner reads as a bug — but it is marked as not yet
 * judgeable rather than ranked against somebody with a month of practice.
 */
export const MIN_PRACTICE_ANSWERS = 8;

/**
 * How many answers each end of a "getting faster" comparison uses.
 *
 * Eight and eight, so a learner needs sixteen practice answers before the app
 * will claim a trend. A median over eight is stable enough to survive one
 * daydream, and a smaller window turns a single slow question into a headline.
 */
export const TREND_SAMPLE = 8;

/** One practice answer, at the grain a grown-up can check. */
export interface PracticeAnswer {
  questionId: string;
  runId: string;
  learnerId: string;
  skillId: string;
  lessonId: string;
  conceptKey: string;
  levelNumber?: number;
  /** When the question went on screen. ISO, UTC. */
  askedAt: string;
  localDay: string;
  /** The question as the child saw it, when the skill reported it. */
  prompt?: string;
  given?: string;
  expected?: string;
  /** First attempt only — a retry measures memory of the answer just seen. */
  correct: boolean;
  /** No hint, no replay. Practice takes the scaffolding away, but a skill may
   *  still offer something, and an aided answer is not a speed record. */
  unaided: boolean;
  responseMs: number;
  /**
   * Faster than thinking takes.
   *
   * A correct answer under `GUESS_THRESHOLD_MS` is a tap that happened to land,
   * and it is exactly what a speed table would reward if nobody excluded it.
   * Kept in the log, kept out of every record.
   */
  guessed: boolean;
}

/** One practice round, finished or not. */
export interface PracticeRun {
  runId: string;
  learnerId: string;
  sessionId: string;
  skillId: string;
  lessonId: string;
  conceptKey: string;
  levelNumber?: number;
  startedAt: string;
  localDay: string;
  /** Played to the end. A round left part-way still counts as practice done. */
  finished: boolean;
  /** Left part-way with answers behind it — the log says so rather than guessing. */
  abandoned: boolean;
  questionsAnswered: number;
  correctFirstTry: number;
  /** Unaided first-try accuracy, 0..1. */
  accuracy: number;
  /** Typical thinking time in this round. Median, so one pause cannot set it. */
  medianResponseMs: number;
  /** Quickest answer that was right, unaided and not a guess. */
  fastestCorrectMs?: number;
  supportsUsed: number;
  /** Wall clock inside the round, when the round reported an end. */
  durationMs?: number;
}

/** What one learner's practice adds up to. */
export interface PracticeStanding {
  learnerId: string;
  runs: number;
  runsFinished: number;
  questionsAnswered: number;
  /** Unaided first-try accuracy across all practice, 0..1. */
  accuracy: number;
  /** Their usual pace: median first-attempt response over all practice. */
  medianResponseMs: number;
  /** Their best: quickest correct, unaided, non-guess answer. "Top speed". */
  fastestCorrectMs?: number;
  daysPractised: number;
  lastPractisedTs: string;
  /**
   * How much quicker their recent practice is than their earliest, as a
   * percentage of the earlier pace. Positive means getting faster.
   *
   * This is the "fast learner" figure, and it is a different claim from being
   * quick: a child who starts slow and halves their time has learned more than
   * one who was fast on day one and has not moved. Undefined until there are
   * `2 × TREND_SAMPLE` answers to compare.
   */
  speedUpPercent?: number;
  /** Accuracy over the same two windows, so a speed-up bought by guessing shows. */
  accuracyChange?: number;
  /** Whether there is enough practice to report a pace at all. */
  enoughEvidence: boolean;
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
};

/**
 * Whether an event happened in practice.
 *
 * The flag is the answer. The id check behind it reads events written before
 * the flag existed, where the alternative is a log that says a device has never
 * practised — and every practice lesson the course ships is `practice-…`, which
 * is asserted in `curriculum/practice.test.ts`. New events never reach it.
 */
export const isPracticeEvent = (event: LearningEvent): boolean =>
  event.practice === true || (event.practice === undefined && /^practice[-_]/i.test(event.lessonId));

/** Which round an event belongs to. One lesson at a time, per learner, per session. */
const runKeyOf = (event: LearningEvent): string =>
  `${event.learnerId}|${event.sessionId}|${event.lessonId}`;

interface Building {
  run: PracticeRun;
  /** First attempts, in the order they were answered. */
  answers: PracticeAnswer[];
  /** Questions on screen but not yet answered, by the log's question id. */
  open: Map<string, { askedAt: string; prompt?: string; expected?: string; supports: number }>;
}

const startRun = (event: LearningEvent, runId: string): Building => ({
  run: {
    runId,
    learnerId: event.learnerId,
    sessionId: event.sessionId,
    skillId: event.skillId,
    lessonId: event.lessonId,
    conceptKey: event.conceptKey,
    levelNumber: event.levelNumber,
    startedAt: event.ts,
    localDay: event.localDay ?? event.ts.slice(0, 10),
    finished: false,
    abandoned: false,
    questionsAnswered: 0,
    correctFirstTry: 0,
    accuracy: 0,
    medianResponseMs: 0,
    supportsUsed: 0,
  },
  answers: [],
  open: new Map(),
});

const closeRun = (building: Building): PracticeRun => {
  const { run, answers } = building;
  const unaidedCorrect = answers.filter((a) => a.correct && a.unaided);
  const clean = unaidedCorrect.filter((a) => !a.guessed).map((a) => a.responseMs);

  run.questionsAnswered = answers.length;
  run.correctFirstTry = unaidedCorrect.length;
  run.accuracy = answers.length > 0 ? unaidedCorrect.length / answers.length : 0;
  run.medianResponseMs = median(answers.map((a) => a.responseMs));
  run.fastestCorrectMs = clean.length > 0 ? Math.min(...clean) : undefined;
  return run;
};

interface PracticeFold {
  runs: PracticeRun[];
  answers: PracticeAnswer[];
}

/**
 * Fold the log into practice rounds and the answers inside them.
 *
 * One walk, in recorded order. A round whose `lesson_started` has aged out of
 * the ring still appears — it opens on the first event that mentions it —
 * because a partial round is a real thing that happened, and dropping it would
 * quietly shorten a child's record.
 */
const foldPractice = (filter?: { skillId?: string; learnerId?: string }): PracticeFold => {
  const building = new Map<string, Building>();
  const runs: PracticeRun[] = [];
  const answers: PracticeAnswer[] = [];

  const finish = (key: string) => {
    const open = building.get(key);
    if (!open) return;
    building.delete(key);
    // A round nobody answered anything in is a mis-tap, not practice.
    if (open.answers.length > 0) runs.push(closeRun(open));
  };

  for (const event of LearningLog.all({ skillId: filter?.skillId })) {
    if (!isPracticeEvent(event)) continue;
    if (filter?.learnerId && event.learnerId !== filter.learnerId) continue;

    const key = runKeyOf(event);

    if (event.type === "lesson_started") {
      finish(key);
      building.set(key, startRun(event, event.id));
      continue;
    }

    let open = building.get(key);
    if (!open) {
      open = startRun(event, `run_${event.id}`);
      building.set(key, open);
    }

    switch (event.type) {
      case "question_presented":
        open.open.set(event.questionId, {
          askedAt: event.ts,
          prompt: event.prompt,
          expected: event.expected,
          supports: 0,
        });
        break;

      case "support_used":
        open.run.supportsUsed += 1;
        if (event.questionId) {
          const question = open.open.get(event.questionId);
          if (question) question.supports += 1;
        }
        break;

      case "answer_submitted": {
        // First attempts only: a second try is answering a question whose
        // answer the child has just been shown, which is not a speed test.
        if (event.attempt !== 1) break;
        const question = open.open.get(event.questionId);
        const answer: PracticeAnswer = {
          questionId: event.questionId,
          runId: open.run.runId,
          learnerId: event.learnerId,
          skillId: event.skillId,
          lessonId: event.lessonId,
          conceptKey: event.conceptKey,
          levelNumber: event.levelNumber,
          askedAt: question?.askedAt ?? event.ts,
          localDay: event.localDay ?? event.ts.slice(0, 10),
          prompt: question?.prompt,
          given: event.given,
          expected: event.expected ?? question?.expected,
          correct: event.correct,
          unaided: event.supportsUsed === 0,
          responseMs: event.responseMs,
          guessed: event.responseMs < GUESS_THRESHOLD_MS,
        };
        open.answers.push(answer);
        answers.push(answer);
        break;
      }

      case "lesson_completed":
        open.run.finished = true;
        open.run.durationMs = event.durationMs;
        finish(key);
        break;

      case "lesson_abandoned":
        open.run.abandoned = true;
        open.run.durationMs = event.durationMs;
        finish(key);
        break;
    }
  }

  // Rounds still in progress when the log was read — the child is playing right
  // now, or closed the tab mid-question. Either way it happened.
  for (const key of [...building.keys()]) finish(key);

  runs.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
  return { runs, answers };
};

/** Every practice round in the log, oldest first. */
export const getPracticeRuns = (filter?: {
  skillId?: string;
  learnerId?: string;
}): PracticeRun[] => foldPractice(filter).runs;

/** Every first-attempt practice answer, in the order they were given. */
export const getPracticeAnswers = (filter?: {
  skillId?: string;
  learnerId?: string;
}): PracticeAnswer[] => foldPractice(filter).answers;

/**
 * The quickest answers on record — the rows behind a "top speed".
 *
 * Right, unaided and above the guess threshold, so every row is one a grown-up
 * can look at and agree with. Fastest first.
 */
export const getTopSpeeds = (
  limit = 10,
  filter?: { skillId?: string; learnerId?: string },
): PracticeAnswer[] =>
  getPracticeAnswers(filter)
    .filter((a) => a.correct && a.unaided && !a.guessed)
    .sort((a, b) => a.responseMs - b.responseMs)
    .slice(0, limit);

/**
 * One standing per learner, quickest first.
 *
 * Learners with too little practice to judge are still listed — a missing child
 * reads as the app losing their work — but they sort last and carry
 * `enoughEvidence: false`, and the panel says so rather than ranking them.
 */
export const getPracticeStandings = (filter?: { skillId?: string }): PracticeStanding[] => {
  const { runs, answers } = foldPractice(filter);

  const byLearner = new Map<string, { runs: PracticeRun[]; answers: PracticeAnswer[] }>();
  const bucket = (learnerId: string) => {
    const found = byLearner.get(learnerId);
    if (found) return found;
    const fresh = { runs: [] as PracticeRun[], answers: [] as PracticeAnswer[] };
    byLearner.set(learnerId, fresh);
    return fresh;
  };
  for (const run of runs) bucket(run.learnerId).runs.push(run);
  for (const answer of answers) bucket(answer.learnerId).answers.push(answer);

  const standings: PracticeStanding[] = [];
  for (const [learnerId, held] of byLearner) {
    const { answers: mine, runs: myRuns } = held;
    const unaidedCorrect = mine.filter((a) => a.correct && a.unaided);
    const clean = unaidedCorrect.filter((a) => !a.guessed).map((a) => a.responseMs);

    // Chronological, so "earliest" and "most recent" mean what they say even
    // when two rounds were played out of order across a sync.
    const ordered = [...mine].sort((a, b) => (a.askedAt < b.askedAt ? -1 : 1));
    let speedUpPercent: number | undefined;
    let accuracyChange: number | undefined;
    if (ordered.length >= TREND_SAMPLE * 2) {
      const early = ordered.slice(0, TREND_SAMPLE);
      const late = ordered.slice(-TREND_SAMPLE);
      const earlyPace = median(early.map((a) => a.responseMs));
      const latePace = median(late.map((a) => a.responseMs));
      if (earlyPace > 0) {
        speedUpPercent = ((earlyPace - latePace) / earlyPace) * 100;
        const rate = (window: PracticeAnswer[]) =>
          window.filter((a) => a.correct && a.unaided).length / window.length;
        accuracyChange = rate(late) - rate(early);
      }
    }

    standings.push({
      learnerId,
      runs: myRuns.length,
      runsFinished: myRuns.filter((r) => r.finished).length,
      questionsAnswered: mine.length,
      accuracy: mine.length > 0 ? unaidedCorrect.length / mine.length : 0,
      medianResponseMs: median(mine.map((a) => a.responseMs)),
      fastestCorrectMs: clean.length > 0 ? Math.min(...clean) : undefined,
      daysPractised: new Set(mine.map((a) => a.localDay)).size,
      lastPractisedTs: ordered[ordered.length - 1]?.askedAt ?? "",
      speedUpPercent,
      accuracyChange,
      enoughEvidence: mine.length >= MIN_PRACTICE_ANSWERS,
    });
  }

  return standings.sort((a, b) => {
    if (a.enoughEvidence !== b.enoughEvidence) return a.enoughEvidence ? -1 : 1;
    return a.medianResponseMs - b.medianResponseMs;
  });
};
