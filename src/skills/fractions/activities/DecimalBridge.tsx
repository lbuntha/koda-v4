import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { FractionBar } from "../internal/ui/FractionBar";
import { printBar, printHundred } from "../internal/ui/printFigures";
import {
  buildDecimalQuestion,
  decimalText,
  explainDecimal,
  isDecimalCorrect,
  nameOf,
  percentOf,
  type DecimalMode,
  type DecimalQuestion,
  type DecimalSetup,
} from "../internal/data/fractionDecimal";

/**
 * One number, three names.
 *
 * Nothing here refuses an answer, because nothing here is built: the picture is
 * already drawn and the question is what to call it. The teaching is in the
 * picture being the *same* picture across all six levels — a hundred squares
 * with some of them shaded — so that `3/4`, `0.75` and `75%` are visibly one
 * amount rather than three topics that happen to be taught in the same week.
 */

interface BridgeParams {
  question?: DecimalSetup;
  mode?: DecimalMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: BridgeParams, index: number, seen?: Set<string>): DecimalQuestion {
  const setup: DecimalSetup = { ...params, ...params.question };
  const mode = modeAt<DecimalMode>(setup, index + 1, "tenths");
  return buildDecimalQuestion(setup, mode, index, seen);
}

export const promptFor = (question: DecimalQuestion): string => question.prompt;

export function decimalHints(question: DecimalQuestion): string[] {
  switch (question.mode) {
    case "tenths":
      return composeHints(
        "The first place after the point counts tenths.",
        "So the top number goes straight into that first place.",
        "Nothing else moves. There is only one place to fill.",
      );
    case "hundredths":
      return composeHints(
        "Two places after the point means hundredths.",
        "The first place is tenths and the second is hundredths, so both digits are used.",
        "Fifty-eight hundredths fills both places, in that order.",
      );
    case "by_dividing":
      return composeHints(
        "A fraction is a division waiting to happen: the top shared between the bottom.",
        "Divide the top number by the bottom one, carrying on past the point.",
        "It stops rather than running on forever, because of which bottom number this is.",
      );
    case "from_decimal":
      return composeHints(
        "Count the places after the point. One place is tenths, two places is hundredths.",
        "Write the digits over that bottom number.",
        "Then cut it down as far as it goes.",
      );
    case "percent":
      return composeHints(
        "Percent means out of a hundred, and nothing else.",
        "So write the fraction with a hundred underneath it first.",
        "The top number of that is the percentage.",
      );
    default:
      return composeHints(
        "All three names have to be worth the same amount.",
        "Check the decimal first: how many hundredths is it?",
        "The percent should be that same number of hundredths.",
      );
  }
}

export const DecimalBridge: React.FC<ActivityProps<BridgeParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: DecimalSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as DecimalQuestion;

  const hints = !question || practising ? [] : decimalHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
  });

  if (!question) return null;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const answer = (text: string): void => {
    const correct = isDecimalCorrect(question, text);
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
      message: explainDecimal(question, correct),
    });
  };

  /**
   * How much of the picture is shaded, in the picture's own pieces.
   *
   * Exact by construction: the hundred-square is only ever used for fractions
   * that divide a hundred, and everything else draws its own denominator.
   */
  const shadedCount =
    question.grid === "fraction"
      ? question.fraction.taken
      : (question.fraction.taken * question.grid) / question.fraction.parts;

  /** The fraction's own bar, ten squares in a row, or a hundred in a block. */
  const picture = (): React.ReactNode => {
    if (question.grid === "fraction") {
      return (
        <div className="flex flex-col items-center gap-1" data-testid="own-bar">
          <FractionBar
            parts={question.fraction.parts}
            shaded={Array.from({ length: question.fraction.taken }, (_, i) => i)}
            label={`a strip in ${question.fraction.parts}, ${question.fraction.taken} shaded`}
          />
        </div>
      );
    }
    if (question.grid === 10) {
      return (
        <div className="flex flex-col items-center gap-1" data-testid="tenths">
          <FractionBar
            parts={10}
            shaded={Array.from({ length: shadedCount }, (_, i) => i)}
            label={`a strip in ten, ${shadedCount} shaded`}
          />
        </div>
      );
    }
    const cell = 12;
    return (
      <svg
        role="img"
        aria-label={`A hundred squares, ${shadedCount} shaded`}
        viewBox={`0 0 ${cell * 10} ${cell * 10}`}
        width={cell * 10 * 1.6}
        height={cell * 10 * 1.6}
        className="max-w-full"
        data-testid="hundred"
      >
        {Array.from({ length: 100 }).map((_, i) => (
          <rect
            key={i}
            x={(i % 10) * cell}
            y={Math.floor(i / 10) * cell}
            width={cell}
            height={cell}
            className={i < shadedCount ? "fill-violet-500" : "fill-surface-muted"}
            stroke="currentColor"
            strokeWidth={0.5}
          />
        ))}
      </svg>
    );
  };

  const wide = question.wants === "row";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="One Number, Three Names"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
      iconName="Percent"
      iconTone="indigo"
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
        {picture()}

        {labelsEnabled && !practising ? (
          <p className="text-xs text-muted">
            {shadedCount} of the {question.grid === "fraction" ? question.fraction.parts : question.grid}{" "}
            {question.grid === "fraction" ? "pieces" : "squares"} are shaded
          </p>
        ) : null}

        <div className={wide ? "flex w-full flex-col gap-2" : "flex flex-wrap justify-center gap-3"}>
          {question.options.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => answer(text)}
              disabled={!!round.feedback}
              className={
                wide
                  ? "min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  : "min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              }
            >
              {text}
            </button>
          ))}
        </div>

        {labelsEnabled && !practising && question.mode === "three_names" ? (
          <p className="text-xs text-muted">
            one of these rows is {nameOf(question.fraction)} written the other two ways
          </p>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/** Every one of these prints as a written conversion. */
export function printedFor(question: DecimalQuestion): { text: string; answer: string } | null {
  const f = question.fraction;
  switch (question.mode) {
    case "tenths":
    case "hundredths":
      return { text: `${nameOf(f)} = ______ as a decimal`, answer: question.expected };
    case "by_dividing":
      return { text: `${f.taken} ÷ ${f.parts} = ______ (write ${nameOf(f)} as a decimal)`, answer: question.expected };
    case "from_decimal":
      return {
        text: `${decimalText(f.taken, f.parts)} = ______ as a fraction in its simplest form`,
        answer: question.expected,
      };
    case "percent":
      return { text: `${nameOf(f)} = ______ %`, answer: question.expected };
    default:
      return {
        text: `Write ${nameOf(f)} as a decimal and as a percentage.`,
        answer: question.expected,
      };
  }
}

/** The hundred square, shaded, where the level is about hundredths. */
export const figureFor = (question: DecimalQuestion): React.ReactNode | null => {
  if (question.grid === "fraction") return printBar(question.fraction.parts, question.fraction.taken);
  const shaded = (question.fraction.taken * (question.grid as number)) / question.fraction.parts;
  return question.grid === 10 ? printBar(10, shaded) : printHundred(shaded);
};

export function methodFor(question: DecimalQuestion): string[] | null {
  switch (question.mode) {
    case "tenths":
      return ["The first place after the point counts tenths."];
    case "hundredths":
      return [
        "The first place after the point is tenths and the second is hundredths.",
        "Fifty-eight hundredths uses both places.",
      ];
    case "by_dividing":
      return [
        "The line in a fraction is a division sign.",
        "Divide the top by the bottom, carrying on past the point.",
      ];
    case "from_decimal":
      return [
        "Count the places after the point: one is tenths, two is hundredths.",
        "Write the digits over that number, then cut it down.",
      ];
    case "percent":
      return [
        "Percent means out of a hundred.",
        "Write the fraction with a hundred underneath; the top number is the percentage.",
      ];
    default:
      return ["A fraction, a decimal and a percentage can all be the same number."];
  }
}
