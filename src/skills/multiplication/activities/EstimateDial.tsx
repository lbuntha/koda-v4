import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  composeHints,
  isPractice,
  modeAt,
  playCopy,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import { themeSystem } from "../../../lib/themeSystem";
import {
  drawEstimate,
  drawReasonableClaim,
  roundTo,
  withoutRepeat,
  type RoundingUnit,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { FACTOR_TILE, TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";

/**
 * Estimating, and deciding whether an answer is worth believing.
 *
 * Two modes. In the first a child rounds each factor on its own dial and reads
 * off what the rounded pair comes to; in the second someone else has claimed an
 * answer and the child decides whether it could be right.
 *
 * A single-digit factor gets no dial. Rounding six to the nearest ten gives
 * ten, which is a bigger lie than the estimate is worth and teaches a child to
 * round things that did not need rounding.
 *
 * Every wrong claim in `reasonable` is out by a whole place, never by one. A
 * claim of 847 against a true 846 cannot be judged by estimating at all, so
 * offering it would teach computing under the name of estimation.
 */

export type EstimateMode = "round_estimate" | "reasonable";

interface EstimateSetup {
  mode?: EstimateMode;
  modes?: string[];
  practice?: boolean;
  digitsA?: 2 | 3;
  digitsB?: 1 | 2;
  questionsPerRound?: number;
}

export interface EstimateParams extends EstimateSetup {
  question?: EstimateSetup;
  play?: unknown;
}

export interface EstimateQuestion extends RoundQuestion {
  mode: EstimateMode;
  a: number;
  b: number;
  product: number;
  unitA: RoundingUnit;
  unitB: RoundingUnit;
  roundedA: number;
  roundedB: number;
  estimate: number;
  /** `reasonable`: the answer someone is claiming, and whether it holds up. */
  claim: number;
  reasonable: boolean;
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

export function buildQuestion(params: EstimateParams, index: number, seen?: Set<string>): EstimateQuestion {
  const setup: EstimateSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "round_estimate");
  const spec = { digitsA: setup.digitsA ?? 2, digitsB: setup.digitsB ?? 1 };

  const draw = () => (mode === "reasonable" ? drawReasonableClaim(spec) : {
    ...drawEstimate(spec),
    claim: 0,
    reasonable: true,
  });
  const drawn = seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
  const id = `estimate-${mode}-${index}-${drawn.a}x${drawn.b}`;

  const base: Omit<EstimateQuestion, "prompt" | "expected" | "taskKind"> = {
    id, mode, ...drawn, itemCount: drawn.product,
  };

  if (mode === "reasonable") {
    return {
      ...base,
      taskKind: "is_it_reasonable",
      prompt: `Someone says ${drawn.a} × ${drawn.b} = ${drawn.claim}. Could that be right?`,
      expected: drawn.reasonable ? "Yes" : "No",
    };
  }
  return {
    ...base,
    taskKind: "estimate_by_rounding",
    prompt: `${drawn.a} × ${drawn.b}. Round to get close, without working it out.`,
    expected: String(drawn.estimate),
  };
}

export const promptFor = (question: EstimateQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

const unitName = (unit: RoundingUnit): string => (unit === 100 ? "hundred" : "ten");

export function printedFor(question: EstimateQuestion): PrintedQuestion | null {
  const { a, b, product, roundedA, roundedB, estimate } = question;
  if (question.mode === "reasonable") {
    return {
      text: `Someone says ${a} × ${b} = ${question.claim}. Estimate, then say whether that could be right. ____`,
      answer: `${question.reasonable ? "Yes" : "No"} — about ${roundedA} × ${roundedB} = ${estimate}, and the real answer is ${product}`,
    };
  }
  return {
    text: `Estimate ${a} × ${b} by rounding. ____`,
    answer: `${roundedA} × ${roundedB} = ${estimate} (the real answer is ${product})`,
  };
}

export function methodFor(question: EstimateQuestion): string[] | null {
  const { a, b, unitA, unitB, roundedA, roundedB, estimate } = question;
  const lines = [
    `Round ${a} to the nearest ${unitName(unitA)}: ${roundedA}.`,
    unitB === 1
      ? `${b} is already small enough to leave as it is.`
      : `Round ${b} to the nearest ${unitName(unitB)}: ${roundedB}.`,
    `${roundedA} × ${roundedB} = ${estimate}.`,
  ];
  if (question.mode === "reasonable") {
    lines.push(`Compare that with ${question.claim}. An answer ten times out is not close.`);
  }
  return lines;
}

/** Estimation is arithmetic on paper; there is nothing to draw. */
export const figureFor = (): React.ReactNode | null => null;

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  dialA: number;
  dialB: number;
  revealed: boolean;
}

export function estimateHints(
  question: EstimateQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, b, unitA, unitB } = question;
  if (question.mode === "reasonable") {
    return composeHints(
      kidTip,
      state.revealed
        ? `The estimate is about ${question.estimate}. Is ${question.claim} anywhere near it?`
        : `Round both numbers in your head first, then look at the claim again.`,
      // Names the size of the error without saying which way the answer goes.
      `A claim that is ten times too big or too small is not close, however tidy it looks.`,
    );
  }
  return composeHints(
    kidTip,
    state.dialA !== question.roundedA
      ? `${a} is between two ${unitName(unitA)}s. Which one is it nearer?`
      : unitB !== 1 && state.dialB !== question.roundedB
        ? `Now do the same with ${b}.`
        : `Both are rounded. What do they come to?`,
    `Estimating means answering a near-enough question that is easier than the real one.`,
  );
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const EstimateDial: React.FC<ActivityProps<EstimateParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: EstimateSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

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
  const question = round.question as EstimateQuestion;

  /** Where each dial is standing. */
  const [dialA, setDialA] = useState(0);
  const [dialB, setDialB] = useState(0);
  /** `reasonable`: whether the child has asked to see the estimate. */
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!question) return;
    /* Dials start on the factor itself, so the child moves it to a round
       number rather than being handed one to accept. */
    setDialA(question.a);
    setDialB(question.b);
    setRevealed(false);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode, a, b, unitA, unitB } = question;
  const estimating = mode === "round_estimate";
  const shownEstimate = dialA * dialB;
  /** Both dials still standing on the factors they started from. */
  const untouched = dialA === a && dialB === b;

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /* ---- the dials ---- */
  const turn = (which: "a" | "b", by: 1 | -1) => {
    if (round.feedback) return;
    const unit = which === "a" ? unitA : unitB;
    if (unit === 1) {
      refuse(`${b} is small enough to leave alone. Round the bigger number.`, "That one does not need rounding.");
      return;
    }
    const current = which === "a" ? dialA : dialB;
    /* The dial snaps to the multiples of its own unit. From the factor itself
       it lands on whichever neighbour the child turns towards, which is the
       decision the level is about. */
    const base = roundTo(current, unit);
    const next = base === current ? current + by * unit : by > 0 ? Math.ceil(current / unit) * unit : Math.floor(current / unit) * unit;
    if (next <= 0) {
      refuse("A rounded factor cannot be nothing.", "It cannot go lower.");
      return;
    }
    if (which === "a") setDialA(next);
    else setDialB(next);
    nudge.clear();
    chime(koda, "counted");
    if (hapticsEnabled) koda.haptics.tap();
  };

  const checkEstimate = () => {
    if (round.feedback) return;
    if (dialA === a || (unitB !== 1 && dialB === b)) {
      refuse("Both numbers still need rounding.", "Round them first.");
      return;
    }
    const correct = dialA === question.roundedA && dialB === question.roundedB;
    judge(
      correct,
      String(shownEstimate),
      correct ? "Close enough" : "Not the nearest",
      correct
        ? `${question.roundedA} × ${question.roundedB} = ${question.estimate}, and the real answer is ${question.product}.`
        : `${a} rounds to ${question.roundedA}${unitB === 1 ? "" : ` and ${b} rounds to ${question.roundedB}`}, giving ${question.estimate}.`,
    );
  };

  /* ---- the claim ---- */
  const revealEstimate = () => {
    if (revealed || round.feedback) return;
    setRevealed(true);
    round.useSupport("reveal");
    chime(koda, "reached");
    speak(`About ${question.estimate}.`);
  };

  const answerClaim = (saidYes: boolean) => {
    if (round.feedback) return;
    const correct = saidYes === question.reasonable;
    judge(
      correct,
      saidYes ? "Yes" : "No",
      correct ? "Good judgement" : "Look again",
      question.reasonable
        ? `${question.roundedA} × ${question.roundedB} is about ${question.estimate}, and ${question.claim} sits right beside it.`
        : `${question.roundedA} × ${question.roundedB} is about ${question.estimate}. ${question.claim} is ten times out — the real answer is ${question.product}.`,
    );
  };

  /* ---- pieces ---- */
  const dial = (which: "a" | "b", value: number, original: number, unit: RoundingUnit) => (
    <div className="flex flex-col items-center gap-2">
      {/* Only where a dial can move it — otherwise the caption repeats the tile. */}
      <span className={`text-xs font-bold ${NEUTRAL.text} opacity-70`}>
        {unit === 1 ? "\u00a0" : original}
      </span>
      {unit === 1 ? (
        <span aria-hidden="true" className={`${FACTOR_TILE} ${NEUTRAL.border} bg-surface ${NEUTRAL.text}`}>{value}</span>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Round ${original} down`}
            onClick={() => turn(which, -1)}
            disabled={!!round.feedback}
            className={themeSystem.button("secondary", "choice")}
          >
            −
          </button>
          <span
            aria-label={`${original} rounded to ${value}`}
            className={`${FACTOR_TILE} ${value === original ? `${NEUTRAL.border} bg-surface ${NEUTRAL.text}` : `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text}`}`}
          >
            {value}
          </span>
          <button
            type="button"
            aria-label={`Round ${original} up`}
            onClick={() => turn(which, 1)}
            disabled={!!round.feedback}
            className={themeSystem.button("secondary", "choice")}
          >
            +
          </button>
        </div>
      )}
    </div>
  );

  const board = estimating ? (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-3">
        {dial("a", dialA, a, unitA)}
        <span aria-hidden="true" className={`pb-4 text-2xl font-black ${NEUTRAL.text}`}>×</span>
        {dial("b", dialB, b, unitB)}
      </div>
      {/*
        * Nothing is shown until a dial has moved.
        *
        * Standing on the untouched factors, this line read "About 264" for
        * `33 × 8` — the exact answer, under the word "about", in the lesson
        * that asks a child not to work it out. The estimate only exists once
        * there is something rounded to estimate from.
        */}
      {scaffold && (
        <p
          className={`text-center text-xl font-black tabular-nums ${untouched ? `${NEUTRAL.text} opacity-60` : PRODUCT.text}`}
          aria-live="polite"
        >
          {untouched ? "Round them to see" : `About ${shownEstimate}`}
        </p>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <p className={`text-3xl font-black tabular-nums sm:text-4xl`}>
        <span className={GROUPS.text}>{a}</span>
        <span className="text-ink/55"> × </span>
        <span className={EACH.text}>{b}</span>
        <span className="text-ink/55"> = </span>
        <span className={ADJUSTMENT.text}>{question.claim}</span>
      </p>
      {revealed ? (
        <p className={`text-lg font-black tabular-nums ${PRODUCT.text}`} aria-live="polite">
          {question.roundedA} × {question.roundedB} is about {question.estimate}
        </p>
      ) : (
        <button
          type="button"
          onClick={revealEstimate}
          disabled={!!round.feedback}
          aria-label="Round them and see"
          className={themeSystem.button("secondary", "md")}
        >
          Round them and see
        </button>
      )}
    </div>
  );

  const controls = estimating ? (
    <button type="button" onClick={checkEstimate} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
      Check
    </button>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {[true, false].map((saidYes) => (
        <button
          key={String(saidYes)}
          type="button"
          aria-label={saidYes ? `Yes, ${question.claim} could be right` : `No, ${question.claim} is not close`}
          onClick={() => answerClaim(saidYes)}
          disabled={!!round.feedback}
          className={`${TOUCH_TARGET} rounded-2xl border-2 px-6 py-3 text-lg font-black text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            saidYes ? `${PRODUCT.border} ${PRODUCT.soft}` : `${ADJUSTMENT.border} ${ADJUSTMENT.soft}`
          }`}
        >
          {saidYes ? "Could be right" : "Not close"}
        </button>
      ))}
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Estimate"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : estimateHints(question, copy.kidTip, { dialA, dialB, revealed })}
      iconName="scale"
      iconTone="cyan"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {board}
        {controls}
      </div>
    </SkillRound>
  );
};
