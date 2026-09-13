import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, useSkillRound } from "../../kit";
import { gcd, partWord, randInt, shuffle, simplify, type Fraction, type Whole } from "../internal/data/fractionNumbers";

/**
 * Which way, and why.
 *
 * The last teaching level, and the only one with more than one right answer.
 * After fifty-six levels a child has several ways to handle a pair of
 * fractions; what remains is whether they can look at a particular pair and
 * *choose*. So every genuinely fitting route is accepted, and the feedback says
 * why the one they picked fits rather than congratulating them for guessing.
 *
 * A route is offered only when it actually applies. "One bottom number goes
 * into the other" against fifths and sevenths would teach a child that the
 * strategy names are decoration, which is the opposite of the lesson.
 */

interface StrategyParams {
  question?: { questionsPerRound?: number; practice?: boolean };
  questionsPerRound?: number;
}

const BAR: Whole = { kind: "bar", name: "the strip" };

const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

interface Route {
  id: string;
  label: string;
  /** Whether this route genuinely suits these two fractions. */
  fits(a: Fraction, b: Fraction): boolean;
  why(a: Fraction, b: Fraction): string;
}

/**
 * The routes this skill has taught, each with the test for when it helps.
 *
 * The `fits` predicates are the content of this level. A route that suits every
 * question is not a strategy, and one that suits none is not a lesson.
 */
export const ROUTES: readonly Route[] = [
  {
    id: "already-match",
    label: "Just count them — the pieces already match",
    fits: (a, b) => a.parts === b.parts,
    why: (a) => `Both are ${partWord(a.parts, true)} already, so nothing needs cutting up.`,
  },
  {
    id: "one-divides",
    label: "Cut only one of them",
    fits: (a, b) => a.parts !== b.parts && (a.parts % b.parts === 0 || b.parts % a.parts === 0),
    why: (a, b) => {
      const [small, big] = a.parts < b.parts ? [a.parts, b.parts] : [b.parts, a.parts];
      return `${small} goes into ${big} exactly, so only the ${partWord(small, true)} need cutting up.`;
    },
  },
  {
    id: "multiply-bottoms",
    label: "Multiply the bottom numbers together",
    fits: (a, b) => a.parts !== b.parts && gcd(a.parts, b.parts) === 1,
    why: (a, b) => `${a.parts} and ${b.parts} share no factor, so ${a.parts * b.parts} is the size to use.`,
  },
  {
    id: "smallest-common",
    label: "Find the smallest size they both fit",
    fits: (a, b) => a.parts !== b.parts && gcd(a.parts, b.parts) > 1,
    why: (a, b) => {
      const shared = gcd(a.parts, b.parts);
      return `They share a factor of ${shared}, so the pieces can be smaller than ${a.parts * b.parts}.`;
    },
  },
  {
    id: "simplify-first",
    label: "Cut them down before doing anything",
    fits: (a, b) => gcd(a.taken, a.parts) > 1 || gcd(b.taken, b.parts) > 1,
    why: (a, b) => {
      const messy = gcd(a.taken, a.parts) > 1 ? a : b;
      return `${nameOf(messy)} is ${nameOf(simplify(messy))} in simpler terms, which makes everything after it easier.`;
    },
  },
  {
    id: "benchmark",
    label: "Judge it against a half first",
    fits: (a, b) => Math.abs(a.taken / a.parts - 0.5) < 0.13 || Math.abs(b.taken / b.parts - 0.5) < 0.13,
    why: (a, b) => {
      const near = Math.abs(a.taken / a.parts - 0.5) < 0.13 ? a : b;
      return `${nameOf(near)} is about a half, so you know roughly what the answer should be before you start.`;
    },
  },
] as const;

export interface StrategyQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  left: Fraction;
  right: Fraction;
  /** Every route offered, fitting or not. */
  offered: string[];
  /** The ids of those that genuinely fit. */
  fitting: string[];
}

export function buildQuestion(params: StrategyParams, index: number): StrategyQuestion {
  /*
   * Drawn until at least one route fits and at least one does not.
   *
   * A pair every route suits teaches nothing about choosing, and one no route
   * suits cannot be answered. The search is bounded and falls back to a pair
   * known to have both.
   */
  let left: Fraction = { whole: BAR, parts: 4, taken: 3 };
  let right: Fraction = { whole: BAR, parts: 8, taken: 1 };
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const p = randInt(2, 10);
    const q = randInt(2, 10);
    const a: Fraction = { whole: BAR, parts: p, taken: randInt(1, p - 1) };
    const b: Fraction = { whole: BAR, parts: q, taken: randInt(1, q - 1) };
    const fits = ROUTES.filter((r) => r.fits(a, b));
    if (fits.length >= 1 && fits.length < ROUTES.length) {
      left = a;
      right = b;
      break;
    }
  }

  const fitting = ROUTES.filter((r) => r.fits(left, right));
  const notFitting = ROUTES.filter((r) => !r.fits(left, right));
  const offered = shuffle([
    ...fitting.slice(0, 2),
    ...shuffle([...notFitting]).slice(0, Math.max(1, 4 - Math.min(2, fitting.length))),
  ]);

  return {
    id: `fractions-strategy-${index}-${nameOf(left)}-${nameOf(right)}`,
    taskKind: "fractions_compare_paths",
    prompt: `${nameOf(left)} + ${nameOf(right)}. Which way would you do it?`,
    expected: fitting.map((r) => r.id).join(" | "),
    itemCount: offered.length,
    left,
    right,
    offered: offered.map((r) => r.id),
    fitting: fitting.map((r) => r.id),
  };
}

export const promptFor = (question: StrategyQuestion): string => question.prompt;

export function strategyHints(_question: StrategyQuestion): string[] {
  return composeHints(
    "Look at the two bottom numbers before you look at anything else.",
    "Are they the same? Does one go into the other? Do they share a factor?",
    "More than one way can be right here. Pick one that suits these particular numbers.",
  );
}

/**
 * What the child is told after choosing.
 *
 * Named rather than written inline, so the cross-cutting teaching test can read
 * it the way it reads every other engine's explanation. A right answer gets the
 * reason that route suits *these* numbers; a wrong one is sent back to the two
 * bottom numbers, which is where the decision is made.
 */
export function explainStrategy(question: StrategyQuestion, correct: boolean): string {
  if (!correct) {
    return "That one does not suit these particular numbers. Look at the two bottom numbers again.";
  }
  const route = ROUTES.find((r) => r.id === question.fitting[0]);
  return route ? route.why(question.left, question.right) : "That route suits these two numbers.";
}

export const StrategyPicker: React.FC<ActivityProps<StrategyParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
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
          ? route.why(question.left, question.right)
          : explainStrategy(question, false),
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
      hints={practising ? [] : strategyHints(question)}
      iconName="GitBranch"
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
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
        <p className="text-2xl font-black tracking-tight text-ink">
          {nameOf(question.left)} + {nameOf(question.right)}
        </p>

        <div className="flex w-full flex-col gap-2" data-testid="routes">
          {question.offered.map((id) => {
            const route = ROUTES.find((r) => r.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-left text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {route?.label}
              </button>
            );
          })}
        </div>

        {!practising ? (
          <p className="text-xs text-muted">more than one of these can be right</p>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * On paper this becomes a better question than it is on screen.
 *
 * The buttons become a blank line, so the child has to say which way they would
 * do it *and why* in their own words — which is the level's real subject and
 * something no multiple choice can capture.
 */
export function printedFor(question: StrategyQuestion): { text: string; answer: string } | null {
  return {
    text: `${nameOf(question.left)} + ${nameOf(question.right)}. Which way would you do this one, and why?`,
    answer: question.fitting
      .map((id) => ROUTES.find((r) => r.id === id)?.why(question.left, question.right))
      .filter(Boolean)
      .join("  /  "),
  };
}

export function methodFor(): string[] | null {
  return [
    "Look at the two bottom numbers first.",
    "The same? Nothing to cut. One goes into the other? Cut only one of them.",
    "Sharing a factor? The pieces can be smaller than multiplying the bottoms would give.",
  ];
}
