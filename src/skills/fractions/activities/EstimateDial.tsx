import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { FractionBar } from "../internal/ui/FractionBar";
import {
  buildEstimateQuestion,
  explainEstimate,
  isEstimateCorrect,
  nameOf,
  type EstimateMode,
  type EstimateQuestion,
  type EstimateSetup,
} from "../internal/data/fractionEstimate";

/**
 * Judging, before any calculating.
 *
 * Nothing on this screen can be worked out, which is the design: there is no
 * number to type and no pieces to cut, only a strip with nothing, a half and a
 * whole one marked on it, and a question about roughly where something lands.
 *
 * It is the last thing most people keep. An adult who has forgotten how to add
 * fractions still knows that a half and a third is more than a half, and that
 * is the skill that catches a wrong answer on a calculator.
 */

interface DialParams {
  question?: EstimateSetup;
  mode?: EstimateMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: DialParams, index: number, seen?: Set<string>): EstimateQuestion {
  const setup: EstimateSetup = { ...params, ...params.question };
  const mode = modeAt<EstimateMode>(setup, index + 1, "benchmark");
  return buildEstimateQuestion(setup, mode, index, seen);
}

export const promptFor = (question: EstimateQuestion): string => question.prompt;

export function estimateHints(question: EstimateQuestion): string[] {
  if (question.mode === "benchmark") {
    return composeHints(
      "Do not work anything out. Just look at where it lands on the strip.",
      "Halfway along is a half. The far end is one whole.",
      "Ask which of the three marks it is closest to.",
    );
  }
  return composeHints(
    "You do not have to add them. You only have to judge the answer.",
    `Lay ${nameOf(question.left!)} and ${nameOf(question.right!)} along the strip, one after the other.`,
    "An answer smaller than one of the pieces you started with cannot be their total.",
  );
}

/** The three marks a fraction is judged against. */
const MARKS = [
  { at: 0, label: "nothing" },
  { at: 0.5, label: "a half" },
  { at: 1, label: "one whole" },
];

export const EstimateDial: React.FC<ActivityProps<DialParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: EstimateSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const labelsEnabled = koda.config.isEnabled("part_labels", true);

  const seen = useMemo(() => new Set<string>(), []);
  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildQuestion(params, i - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as EstimateQuestion;

  if (!question) return null;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const answer = (text: string): void => {
    const correct = isEstimateCorrect(question, text);
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: text,
      expected: question.expected,
      title: correct ? "Yes!" : "Not yet",
      message: explainEstimate(question, correct),
    });
  };

  /** The strip with nothing, a half and one whole marked along it. */
  const ruler = (): React.ReactNode => (
    <div className="flex w-full max-w-sm flex-col gap-1" data-testid="ruler">
      <div className="relative h-3 w-full rounded-full bg-surface-muted">
        {MARKS.map((mark) => (
          <span
            key={mark.label}
            className="absolute top-0 h-3 w-0.5 bg-muted"
            style={{ left: `${mark.at * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        {MARKS.map((mark) => (
          <span key={mark.label}>{mark.label}</span>
        ))}
      </div>
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Roughly How Much?"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : estimateHints(question)}
      iconName="Gauge"
      iconTone="sky"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
        {question.mode === "benchmark" ? (
          <div className="flex flex-col items-center gap-1" data-testid="one-fraction">
            <FractionBar
              parts={question.fraction.parts}
              shaded={Array.from({ length: question.fraction.taken }, (_, i) => i)}
              label={`${nameOf(question.fraction)} of a strip`}
            />
            <span className="text-sm font-bold text-ink">{nameOf(question.fraction)}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1" data-testid="two-fractions">
            {[question.left!, question.right!].map((f, i) => (
              <FractionBar
                key={i}
                parts={f.parts}
                shaded={Array.from({ length: f.taken }, (_, k) => k)}
                scale={0.85}
                label={`${i === 0 ? "first" : "second"} piece, ${nameOf(f)}`}
              />
            ))}
            <p className="rounded-2xl bg-surface px-4 py-2 text-center text-base text-ink">
              Somebody says the answer is <span className="font-bold">{nameOf(question.claim!)}</span>.
            </p>
          </div>
        )}

        {ruler()}

        {labelsEnabled && !practising ? (
          <p className="text-xs text-muted">nothing to work out — just say roughly where it lands</p>
        ) : null}

        <div className="flex w-full flex-col gap-2">
          {question.options.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => answer(text)}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
