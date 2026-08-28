import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK, SkillResult } from "../../types";
import type { ErrorKind, SupportKind } from "../../../lib/learning/events";
import { scoreRound, type RoundScore } from "./scoreRound";
import { playAnswerSound } from "./answerSound";

/**
 * The round every skill plays, in one place.
 *
 * A round is the same shape everywhere: ask a question, take answers until one
 * is right, move on, and close out with stars and XP. Both skills wrote that by
 * hand and both got parts of it wrong — counting reported three stars from its
 * first correct answer, addition awarded no XP at all, and each fired the five
 * learning calls in its own order. None of those were hard bugs; they were the
 * cost of writing the same loop twice.
 *
 * A skill supplies the questions and judges the answers. This owns everything
 * between: the counters, the ordering, the telemetry, the score.
 */

export interface RoundQuestion {
  /** Stable for the whole question, including repeat attempts. */
  id: string;
  /** Short machine key for what is being asked, e.g. "count_total". */
  taskKind: string;
  /** The question as the child saw it. Authored copy, never child input. */
  prompt?: string;
  expected?: string;
  itemCount?: number;
}

/** What a skill reports back about one submitted answer. */
export interface AnswerOutcome {
  correct: boolean;
  /** What the child chose, as text. */
  given?: string;
  /** The right answer, when only known at answer time. */
  expected?: string;
  errorKind?: ErrorKind;
  /** Shown in the feedback message. Short words. */
  title: string;
  message?: string;
}

export interface RoundFeedback extends AnswerOutcome {
  /** `correct` decides the tone; kept separate so copy can vary. */
  status: "correct" | "incorrect";
}

export interface UseSkillRoundOptions {
  koda: KodaSDK;
  /** Questions in a round. From the lesson, not from this hook. */
  totalQuestions: number;
  levelNumber: number;
  /** Called to build question n. The skill owns what a question is. */
  nextQuestion(index: number): RoundQuestion;
  /** Told when the round is over, after the log is closed. */
  onComplete?(result: SkillResult): void;
  /** Entry point, for keeping teacher previews out of a child's record. */
  entry?: "path" | "picker" | "preview";
  /**
   * A line spoken once as the lesson opens — the lesson's `audioPrompt`.
   *
   * A five-year-old cannot read the instruction, so a lesson that only shows it
   * has not given it to them. Said here rather than in each activity because
   * every round opens the same way, and an activity that forgot would simply be
   * silent with no sign anything was missing.
   */
  intro?: string;
  /**
   * Hold back `present` until the skill says the question is describable.
   *
   * A skill whose question text is derived from state it sets — rather than
   * returned by `nextQuestion` — cannot describe the question in the same tick
   * it asks for one. Counting is the case: fifteen level types each set their
   * own state, and the prompt is read afterwards. With this on, the hook records
   * the question and waits for `describeQuestion`.
   */
  deferPresent?: boolean;
}

export interface RoundController {
  /** 1-based. */
  index: number;
  question: RoundQuestion;
  /** Attempts on the open question, starting at 1. */
  attempt: number;
  /** Correct-first-time answers so far. What stars are scored from. */
  firstTryCount: number;
  feedback: RoundFeedback | null;
  /** Set once the round is over. */
  score: RoundScore | null;
  /** Report an answer. Wrong answers keep the same question. */
  submit(outcome: AnswerOutcome): void;
  /** Move on from the feedback: next question, or finish the round. */
  advance(): void;
  /** A hint, replay or reveal was taken. */
  useSupport(kind: SupportKind, hintLevel?: number): void;
  /** Start again at question 1. */
  restart(): void;
  /** Only with `deferPresent`: report the question, once it can be described. */
  describeQuestion(details: { prompt?: string; expected?: string; itemCount?: number }): void;
}

export function useSkillRound({
  koda,
  totalQuestions,
  levelNumber,
  nextQuestion,
  onComplete,
  entry = "path",
  intro,
  deferPresent = false,
}: UseSkillRoundOptions): RoundController {
  const [index, setIndex] = useState(1);
  const [question, setQuestion] = useState<RoundQuestion>(() => nextQuestion(1));
  const [attempt, setAttempt] = useState(1);
  const [firstTryCount, setFirstTryCount] = useState(0);
  const [feedback, setFeedback] = useState<RoundFeedback | null>(null);
  const [score, setScore] = useState<RoundScore | null>(null);

  /** Whether the open question has already been answered wrongly once. */
  const missedRef = useRef(false);
  /** Callbacks read through a ref: a skill writes them as inline arrows, so
   *  depending on them directly would restart the round on every render. */
  const fns = useRef({ nextQuestion, onComplete });
  fns.current = { nextQuestion, onComplete };

  /** The question awaiting description, when `deferPresent` is on. */
  const pendingRef = useRef<{ q: RoundQuestion; n: number } | null>(null);

  const present = useCallback(
    (q: RoundQuestion, n: number) => {
      if (deferPresent) {
        pendingRef.current = { q, n };
        return;
      }
      koda.learning.present({
        questionId: q.id,
        index: n,
        taskKind: q.taskKind,
        prompt: q.prompt,
        expected: q.expected,
        itemCount: q.itemCount,
      });
    },
    [koda, deferPresent],
  );

  const describeQuestion = useCallback(
    (details: { prompt?: string; expected?: string; itemCount?: number }) => {
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      koda.learning.present({
        questionId: pending.q.id,
        index: pending.n,
        taskKind: pending.q.taskKind,
        prompt: details.prompt ?? pending.q.prompt,
        expected: details.expected ?? pending.q.expected,
        itemCount: details.itemCount ?? pending.q.itemCount,
      });
    },
    [koda],
  );

  /** React invokes mount effects twice in development; the log must not gain a
   *  phantom lesson_started and question_presented on every entry. */
  const openedRef = useRef(false);

  // The round opens once. `startLesson` must land before the first `present`,
  // or the first question's response time is measured against nothing.
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    koda.learning.startLesson(entry, levelNumber);
    koda.log("START_LEVEL", `Round opened at level ${levelNumber}`, levelNumber, 1);
    present(question, 1);
    // Not in a preview: a teacher checking a lesson does not need it read out.
    if (intro && entry !== "preview" && koda.config.isEnabled("audio_speech", true)) {
      void koda.speech.say(intro);
    }
    return () => koda.learning.abandonLesson();
    // Mount only: re-running this would open a second lesson mid-round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    (outcome: AnswerOutcome) => {
      // One answer per question at a time: a second submit while feedback is
      // showing is a double tap, not a second attempt.
      if (feedback) return;

      koda.learning.answered({
        questionId: question.id,
        correct: outcome.correct,
        given: outcome.given,
        expected: outcome.expected ?? question.expected,
        errorKind: outcome.errorKind,
      });
      koda.log(
        "CHECK_ANSWER",
        `${question.prompt ?? question.taskKind}: ${outcome.given ?? "answered"} (${
          outcome.correct ? "correct" : "wrong"
        })`,
        levelNumber,
        index,
      );

      if (!outcome.correct) {
        missedRef.current = true;
        setAttempt((n) => n + 1);
      }

      setFeedback({ ...outcome, status: outcome.correct ? "correct" : "incorrect" });

      // Spoken reaction for this question. After `setFeedback`, never before:
      // the child being told whether they were right must not depend on
      // anything a sound does. `answerSound.ts` owns the switches and the
      // choice of clip.
      playAnswerSound(koda, outcome.correct);
    },
    [feedback, question, koda, levelNumber, index],
  );

  const finish = useCallback(
    (correctFirstTry: number) => {
      const result = scoreRound({ correctFirstTry, total: totalQuestions });
      // Close the log first: the host may unmount the activity the moment it
      // hears the result, and the round's own event would go with it.
      koda.learning.completeLesson({ stars: result.stars, xpEarned: result.xp });
      koda.log(
        "EARN_XP",
        `Round finished: ${result.stars} stars, +${result.xp} XP`,
        levelNumber,
        totalQuestions,
      );
      // XP reaches the learner only through the SDK. `onComplete` records it.
      void koda.progress.awardXp(result.xp);
      setScore(result);
      fns.current.onComplete?.({
        levelNumber,
        stars: result.stars,
        xpEarned: result.xp,
        accuracy: correctFirstTry / Math.max(1, totalQuestions),
      });
    },
    [koda, levelNumber, totalQuestions],
  );

  const advance = useCallback(() => {
    // A wrong answer stays on the same question — that is what makes "right on
    // the second try" different from "right first time" in the log.
    if (feedback?.status === "incorrect") {
      setFeedback(null);
      return;
    }

    const earned = missedRef.current ? 0 : 1;
    const nextFirstTry = firstTryCount + earned;
    setFirstTryCount(nextFirstTry);
    setFeedback(null);

    if (index >= totalQuestions) {
      finish(nextFirstTry);
      return;
    }

    const n = index + 1;
    const q = fns.current.nextQuestion(n);
    missedRef.current = false;
    setAttempt(1);
    setIndex(n);
    setQuestion(q);
    koda.log("NEXT_QUESTION", `Moving to question ${n}`, levelNumber, n);
    present(q, n);
  }, [feedback, firstTryCount, index, totalQuestions, finish, koda, levelNumber, present]);

  const useSupport = useCallback(
    (kind: SupportKind, hintLevel?: number) => {
      koda.learning.supportUsed(kind, hintLevel);
      koda.log(
        kind === "audio_replay" ? "PLAY_AUDIO" : "OPEN_TIP",
        `Support used: ${kind}`,
        levelNumber,
        index,
      );
    },
    [koda, levelNumber, index],
  );

  const restart = useCallback(() => {
    const q = fns.current.nextQuestion(1);
    missedRef.current = false;
    setIndex(1);
    setQuestion(q);
    setAttempt(1);
    setFirstTryCount(0);
    setFeedback(null);
    setScore(null);
    koda.learning.startLesson(entry, levelNumber);
    present(q, 1);
  }, [koda, entry, levelNumber, present]);

  return {
    index,
    question,
    attempt,
    firstTryCount,
    feedback,
    score,
    submit,
    advance,
    useSupport,
    restart,
    describeQuestion,
  };
}
