import React, { useCallback, useMemo } from "react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
  composeHints,
  guideSetup,
  isPractice,
  playCopy,
  useGuide,
  useSkillRound,
} from "../../kit";
import { drawQuotient, shuffle, type Quotient } from "../internal/data/divisionNumbers";
import { td } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
    get label() {
      return td("strategy.routes.halve.label");
    },
    fits: (_, d) => [2, 4, 8].includes(d),
    why: (_, d) => td(d === 2 ? "strategy.routes.halve.whyOnce" : d === 4 ? "strategy.routes.halve.whyTwice" : "strategy.routes.halve.whyThrice", { d }),
  },
  {
    id: "known-fact",
    get label() {
      return td("strategy.routes.known-fact.label");
    },
    fits: (n, d) => n / d <= 12 && Number.isInteger(n / d) && d <= 12,
    why: (n, d) => td("strategy.routes.known-fact.why", { n, d, q: n / d }),
  },
  {
    id: "place-split",
    get label() {
      return td("strategy.routes.place-split.label");
    },
    fits: (n, d) =>
      String(n)
        .split("")
        .every((digit, i, all) => (Number(digit) * 10 ** (all.length - 1 - i)) % d === 0 || digit === "0"),
    why: (n, d) => td("strategy.routes.place-split.why", { n, d }),
  },
  {
    id: "chunk",
    get label() {
      return td("strategy.routes.chunk.label");
    },
    fits: (n, d) => n / d > 12,
    why: (_n, d) => td("strategy.routes.chunk.why", { d }),
  },
  {
    id: "scale",
    get label() {
      return td("strategy.routes.scale.label");
    },
    fits: (n, d) => n % 10 === 0 && d % 10 === 0,
    why: () => td("strategy.routes.scale.why"),
  },
  {
    id: "written",
    get label() {
      return td("strategy.routes.written.label");
    },
    fits: (n) => n > 100,
    why: () => td("strategy.routes.written.why"),
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

export function buildQuestion(_params: StrategyParams, index: number): StrategyQuestion {
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
    prompt: td("strategy.prompt", { n: value.dividend, d: value.divisor }),
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
  // Re-render when the language changes: every line below reads the catalog.
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
      title: correct ? td("strategy.works") : td("strategy.notThatOne"),
      message:
        correct && route
          ? route.why(question.dividend, question.divisor)
          : td("strategy.doesNotSuit"),
    });
  };

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * The rungs were written inline in the JSX here, which is why this engine
   * alone never read the lesson's own `kidTip` — it had nowhere to put it.
   */
  const copy = playCopy(params);
  const hints = practising
    ? []
    : composeHints(
        copy.kidTip ?? td("strategy.hint1"),
        td("strategy.hint2"),
        td("strategy.hint3"),
      );
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={td("strategy.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
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
    text: `${td("strategy.prompt", { n: question.dividend, d: question.divisor })}   ${offered}`,
    answer: question.fitting
      .filter((id) => question.offered.includes(id))
      .map((id) => routeLabel(id))
      .join(td("strategy.orJoin")),
  };
}

export function methodFor(): string[] {
  return [
    td("strategy.method1"),
    td("strategy.method2"),
    td("strategy.method3"),
  ];
}
