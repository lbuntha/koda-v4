import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { gcd, partWord, randInt, shuffle, simplify, type Fraction, type Whole } from "../internal/data/fractionNumbers";
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
    get label() { return tf("route.matchLabel"); },
    fits: (a, b) => a.parts === b.parts,
    why: (a) => tf("route.matchWhy", { words: partWord(a.parts, true) }),
  },
  {
    id: "one-divides",
    get label() { return tf("route.oneLabel"); },
    fits: (a, b) => a.parts !== b.parts && (a.parts % b.parts === 0 || b.parts % a.parts === 0),
    why: (a, b) => {
      const [small, big] = a.parts < b.parts ? [a.parts, b.parts] : [b.parts, a.parts];
      return tf("route.oneWhy", { small, big, words: partWord(small, true) });
    },
  },
  {
    id: "multiply-bottoms",
    get label() { return tf("route.multLabel"); },
    fits: (a, b) => a.parts !== b.parts && gcd(a.parts, b.parts) === 1,
    why: (a, b) => tf("route.multWhy", { a: a.parts, b: b.parts, product: a.parts * b.parts }),
  },
  {
    id: "smallest-common",
    get label() { return tf("route.smallLabel"); },
    fits: (a, b) => a.parts !== b.parts && gcd(a.parts, b.parts) > 1,
    why: (a, b) => {
      const shared = gcd(a.parts, b.parts);
      return tf("route.smallWhy", { shared, product: a.parts * b.parts });
    },
  },
  {
    id: "simplify-first",
    get label() { return tf("route.simpLabel"); },
    fits: (a, b) => gcd(a.taken, a.parts) > 1 || gcd(b.taken, b.parts) > 1,
    why: (a, b) => {
      const messy = gcd(a.taken, a.parts) > 1 ? a : b;
      return tf("route.simpWhy", { messy: nameOf(messy), simple: nameOf(simplify(messy)) });
    },
  },
  {
    id: "benchmark",
    get label() { return tf("route.benchLabel"); },
    fits: (a, b) => Math.abs(a.taken / a.parts - 0.5) < 0.13 || Math.abs(b.taken / b.parts - 0.5) < 0.13,
    why: (a, b) => {
      const near = Math.abs(a.taken / a.parts - 0.5) < 0.13 ? a : b;
      return tf("route.benchWhy", { near: nameOf(near) });
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

export function buildQuestion(_params: StrategyParams, index: number): StrategyQuestion {
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
    prompt: tf("route.prompt", { a: nameOf(left), b: nameOf(right) }),
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
    tf("route.hint1"),
    tf("route.hint2"),
    tf("route.hint3"),
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
    return tf("route.missWrong");
  }
  const route = ROUTES.find((r) => r.id === question.fitting[0]);
  return route ? route.why(question.left, question.right) : tf("route.missDefault");
}

export const StrategyPicker: React.FC<ActivityProps<StrategyParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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

  const hints = !question || practising ? [] : strategyHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
  });

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
      title: correct ? tf("route.works") : tf("route.notThat"),
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
      fallbackTitle={tf("route.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
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
          <p className="text-xs text-muted">{tf("route.moreThanOne")}</p>
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
    text: tf("route.print", { a: nameOf(question.left), b: nameOf(question.right) }),
    answer: question.fitting
      .map((id) => ROUTES.find((r) => r.id === id)?.why(question.left, question.right))
      .filter(Boolean)
      .join("  /  "),
  };
}

export function methodFor(): string[] | null {
  return [
    tf("route.method1"),
    tf("route.method2"),
    tf("route.method3"),
  ];
}
