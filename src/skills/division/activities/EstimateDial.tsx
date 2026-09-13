import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import {
  buildEstimateQuestion,
  friendliestTotal,
  type EstimateMode,
  type EstimateQuestion,
  type EstimateSetup,
} from "../internal/data/divisionEstimate";

/**
 * Estimating, judging, and checking.
 *
 * The whole engine turns on one thing: division rounds to numbers that *divide*,
 * not to the nearest ten. `347 ÷ 6` is about `360 ÷ 6`, and 350 — the nearer
 * number — is the wrong choice. So the divisor is never touched and the total
 * moves to whichever neighbouring multiple is friendlier, which is a judgement
 * rather than a rule and is offered as a choice between two.
 */

interface EstimateParams {
  question?: EstimateSetup;
  mode?: EstimateMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: EstimateParams, index: number): EstimateQuestion {
  const setup: EstimateSetup = { ...params, ...params.question };
  const mode = modeAt<EstimateMode>(setup, index + 1, "compatible");
  return buildEstimateQuestion(setup, mode, index);
}

export const promptFor = (question: EstimateQuestion): string => question.prompt;

export function estimateHints(question: EstimateQuestion): string[] {
  switch (question.mode) {
    case "compatible":
      return composeHints(
        `Leave the ${question.divisor} alone. Move the big number instead.`,
        `Find a number near ${question.dividend} that ${question.divisor} goes into exactly.`,
        "Take the one that is easiest to divide, not the one that is nearest.",
      );
    case "reasonable":
      return composeHints(
        "Do not work it out. Just think about how big the answer should be.",
        `Roughly how many ${question.divisor}s are in ${question.dividend}?`,
        "An answer ten times too big or too small is the commonest slip there is.",
      );
    default:
      return composeHints(
        "To check a division, multiply back.",
        "Your answer, times the number you divided by, should give the total back.",
        "If there was a remainder, add it on at the end.",
      );
  }
}

export const EstimateDial: React.FC<ActivityProps<EstimateParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: EstimateSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    /*
     * Nothing is read to the child when a round opens.
     *
     * The opening line exists because a five-year-old cannot read the
     * instruction. This skill starts at seven, and reading the question aloud
     * to a reader takes the reading out of the question — which in levels 49
     * to 55 is most of the work. The speaker button is still there for a child
     * who needs it; it is pull, not push. See `voice.json`.
     */
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1), [params]),
    onComplete,
  });
  const question = round.question as EstimateQuestion;

  if (!question) return null;

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not quite", message });
  };

  const chooseTotal = (candidate: number): void => {
    const best = friendliestTotal(question.dividend, question.divisor);
    const correct = candidate === best;
    submit(
      String(candidate / question.divisor),
      correct,
      correct
        ? `${candidate} ÷ ${question.divisor} = ${candidate / question.divisor}. That is about right.`
        : `${candidate} works too, but ${best} is easier to divide by ${question.divisor}.`,
    );
  };

  const judge = (said: boolean): void => {
    const correct = said === (question.fault === "right");
    submit(
      said ? "yes" : "no",
      correct,
      correct
        ? question.fault === "right"
          ? "It is about the right size."
          : question.fault === "ten-times-too-big"
            ? "Ten times too big — a digit has ended up in the wrong column."
            : question.fault === "ten-times-too-small"
              ? "Ten times too small — a place has been lost."
              : "A zero has been dropped out of the middle."
        : `About how many ${question.divisor}s fit into ${question.dividend}?`,
    );
  };

  const checkWith = (text: string): void => {
    const correct = text === question.expected;
    submit(text, correct, correct ? "That rebuilds the total." : "Multiply your answer by the number you divided by.");
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="About How Much?"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : estimateHints(question)}
      iconName="Gauge"
      iconTone="cyan"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.mode === "compatible" ? (
          <>
            <p className="text-center text-sm text-muted">
              Which total is easier to divide by {question.divisor}?
            </p>
            <div className="flex justify-center gap-3">
              {(question.neighbours ?? []).map((candidate, i) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => chooseTotal(candidate)}
                  disabled={!!round.feedback}
                  className="min-h-11 flex-1 rounded-2xl bg-surface px-4 py-3 text-center shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <span className="block text-xl font-bold text-ink">{candidate}</span>
                  <span className="block text-xs text-muted">
                    ÷ {question.divisor} = {(question.estimates ?? [])[i]}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {question.mode === "reasonable" ? (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => judge(true)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-28 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Could be
            </button>
            <button
              type="button"
              onClick={() => judge(false)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-28 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              No chance
            </button>
          </div>
        ) : null}

        {question.mode === "check_back" ? (
          <div className="flex flex-col gap-2">
            {(question.rebuilds ?? []).map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => checkWith(text)}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: EstimateQuestion): { text: string; answer: string } | null {
  switch (question.mode) {
    case "compatible":
      return {
        text: `About how much is ${question.dividend} ÷ ${question.divisor}?`,
        answer: question.expected,
      };
    case "reasonable":
      return {
        text: `Somebody says ${question.dividend} ÷ ${question.divisor} = ${question.claim}. Could that be right?   yes / no`,
        answer: question.expected,
      };
    default:
      return {
        text: `${question.dividend} ÷ ${question.divisor} = ${question.quotient}${question.remainder ? ` r ${question.remainder}` : ""}. Write the sum that checks it.`,
        answer: question.expected,
      };
  }
}

export function methodFor(): string[] {
  return [
    "Leave the number you are dividing by alone, and move the total instead.",
    "Divide that instead. The answer is about right.",
    "To check a division for real, multiply the answer back and add any remainder.",
  ];
}
