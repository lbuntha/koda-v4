import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, useSkillRound } from "../../kit";
import { drawQuotient, pick, shuffle, type Quotient } from "../internal/data/divisionNumbers";

/**
 * Which route, and why.
 *
 * The last teaching level, and the only one with more than one right answer.
 * After fifty-five levels a child has eight ways to divide; the question that
 * remains is whether they can look at a particular division and *choose*. So
 * every genuinely fitting route is accepted, and the feedback names why the one
 * they picked fits rather than congratulating them for guessing.
 *
 * A route is offered only when it actually applies. Suggesting "halve it twice"
 * for a division by 7 would teach a child that the strategy names are decoration.
 */

interface StrategyParams {
  question?: { questionsPerRound?: number; practice?: boolean; modes?: string[] };
  questionsPerRound?: number;
}

interface Route {
  id: string;
  label: string;
  /** Whether this route genuinely suits these numbers. */
  fits(dividend: number, divisor: number): boolean;
  why(dividend: number, divisor: number): string;
}

/**
 * The eight routes this skill has taught, each with the test for when it helps.
 *
 * The `fits` predicates are the content of this level. A route that fits every
 * question is not a strategy, and a route that fits none is not a lesson.
 */
export const ROUTES: readonly Route[] = [
  {
    id: "halve",
    label: "Halve it, maybe more than once",
    fits: (_, d) => [2, 4, 8].includes(d),
    why: (_, d) => `Dividing by ${d} is halving ${d === 2 ? "once" : d === 4 ? "twice" : "three times"}.`,
  },
  {
    id: "known-fact",
    label: "Use a times-table fact",
    fits: (n, d) => n / d <= 12 && Number.isInteger(n / d) && d <= 12,
    why: (n, d) => `${d} × ${n / d} = ${n} is a fact you already know.`,
  },
  {
    id: "place-split",
    label: "Split it by place value",
    fits: (n, d) =>
      String(n)
        .split("")
        .every((digit, i, all) => (Number(digit) * 10 ** (all.length - 1 - i)) % d === 0 || digit === "0"),
    why: (n, d) => `Every place of ${n} divides by ${d} on its own.`,
  },
  {
    id: "chunk",
    label: "Take away big chunks",
    fits: (n, d) => n / d > 12,
    why: (n, d) => `The answer is big, so take away tens of ${d}s at a time.`,
  },
  {
    id: "scale",
    label: "Cancel the zeros first",
    fits: (n, d) => n % 10 === 0 && d % 10 === 0,
    why: () => "A zero on each side cancels, and what is left is much smaller.",
  },
  {
    id: "written",
    label: "Use the written method",
    fits: (n) => n > 100,
    why: () => "It always works, and this one is big enough to be worth writing out.",
  },
] as const;

export interface StrategyQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  dividend: number;
  divisor: number;
  quotient: number;
  /** Every route offered. */
  offered: string[];
  /** The ids of those that genuinely fit. */
  fitting: string[];
}

export function buildQuestion(params: StrategyParams, index: number): StrategyQuestion {
  /*
   * Drawn until at least one route fits and at least one does not.
   *
   * A question every route suits teaches nothing about choosing, and one no
   * route suits cannot be answered. The search is bounded and falls back to a
   * question that is known to have both.
   */
  let value: Quotient = { dividend: 96, divisor: 4, quotient: 24, remainder: 0, meaning: "share" };
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const drawn = drawQuotient({ divisorRange: [2, 12], quotientRange: [4, 90], dividendRange: [20, 999], remainder: "never" });
    const fits = ROUTES.filter((r) => r.fits(drawn.dividend, drawn.divisor));
    if (fits.length >= 1 && fits.length < ROUTES.length) {
      value = drawn;
      break;
    }
  }

  const fitting = ROUTES.filter((r) => r.fits(value.dividend, value.divisor));
  const notFitting = ROUTES.filter((r) => !r.fits(value.dividend, value.divisor));
  const offered = shuffle([
    ...fitting.slice(0, 2),
    ...shuffle(notFitting).slice(0, Math.max(1, 4 - Math.min(2, fitting.length))),
  ]);

  return {
    id: `division-strategy-${index}-${value.dividend}-${value.divisor}`,
    taskKind: "division_compare_paths",
    prompt: `${value.dividend} ÷ ${value.divisor}. Which way would you do it?`,
    expected: fitting.map((r) => r.id).join(" | "),
    itemCount: offered.length,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    offered: offered.map((r) => r.id),
    fitting: fitting.map((r) => r.id),
  };
}

export const promptFor = (question: StrategyQuestion): string => question.prompt;

export const StrategyPicker: React.FC<ActivityProps<StrategyParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as StrategyQuestion;

  if (!question) return null;

  const choose = (id: string): void => {
    const route = ROUTES.find((r) => r.id === id);
    const correct = question.fitting.includes(id);
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: id,
      expected: question.expected,
      title: correct ? "That works" : "Not that one",
      message:
        correct && route
          ? route.why(question.dividend, question.divisor)
          : "That one does not suit these numbers. Look at them again.",
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Which Way?"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={
        practising
          ? []
          : composeHints(
              "Look at the numbers before you look at the choices.",
              "Is it a number you can halve by? Is the total made of places that all divide?",
              "More than one way can be right. Pick one that actually suits these numbers.",
            )
      }
      iconName="Route"
      iconTone="indigo"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
        <p className="text-center text-3xl font-bold text-ink">
          {question.dividend} ÷ {question.divisor}
        </p>
        {question.offered.map((id) => {
          const route = ROUTES.find((r) => r.id === id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-left text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {route?.label ?? id}
            </button>
          );
        })}
      </div>
    </SkillRound>
  );
};

/** Kept for the worksheet adapter; the picker draws its own routes. */
export const routeLabel = (id: string): string => ROUTES.find((r) => r.id === id)?.label ?? id;
export const anyRoute = (): string => pick(ROUTES).id;

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The one level with more than one right answer, printed as such.
 *
 * The sheet lists the routes offered and the key names *every* one that fits,
 * because marking a child wrong for choosing the second valid route would teach
 * the opposite of the lesson. No figure: the numbers are the whole question.
 */
export function printedFor(question: StrategyQuestion): { text: string; answer: string } | null {
  const offered = question.offered.map((id, i) => `${"abcdef"[i]}) ${routeLabel(id)}`).join("   ");
  return {
    text: `${question.dividend} ÷ ${question.divisor}. Which way would you do it?   ${offered}`,
    answer: question.fitting
      .filter((id) => question.offered.includes(id))
      .map((id) => routeLabel(id))
      .join(" — or — "),
  };
}

export function methodFor(): string[] {
  return [
    "Look at the numbers before you look at the choices.",
    "Ask whether the divisor is one you can halve by, and whether every place divides.",
    "More than one way can be right. Pick one that suits these numbers.",
  ];
}
