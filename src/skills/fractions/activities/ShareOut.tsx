import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { FractionBar } from "../internal/ui/FractionBar";
import { partWord } from "../internal/data/fractionNumbers";
import {
  DIVIDE_REFUSALS,
  buildDivideQuestion,
  divideBlockedBecause,
  explainDivide,
  isDivideCorrect,
  nameOf,
  type DivideBlock,
  type DivideMode,
  type DivideQuestion,
  type DivideSetup,
} from "../internal/data/fractionDivide";

/**
 * Dividing — which is mostly measuring, and mostly makes numbers bigger.
 *
 * The strip does the arguing. "How many halves fit in three?" has an answer a
 * child can count, and the answer is six, and six is bigger than three. That
 * fact has to be *seen* before it is written down, because written down it
 * contradicts four years of "dividing makes things smaller" and a child will
 * believe their memory over an equals sign.
 *
 * So the measuring levels refuse an answer until the strip is marked. Counting
 * pieces that are not there yet is guessing at a number-fact, which is the
 * habit these five levels exist to replace.
 */

interface ShareParams {
  question?: DivideSetup;
  mode?: DivideMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: ShareParams, index: number, seen?: Set<string>): DivideQuestion {
  const setup: DivideSetup = { ...params, ...params.question };
  const mode = modeAt<DivideMode>(setup, index + 1, "measure");
  return buildDivideQuestion(setup, mode, index, seen);
}

export const promptFor = (question: DivideQuestion): string => question.prompt;

export function divideHints(question: DivideQuestion): string[] {
  const divisor = question.divisor;
  const dividend = question.dividend;
  switch (question.mode) {
    case "measure":
      return composeHints(
        "Mark one whole strip into those pieces first, and count them.",
        "Every whole strip holds the same number of them.",
        "So count that many for each whole one you have.",
      );
    case "whole_by":
      return composeHints(
        "Cut every whole one into the pieces named at the bottom of the fraction.",
        `Now group them: the top number says how many pieces make one group.`,
        "Count the groups. That is what dividing by a fraction asks.",
      );
    case "by_whole":
      return composeHints(
        "This one is sharing, not measuring: one amount split between several people.",
        `Cut each ${partWord(dividend!.parts)} into ${question.shares} and give everybody one piece from each.`,
        "The pieces got smaller, so the bottom number gets bigger.",
      );
    case "explain_flip":
      return composeHints(
        "Dividing asks how many of the second one fit inside the first.",
        `The smaller ${nameOf(divisor!)} is, the more of them fit — so the answer grows as the divisor shrinks.`,
        "Turning the second fraction upside down and multiplying does exactly that.",
      );
    default:
      return composeHints(
        `Ask how many ${nameOf(divisor!)} fit inside ${nameOf(dividend!)}.`,
        "Cut both into the same-sized pieces so they can be compared.",
        "Then it is just counting how many of the second one fit.",
      );
  }
}

export const ShareOut: React.FC<ActivityProps<ShareParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: DivideSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as DivideQuestion;

  /** Which question's strip has been marked — keyed, so none inherits another's. */
  const [markedFor, setMarkedFor] = useState<string | null>(null);
  const [refused, setRefused] = useState<DivideBlock>(null);

  useEffect(() => {
    if (!question) return;
    setMarkedFor(null);
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const marked = !question.mustMark || markedFor === question.id;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const mark = (): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setMarkedFor(question.id);
  };

  const answer = (text: string): void => {
    const block = divideBlockedBecause(question, marked);
    if (block) {
      setRefused(block);
      say(DIVIDE_REFUSALS[block]);
      return;
    }
    const correct = isDivideCorrect(question, text);
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
      message: explainDivide(question, correct),
    });
  };

  /** The picture: whole strips to measure, or one strip to share out. */
  const picture = (): React.ReactNode => {
    if (question.sense === "share") {
      const f = question.dividend!;
      return (
        <div className="flex flex-col items-center gap-1" data-testid="sharing">
          <FractionBar
            parts={f.parts}
            shaded={Array.from({ length: f.taken }, (_, i) => i)}
            label={`${nameOf(f)} of a strip, to share between ${question.shares}`}
          />
          <span className="text-sm font-bold text-ink">
            {nameOf(f)} between {question.shares}
          </span>
        </div>
      );
    }

    const parts = question.divisor!.parts;
    const wholes = question.whole ?? 1;
    return (
      <div className="flex flex-col items-center gap-1" data-testid="measuring">
        {question.whole !== undefined ? (
          Array.from({ length: wholes }).map((_, i) => (
            <FractionBar
              key={i}
              parts={marked ? parts : 1}
              shaded={marked ? Array.from({ length: question.divisor!.taken }, (_, k) => k) : []}
              scale={0.8}
              label={
                marked
                  ? `whole ${i + 1}, marked into ${parts} ${partWord(parts, true)}`
                  : `whole ${i + 1}, not marked yet`
              }
            />
          ))
        ) : (
          <>
            <FractionBar
              parts={question.dividend!.parts}
              shaded={Array.from({ length: question.dividend!.taken }, (_, k) => k)}
              label={`${nameOf(question.dividend!)}, the amount being divided`}
            />
            <FractionBar
              parts={question.divisor!.parts}
              shaded={Array.from({ length: question.divisor!.taken }, (_, k) => k)}
              scale={0.8}
              label={`${nameOf(question.divisor!)}, what it is divided by`}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="How Many Fit?"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : divideHints(question)}
      onStartOver={
        question.mustMark && marked && !round.feedback
          ? () => {
              setMarkedFor(null);
              setRefused(null);
            }
          : undefined
      }
      iconName="Ruler"
      iconTone="emerald"
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

        {question.mustMark && !marked ? (
          <button
            type="button"
            onClick={mark}
            disabled={!!round.feedback}
            className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Mark them into {partWord(question.divisor!.parts, true)}
          </button>
        ) : null}

        {labelsEnabled && !practising && question.mustMark && marked ? (
          <p className="text-xs text-muted">
            every whole one holds {question.divisor!.parts} {partWord(question.divisor!.parts, true)}
          </p>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {DIVIDE_REFUSALS[refused]}
          </p>
        ) : null}

        <div
          className={
            question.mode === "explain_flip"
              ? "flex w-full flex-col gap-2"
              : "flex flex-wrap justify-center gap-3"
          }
        >
          {question.options.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => answer(text)}
              disabled={!!round.feedback}
              className={
                question.mode === "explain_flip"
                  ? "min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  : "min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              }
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
