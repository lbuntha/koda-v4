import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { ADDEND_A, ADDEND_B, CHANGE, TOTAL } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { NudgeLine, useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import {
  drawRoundingPair,
  pairKey,
  pick,
  roundTo,
  shuffle,
  withoutRepeat,
} from "../internal/data/additionNumbers";

/**
 * About how many — and whether an answer could possibly be right.
 *
 * The only two lessons in this skill where the exact total is not the point,
 * and that is precisely what makes them hard to write. A child who has spent
 * forty lessons being asked for the answer will give the answer here, and be
 * wrong, and it will feel unfair. So the prompt says *about*, the choices are
 * all round numbers, and the feedback for an exact answer says what was asked
 * rather than that they got it wrong.
 */

export type EstimateMode = "round_estimate" | "reasonable";

/** What a child says about a claimed answer. */
export type Verdict = "right" | "too_big" | "too_small";

export interface EstimateSetup {
  mode?: EstimateMode;
  /** How many digits the numbers have, which is also what they round to. */
  digits?: 2 | 3;
  questionsPerRound?: number;
}

export interface EstimateDialParams extends EstimateSetup {
  question?: EstimateSetup;
}

export interface EstimateQuestion extends RoundQuestion {
  mode: EstimateMode;
  a: number;
  b: number;
  sum: number;
  /** 10 or 100 — what these numbers round to. */
  unit: 10 | 100;
  /** `round_estimate`: the two neighbours each addend sits between. */
  around: { value: number; below: number; above: number }[];
  /** `round_estimate`: the estimate, and the near misses beside it. */
  options?: number[];
  /** `reasonable`: the answer being claimed, and what is wrong with it. */
  claim?: number;
  verdict?: Verdict;
}

const neighbours = (value: number, unit: 10 | 100) => ({
  value,
  below: Math.floor(value / unit) * unit,
  above: Math.floor(value / unit) * unit + unit,
});

export const buildQuestion = (
  setup: EstimateSetup,
  index: number,
  seen: Set<string>,
): EstimateQuestion => {
  const mode = setup.mode ?? "round_estimate";
  const digits = setup.digits ?? (mode === "reasonable" ? 3 : 2);
  const unit: 10 | 100 = digits === 3 ? 100 : 10;
  const { a, b, sum } = withoutRepeat(() => drawRoundingPair(digits), pairKey, seen);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `estimate_${mode}`, mode, a, b, sum, unit };

  if (mode === "reasonable") {
    /*
     * The three claims are the three things that actually happen.
     *
     * A right answer, a digit slipped one place left, and a digit lost off the
     * end. Drawn from a fixed set so the *reason* is always one a child can
     * say — "ten times too big" — rather than an arbitrary wrong number they
     * can only call wrong.
     */
    const verdict = pick<Verdict>(["right", "too_big", "too_small"]);
    const claim =
      verdict === "right" ? sum : verdict === "too_big" ? sum * 10 : Math.floor(sum / 10);
    return {
      ...base,
      around: [],
      claim,
      verdict,
      expected: verdict,
      itemCount: sum,
    };
  }

  const estimate = roundTo(a, unit) + roundTo(b, unit);
  return {
    ...base,
    around: [neighbours(a, unit), neighbours(b, unit)],
    // Near misses, not silly ones: rounding one addend the wrong way is what
    // actually goes wrong, so those are the alternatives on offer.
    options: shuffle(
      Array.from(
        new Set([estimate, estimate + unit, estimate - unit].filter((v) => v > 0)),
      ),
    ),
    expected: String(estimate),
    itemCount: sum,
  };
};

export const promptFor = (q: EstimateQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum))
    .replaceAll("{claim}", String(q.claim ?? ""))
    .replaceAll("{unit}", String(q.unit));
  if (filled) return filled;

  return q.mode === "reasonable"
    ? `Someone says ${q.a} plus ${q.b} is ${q.claim}. Could that be right?`
    : `About how many is ${q.a} plus ${q.b}?`;
};

export function estimateHints(
  q: EstimateQuestion,
  state: { rounded: (number | null)[]; kidTip?: string },
): string[] {
  if (q.mode === "reasonable") {
    const near = roundTo(q.a, q.unit) + roundTo(q.b, q.unit);
    return composeHints(
      state.kidTip ?? "You do not need the exact answer. Ask whether it is anywhere near.",
      `Round them first: ${q.a} is about ${roundTo(q.a, q.unit)} and ${q.b} is about ${roundTo(q.b, q.unit)}. So the answer should be near ${near}.`,
      // Stops at the comparison: judging it is the question.
      `Compare ${q.claim} with about ${near}. Is it close, far too big, or far too small?`,
    );
  }

  const undone = state.rounded.findIndex((r) => r === null);
  const which = undone === 0 ? q.a : q.b;
  return composeHints(
    state.kidTip ?? "Round each number to the nearest one, then add the round numbers.",
    undone === -1
      ? `Both are rounded. Add the two round numbers — that is the estimate.`
      : `${which} sits between ${Math.floor(which / q.unit) * q.unit} and ${Math.floor(which / q.unit) * q.unit + q.unit}. Which is it nearer to?`,
    `About ${roundTo(q.a, q.unit)} and about ${roundTo(q.b, q.unit)}.`,
  );
}

/** One number on its own short line, between the two it sits between. */
const Dial: React.FC<{
  around: { value: number; below: number; above: number };
  chosen: number | null;
  tone: string;
  onPick(v: number): void;
  disabled: boolean;
  label: string;
}> = ({ around, chosen, tone, onPick, disabled, label }) => {
  const pct = ((around.value - around.below) / (around.above - around.below)) * 100;
  return (
    <div className="flex-1 min-w-[13rem] space-y-2">
      <p className={`text-center text-2xl font-black tabular-nums ${tone}`}>{around.value}</p>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-ink/20" />
        <motion.div
          className="absolute top-1/2 w-4 h-4 -translate-y-1/2 -translate-x-1/2 rounded-full bg-emerald-500"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {[around.below, around.above].map((v) => (
          <motion.button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.93 }}
            transition={SPRING.tap}
            aria-label={`Round ${label} to ${v}`}
            aria-pressed={chosen === v}
            className={themeSystem.button(
              chosen === v ? "success" : "secondary",
              "sm",
              "min-w-[4.5rem] tabular-nums",
            )}
          >
            {v}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

const VERDICTS: { key: Verdict; label: string }[] = [
  { key: "too_small", label: "Far too small" },
  { key: "right", label: "About right" },
  { key: "too_big", label: "Far too big" },
];

export const EstimateDial: React.FC<ActivityProps<EstimateDialParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: EstimateSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const nudge = useNudge(koda);

  const [rounded, setRounded] = useState<(number | null)[]>([null, null]);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    totalQuestions,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback(
      (index: number) => buildQuestion(setup, index, seen.current),
      [params],
    ),
    onComplete: (result) => {
      void koda.progress.nextStep().then((r) => setNextStep(r ?? undefined));
      onComplete(result);
    },
  });

  const question = round.question as EstimateQuestion;

  useEffect(() => {
    setRounded([null, null]);
    nudge.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

  const roundOne = (index: number, to: number) => {
    if (round.feedback) return;
    const value = index === 0 ? question.a : question.b;
    if (to !== roundTo(value, question.unit)) {
      // A wrong rounding is a wrong route, not a wrong answer — the child has
      // not said what the estimate is yet.
      const nearer = roundTo(value, question.unit);
      nudge.refuse(`${value} is nearer to ${nearer} than to ${to}. Look at how far it is to each.`);
      return;
    }
    setRounded((prev) => prev.map((v, i) => (i === index ? to : v)));
    chime("clink");
    if (vibrates) koda.haptics.tap();
  };

  const chooseEstimate = (value: number) => {
    if (round.feedback) return;
    if (rounded.some((r) => r === null)) {
      nudge.refuse("Round both numbers first, then choose the estimate.");
      return;
    }
    const correct = String(value) === question.expected;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    round.submit({
      correct,
      given: String(value),
      errorKind: correct ? undefined : "off_by_more",
      title: correct ? "About right!" : "Not the nearest",
      message: correct
        ? `${roundTo(question.a, question.unit)} and ${roundTo(question.b, question.unit)} is ${question.expected}. The real answer is ${question.sum}, which is close.`
        : `${question.a} rounds to ${roundTo(question.a, question.unit)} and ${question.b} to ${roundTo(question.b, question.unit)}, so the estimate is ${question.expected}.`,
    });
  };

  const judge = (verdict: Verdict) => {
    if (round.feedback) return;
    const correct = verdict === question.verdict;
    const near = roundTo(question.a, question.unit) + roundTo(question.b, question.unit);
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    round.submit({
      correct,
      given: verdict,
      errorKind: correct ? undefined : "off_by_more",
      title: correct ? "Good judgement!" : "Look again",
      message:
        question.verdict === "right"
          ? `${question.claim} is close to about ${near}, so it could well be right.`
          : question.verdict === "too_big"
            ? `${question.claim} is ten times bigger than about ${near}. A digit has slipped a place.`
            : `${question.claim} is ten times smaller than about ${near}. A digit has been lost.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const estimating = question.mode === "round_estimate";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Estimate and Check"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="scale"
      iconTone="emerald"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      hints={estimateHints(question, { rounded, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={() => {
        round.useSupport("audio_replay");
        void koda.speech.say(prompt, speechRate(koda));
      }}
      recommendation={nextStep}
    >
      <div className="space-y-4">
        <div className={`${SCENE} p-5 sm:p-7 space-y-5`}>
          {estimating ? (
            <>
              <div className="flex flex-wrap gap-6 justify-center">
                {question.around.map((around, i) => (
                  <Dial
                    key={i}
                    around={around}
                    chosen={rounded[i]}
                    tone={i === 0 ? ADDEND_A.text : ADDEND_B.text}
                    onPick={(v) => roundOne(i, v)}
                    disabled={Boolean(round.feedback)}
                    label={String(around.value)}
                  />
                ))}
              </div>
              {scaffold && (
                <p className="text-center text-sm font-bold text-ink/55 tabular-nums">
                  {rounded.every((r) => r !== null)
                    ? `About ${rounded[0]} and about ${rounded[1]}`
                    : "Round each number to the nearer one"}
                </p>
              )}
            </>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-3xl sm:text-4xl font-black tabular-nums text-ink">
                <span className={ADDEND_A.text}>{question.a}</span>
                <span className="text-ink/35"> + </span>
                <span className={ADDEND_B.text}>{question.b}</span>
                <span className="text-ink/35"> = </span>
                <span className={CHANGE.text}>{question.claim}</span>
              </p>
              <p className="text-sm font-bold uppercase tracking-wide text-ink/45">
                someone's answer
              </p>
            </div>
          )}
        </div>

        <NudgeLine nudge={nudge} />

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {estimating
            ? question.options!.map((value) => (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => chooseEstimate(value)}
                  disabled={Boolean(round.feedback)}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  transition={SPRING.tap}
                  aria-label={`About ${value}`}
                  className={themeSystem.button("secondary", "choice", "min-w-[5.5rem]")}
                >
                  {value}
                </motion.button>
              ))
            : VERDICTS.map(({ key, label }) => (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => judge(key)}
                  disabled={Boolean(round.feedback)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.92 }}
                  transition={SPRING.tap}
                  className={themeSystem.button("secondary", "md", "min-w-[8rem]")}
                >
                  {label}
                </motion.button>
              ))}
        </div>

        {estimating && (
          <p className={`text-center text-xs font-semibold ${TOTAL.text}`}>
            These are estimates. None of them is the exact answer.
          </p>
        )}
      </div>
    </SkillRound>
  );
};
