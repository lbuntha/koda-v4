import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { partWord } from "../internal/data/fractionNumbers";
import { printBar } from "../internal/ui/printFigures";
import { FractionBar } from "../internal/ui/FractionBar";
import {
  MILL_REFUSALS,
  explainMill,
  applyJoin,
  applySplit,
  buildMillQuestion,
  millBlockedBecause,
  movesFor,
  nameOf,
  valueOf,
  type MillBlock,
  type MillMode,
  type MillQuestion,
  type MillSetup,
} from "../internal/data/fractionEquivalence";
import type { Fraction } from "../internal/data/fractionNumbers";

/**
 * The mill — where a fraction changes its name without changing its size.
 *
 * One action: cut every part into smaller ones, or join them back up. The shaded
 * region does not move while that happens, and a child who has watched 3/4
 * become 6/8 with the shading standing still has *seen* why they are equal —
 * rather than been handed a rule about multiplying top and bottom, which is the
 * form in which it is usually forgotten.
 *
 * So the old bar stays on screen behind the new one, faint. Equivalence is a
 * claim about two pictures, and showing one at a time makes it a claim about
 * two numbers instead.
 */

interface MillParams {
  question?: MillSetup;
  mode?: MillMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: MillParams, index: number, seen?: Set<string>): MillQuestion {
  const setup: MillSetup = { ...params, ...params.question };
  const mode = modeAt<MillMode>(setup, index + 1, "split");
  return buildMillQuestion(setup, mode, index, seen);
}

export const promptFor = (question: MillQuestion): string => question.prompt;

export function millHints(question: MillQuestion): string[] {
  const { from, to, factor } = question;
  switch (question.mode) {
    case "split":
      return composeHints(
        "Watch the shaded part while you cut. It does not move.",
        `Every part turns into ${factor} smaller ones, so there are ${factor} times as many altogether.`,
        "The shaded ones multiply by the same number, because they were cut too.",
      );
    case "two_names":
      return composeHints(
        "Both bars have the same amount coloured in.",
        "Count the parts on each one — they are cut differently.",
        "Two names, one amount. Check both halves of the pair before you choose.",
      );
    case "scale_up":
      return composeHints(
        `You need ${to.parts} parts, and you have ${from.parts}.`,
        `That means cutting every part into ${to.parts / from.parts}.`,
        "Whatever you do to the bottom, you do to the top — because you are cutting the shaded ones as well.",
      );
    case "scale_down":
      return composeHints(
        `Both numbers can be divided by ${factor}.`,
        "Joining parts back up is cutting in reverse.",
        "The amount shaded stays exactly where it is.",
      );
    default:
      return composeHints(
        "Keep joining parts up while both numbers still divide by something.",
        "Stop when the only number that goes into both is one.",
        "If you can still halve both, you are not finished.",
      );
  }
}

/** Two fractions written exactly the same way — not merely worth the same. */
const sameFraction = (a: Fraction, b: Fraction): boolean =>
  a.parts === b.parts && a.taken === b.taken;

export const EquivalenceMill: React.FC<ActivityProps<MillParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: MillSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const ghostEnabled = koda.config.isEnabled("equivalence_ghost", true);
  const labelsEnabled = koda.config.isEnabled("part_labels", true);

  const seen = useMemo(() => new Set<string>(), []);
  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    // A skill for readers: nothing is spoken when the round opens.
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildQuestion(params, i - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as MillQuestion;

  /** Where the child has got the fraction to. */
  const [current, setCurrent] = useState<Fraction | null>(null);
  const [refused, setRefused] = useState<MillBlock>(null);

  useEffect(() => {
    if (!question) return;
    setCurrent(question.operates ? question.from : question.to);
    setRefused(null);
  }, [question]);

  if (!question || !current) return null;

  const moves = movesFor(current);
  const shadedOf = (f: Fraction) => Array.from({ length: f.taken }, (_, i) => i);

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const work = (next: Fraction): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setCurrent(next);
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not yet", message });
  };

  const check = (): void => {
    const block = millBlockedBecause(question, current);
    if (block) {
      setRefused(block);
      say(MILL_REFUSALS[block]);
      return;
    }
    submit(nameOf(current), true, explainMill(question, true));
  };

  const answerPair = (text: string): void => {
    const correct = text === question.expected;
    submit(text, correct, explainMill(question, correct));
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Same Amount, New Name"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : millHints(question)}
      onStartOver={
        current && !round.feedback && !sameFraction(current, question.operates ? question.from : question.to)
          ? () => {
              setCurrent(question.operates ? question.from : question.to);
              setRefused(null);
            }
          : undefined
      }
      iconName="Repeat"
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
        {question.mode === "two_names" ? (
          <div className="flex flex-col items-center gap-2" data-testid="two-bars">
            <FractionBar parts={question.from.parts} shaded={shadedOf(question.from)} label="first bar" />
            <FractionBar parts={question.to.parts} shaded={shadedOf(question.to)} label="second bar" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1" data-testid="mill">
            {/* What it looked like before, so equivalence is seen and not asserted. */}
            {ghostEnabled && !practising && current.parts !== question.from.parts ? (
              <FractionBar
                parts={question.from.parts}
                shaded={shadedOf(question.from)}
                ghost
                label={`before: ${nameOf(question.from)}`}
              />
            ) : null}
            <FractionBar parts={current.parts} shaded={shadedOf(current)} label={`now ${nameOf(current)}`} />
            <p className="text-base font-bold text-ink" data-testid="now">
              {nameOf(current)}
            </p>
            {labelsEnabled && !practising ? (
              <p className="text-xs text-muted">the shaded part never moves</p>
            ) : null}
          </div>
        )}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {MILL_REFUSALS[refused]}
          </p>
        ) : null}

        {question.operates ? (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {moves.split.map((k) => (
                <button
                  key={`s${k}`}
                  type="button"
                  onClick={() => work(applySplit(current, k))}
                  disabled={!!round.feedback}
                  aria-label={`Cut every part into ${k}`}
                  className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  cut into {k}
                </button>
              ))}
              {moves.join.map((k) => (
                <button
                  key={`j${k}`}
                  type="button"
                  onClick={() => work(applyJoin(current, k))}
                  disabled={!!round.feedback}
                  aria-label={`Join every ${k} parts`}
                  className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  join {k}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={check}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-indigo-600 px-6 py-2 text-base font-bold text-white shadow-sm"
            >
              That is it
            </button>
          </>
        ) : null}

        {question.options ? (
          <div className="flex w-full flex-col gap-2">
            {question.options.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => answerPair(text)}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}

        {/* The value, stated once, for a child who has lost track of what is fixed. */}
        {labelsEnabled && !practising && question.operates ? (
          <p className="text-xs text-muted">
            still {Math.round(valueOf(current) * 100)}% of the bar
          </p>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * These print as written questions with a bar beside them.
 *
 * The bar is the starting amount, drawn shaded. What the child does on paper is
 * cut it further with a pencil and write the new name, which is the same act
 * the mill performs on screen.
 */
export function printedFor(question: MillQuestion): { text: string; answer: string } | null {
  const { from, to, factor } = question;
  switch (question.mode) {
    case "split":
      return {
        text: `Cut every part of ${nameOf(from)} into ${factor}. Write the new name for the same amount.`,
        answer: question.expected,
      };
    case "two_names":
      return {
        text: `Write two names for the shaded amount.`,
        answer: `${nameOf(from)} and ${nameOf(to)}`,
      };
    case "scale_up":
      return { text: `Write ${nameOf(from)} in ${partWord(to.parts, true)}.`, answer: question.expected };
    case "scale_down":
      return {
        text: `Both numbers in ${nameOf(from)} divide by ${factor}. Write what it becomes.`,
        answer: question.expected,
      };
    default:
      return { text: `Write ${nameOf(from)} as simply as it will go.`, answer: question.expected };
  }
}

export const figureFor = (question: MillQuestion): React.ReactNode =>
  printBar(question.from.parts, question.from.taken);

export function methodFor(question: MillQuestion): string[] | null {
  if (question.mode === "simplest" || question.mode === "scale_down") {
    return [
      "Look for a number that divides into the top and the bottom.",
      "Divide both by it. The amount has not changed, only its name.",
      "Keep going until nothing divides both any more.",
    ];
  }
  return [
    "Cutting every part into the same number of pieces does not change how much there is.",
    "Both numbers get multiplied, so the fraction keeps its value.",
  ];
}
