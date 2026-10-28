import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { FractionBar } from "../internal/ui/FractionBar";
import { printBar } from "../internal/ui/printFigures";
import {
  buildEstimateQuestion,
  explainEstimate,
  isEstimateCorrect,
  nameOf,
  type EstimateMode,
  type EstimateQuestion,
  type EstimateSetup,
} from "../internal/data/fractionEstimate";
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
      tf("est.hintB1"),
      tf("est.hintB2"),
      tf("est.hintB3"),
    );
  }
  return composeHints(
    tf("est.hintC1"),
    tf("est.hintC2", { left: nameOf(question.left!), right: nameOf(question.right!) }),
    tf("est.hintC3"),
  );
}

/** The three marks a fraction is judged against. */
const MARKS = [
  { at: 0, get label() { return tf("est.markNothing"); } },
  { at: 0.5, get label() { return tf("est.markHalf"); } },
  { at: 1, get label() { return tf("est.markOne"); } },
];

export const EstimateDial: React.FC<ActivityProps<DialParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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

  const hints = !question || practising ? [] : estimateHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
  });

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
      title: correct ? tf("est.yes") : tf("est.notYet"),
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
      fallbackTitle={tf("est.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
      iconName="Gauge"
      iconTone="cyan"
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

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Estimation prints better than it plays.
 *
 * On screen the three answers are buttons. On paper level 50 asks the child to
 * write *why*, which is the thought the level is actually about and which no
 * button can record.
 */
export function printedFor(question: EstimateQuestion): { text: string; answer: string } | null {
  if (question.mode === "benchmark") {
    return {
      text: tf("est.printBench", { fraction: nameOf(question.fraction) }),
      answer: question.expected,
    };
  }
  return {
    text: tf("est.printClaim", { left: nameOf(question.left!), right: nameOf(question.right!), claim: nameOf(question.claim!) }),
    answer: question.expected,
  };
}

export const figureFor = (question: EstimateQuestion): React.ReactNode | null =>
  question.mode === "benchmark" ? printBar(question.fraction.parts, question.fraction.taken) : null;

export function methodFor(question: EstimateQuestion): string[] | null {
  if (question.mode === "benchmark") {
    return [
      tf("est.methodB1"),
      tf("est.methodB2"),
    ];
  }
  return [
    tf("est.methodC1"),
    tf("est.methodC2"),
  ];
}
