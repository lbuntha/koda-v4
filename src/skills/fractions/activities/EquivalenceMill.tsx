import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
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
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
        tf("mill.hintSplit1"),
        tf("mill.hintSplit2", { factor }),
        tf("mill.hintSplit3"),
      );
    case "two_names":
      return composeHints(
        tf("mill.hintTwo1"),
        tf("mill.hintTwo2"),
        tf("mill.hintTwo3"),
      );
    case "scale_up":
      return composeHints(
        tf("mill.hintUp1", { to: to.parts, from: from.parts }),
        tf("mill.hintUp2", { n: to.parts / from.parts }),
        tf("mill.hintUp3"),
      );
    case "scale_down":
      return composeHints(
        tf("mill.hintDown1", { factor }),
        tf("mill.hintDown2"),
        tf("mill.hintDown3"),
      );
    default:
      return composeHints(
        tf("mill.hintSimp1"),
        tf("mill.hintSimp2"),
        tf("mill.hintSimp3"),
      );
  }
}

/** Two fractions written exactly the same way — not merely worth the same. */
const sameFraction = (a: Fraction, b: Fraction): boolean =>
  a.parts === b.parts && a.taken === b.taken;

export const EquivalenceMill: React.FC<ActivityProps<MillParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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

  const hints = !question || practising ? [] : millHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress:
      question && current && !sameFraction(current, question.operates ? question.from : question.to)
        ? 1
        : 0,
  });

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
    guide.moved();
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? tf("strip.yes") : tf("strip.notYet"), message });
  };

  const check = (): void => {
    const block = millBlockedBecause(question, current);
    if (block) {
      setRefused(block);
      guide.stumbled();
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
      fallbackTitle={tf("mill.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
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
            <FractionBar parts={question.from.parts} shaded={shadedOf(question.from)} label={tf("mill.firstBar")} />
            <FractionBar parts={question.to.parts} shaded={shadedOf(question.to)} label={tf("mill.secondBar")} />
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
            <FractionBar parts={current.parts} shaded={shadedOf(current)} label={tf("mill.nowBar", { fraction: nameOf(current) })} />
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
                  aria-label={tf("mill.cutLabel", { k })}
                  className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {tf("mill.cutButton", { k })}
                </button>
              ))}
              {moves.join.map((k) => (
                <button
                  key={`j${k}`}
                  type="button"
                  onClick={() => work(applyJoin(current, k))}
                  disabled={!!round.feedback}
                  aria-label={tf("mill.joinLabel", { k })}
                  className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {tf("mill.joinButton", { k })}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={check}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-indigo-600 px-6 py-2 text-base font-bold text-white shadow-sm"
            >
              {tf("mill.thatIsIt")}
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
        text: tf("mill.printSplit", { from: nameOf(from), factor }),
        answer: question.expected,
      };
    case "two_names":
      return {
        text: tf("mill.printTwo"),
        answer: tf("mill.pairAnd", { a: nameOf(from), b: nameOf(to) }),
      };
    case "scale_up":
      return { text: tf("mill.printUp", { from: nameOf(from), words: partWord(to.parts, true) }), answer: question.expected };
    case "scale_down":
      return {
        text: tf("mill.printDown", { from: nameOf(from), factor }),
        answer: question.expected,
      };
    default:
      return { text: tf("mill.promptSimplest", { fraction: nameOf(from) }), answer: question.expected };
  }
}

export const figureFor = (question: MillQuestion): React.ReactNode =>
  printBar(question.from.parts, question.from.taken);

export function methodFor(question: MillQuestion): string[] | null {
  if (question.mode === "simplest" || question.mode === "scale_down") {
    return [
      tf("mill.methodDown1"),
      tf("mill.methodDown2"),
      tf("mill.methodDown3"),
    ];
  }
  return [
    tf("mill.methodUp1"),
    tf("mill.methodUp2"),
  ];
}
