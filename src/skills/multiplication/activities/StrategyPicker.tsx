import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  composeHints,
  isPractice,
  playCopy,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import { themeSystem } from "../../../lib/themeSystem";
import { drawProduct, randInt, shuffle, withoutRepeat } from "../internal/data/multiplicationNumbers";
import {
  fittingStrategies,
  strategyById,
  unfittingStrategies,
  type StrategyId,
} from "../internal/data/strategyPool";
import { chime } from "../internal/data/multiplicationSound";
import { speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";

/**
 * Choosing a route, and then looking at another one.
 *
 * The last teaching level, and the only one with no single right answer. A
 * child who reaches `16 × 5` by halving and doubling has done as well as one
 * who split it into tens and ones, so **every route that genuinely fits is
 * accepted** — scoring one over the others would teach the opposite of what
 * this level is for.
 *
 * What is not a matter of taste is whether a route can be carried out at all.
 * Halve-and-double needs an even factor; doubling twice needs a four. A route
 * that does not fit these two numbers is refused with the reason it does not,
 * and nothing is scored for trying it.
 *
 * After a choice is made the engine shows a *different* fitting route beside
 * it, because comparing is the second half of the lesson and a child who only
 * ever sees their own answer has not compared anything.
 */

export type StrategyMode = "compare_paths";

interface StrategySetup {
  mode?: StrategyMode;
  modes?: string[];
  practice?: boolean;
  aRange?: [number, number];
  bRange?: [number, number];
  questionsPerRound?: number;
}

export interface StrategyParams extends StrategySetup {
  question?: StrategySetup;
  play?: unknown;
}

export interface StrategyQuestion extends RoundQuestion {
  mode: StrategyMode;
  a: number;
  b: number;
  product: number;
  /** Every route that works on these two numbers. */
  fits: StrategyId[];
  /** The routes offered, fitting and not. */
  offered: StrategyId[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

/** A pair with more than one way in — otherwise there is nothing to compare. */
const MIN_ROUTES = 2;

export function buildQuestion(params: StrategyParams, index: number, seen?: Set<string>): StrategyQuestion {
  const setup: StrategySetup = { ...params, ...params.question };
  const aRange = setup.aRange ?? [3, 12];
  const bRange = setup.bRange ?? [3, 12];

  const draw = () => {
    for (let i = 0; i < 200; i += 1) {
      const value = drawProduct({ aRange, bRange });
      if (fittingStrategies(value.a, value.b).length >= MIN_ROUTES) return value;
    }
    for (let a = aRange[0]; a <= aRange[1]; a += 1) {
      for (let b = bRange[0]; b <= bRange[1]; b += 1) {
        if (fittingStrategies(a, b).length >= MIN_ROUTES) return { a, b, product: a * b };
      }
    }
    throw new Error(
      `StrategyPicker: no pair in ${JSON.stringify({ aRange, bRange })} has two ways into it`,
    );
  };

  const { a, b, product } = seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
  const id = `strategy-compare_paths-${index}-${a}x${b}`;

  const fits = fittingStrategies(a, b).map((s) => s.id);
  const misses = unfittingStrategies(a, b).map((s) => s.id);
  /* Four options: as many real routes as there are, up to three, and at least
     one that does not fit — a child has to be able to pick a route that cannot
     be carried out, or "which of these works" is not a question. */
  const shown = shuffle(fits).slice(0, 3);
  const wrong = shuffle(misses).slice(0, Math.max(1, 4 - shown.length));

  return {
    id,
    mode: "compare_paths",
    a,
    b,
    product,
    fits,
    offered: shuffle([...shown, ...wrong]),
    taskKind: "compare_strategies",
    prompt: `${a} × ${b}. Which of these would work? Any route that fits is a good one.`,
    // Several answers are right; the log records the route the child took.
    expected: fits.map((id) => strategyById(id).label).join(" / "),
    itemCount: product,
  };
}

export const promptFor = (question: StrategyQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: StrategyQuestion): PrintedQuestion | null {
  const { a, b, fits } = question;
  return {
    text: `${a} × ${b}. Solve it two different ways, then say which was easier and why. ____`,
    answer: `${question.product}. Routes that work: ${fits
      .map((id) => `${strategyById(id).label} (${strategyById(id).route(a, b)})`)
      .join("; ")}`,
  };
}

export function methodFor(question: StrategyQuestion): string[] | null {
  return [
    "Look at the two numbers before choosing how to start.",
    "Some routes only work on certain numbers: halving needs an even one, doubling twice needs a four.",
    "More than one route usually fits. Pick the one that makes the numbers easiest.",
  ];
}

/** There is no picture of a choice. */
export const figureFor = (): React.ReactNode | null => null;

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

export function strategyHints(
  question: StrategyQuestion,
  kidTip: string | undefined,
  state: { chosen?: StrategyId },
): string[] {
  const { a, b } = question;
  return composeHints(
    kidTip,
    state.chosen
      ? `You took one route. Look at the other one beside it — did it need fewer steps?`
      : `Look at ${a} and ${b} first. Is either one even? Is either one next to a square?`,
    // Never names a route: choosing is the question, and several are right.
    `More than one of these fits. A route fits when its move can actually be made on these two numbers.`,
  );
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const StrategyPicker: React.FC<ActivityProps<StrategyParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StrategySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 6;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);

  const seen = useMemo(() => new Set<string>(), []);
  const nudge = useNudge(koda);
  const clearNudge = nudge.clear;

  const speakAloud = (text: string) => {
    if (!koda.config.isEnabled("audio_speech", true)) return;
    void koda.speech.say(text, speechRate(koda)).catch(() => {});
  };
  const speak = quietWhenPractising(speakAloud, practising);
  const refuse = (written: string, spoken: string) => {
    nudge.refuse(written);
    speak(spoken);
  };

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    /* `useSkillRound` counts from one; `buildQuestion` counts from zero. */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as StrategyQuestion;

  const [chosen, setChosen] = useState<StrategyId | undefined>(undefined);

  useEffect(() => {
    if (!question) return;
    setChosen(undefined);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { a, b } = question;
  /** A second route to set beside the one taken, so there is something to compare. */
  const alternative = question.fits.find((id) => id !== chosen);

  const choose = (id: StrategyId) => {
    if (round.feedback || chosen) return;
    const strategy = strategyById(id);
    if (!strategy.fits(a, b)) {
      /* Not a wrong answer — a route that cannot be carried out. Nothing is
         scored, and the reason is arithmetic rather than preference. */
      refuse(`${strategy.why(a, b)}`, "That one does not work here.");
      return;
    }
    setChosen(id);
    chime(koda, "right");
    if (hapticsEnabled) koda.haptics.success();
    /* Every fitting route is right. What the log records is which one was
       taken, so a teacher can see whether a child ever varies it. */
    round.submit({
      correct: true,
      given: strategy.label,
      expected: question.expected,
      title: "That route works",
      message: `${strategy.route(a, b)} — and ${a} × ${b} = ${question.product}.`,
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Choose a Route"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : strategyHints(question, copy.kidTip, { chosen })}
      iconName="sparkles"
      iconTone="purple"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-4xl font-black tabular-nums sm:text-5xl">
          <span className={GROUPS.text}>{a}</span>
          <span className="text-ink/55"> × </span>
          <span className={EACH.text}>{b}</span>
        </p>

        <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2">
          {question.offered.map((id) => {
            const strategy = strategyById(id);
            const taken = chosen === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={taken}
                aria-label={strategy.label}
                onClick={() => choose(id)}
                disabled={!!round.feedback || Boolean(chosen)}
                className={`${TOUCH_TARGET} rounded-2xl border-2 px-4 py-3 text-left text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  taken ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`
                }`}
              >
                {strategy.label}
                {taken && (
                  <span className={`block text-sm font-black tabular-nums ${PRODUCT.text}`}>
                    {strategy.route(a, b)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* The second half of the lesson: another route that also works. */}
        {scaffold && chosen && alternative && (
          <div className={`w-full max-w-md rounded-2xl border-2 border-dashed ${ADJUSTMENT.border} px-4 py-3`}>
            <p className={`text-sm font-bold ${NEUTRAL.text}`}>Another route that also works</p>
            <p className={`text-base font-black ${ADJUSTMENT.text}`}>
              {strategyById(alternative).label}
            </p>
            <p className={`text-sm font-bold tabular-nums ${ADJUSTMENT.text}`}>
              {strategyById(alternative).route(a, b)}
            </p>
          </div>
        )}
      </div>
    </SkillRound>
  );
};
