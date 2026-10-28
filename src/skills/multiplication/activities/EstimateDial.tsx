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
  guideSetup,
  useGuide,
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
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
      prompt: tm("estimate.promptClaim", { a: drawn.a, b: drawn.b, claim: drawn.claim }),
      expected: drawn.reasonable ? "Yes" : "No",
    };
  }
  return {
    ...base,
    taskKind: "estimate_by_rounding",
    prompt: tm("estimate.promptRound", { a: drawn.a, b: drawn.b }),
    expected: String(drawn.estimate),
  };
}

export const promptFor = (question: EstimateQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

const unitName = (unit: RoundingUnit): string => tm(`estimate.unitOne.${unit === 100 ? 100 : 10}`);
const unitNames = (unit: RoundingUnit): string => tm(`estimate.unitMany.${unit === 100 ? 100 : 10}`);

export function printedFor(question: EstimateQuestion): PrintedQuestion | null {
  const { a, b, product, roundedA, roundedB, estimate } = question;
  if (question.mode === "reasonable") {
    return {
      text: tm("estimate.printedClaim", { a, b, claim: question.claim }),
      answer: tm("estimate.printedClaimAnswer", { verdict: question.reasonable ? tm("estimate.yes") : tm("estimate.no"), ra: roundedA, rb: roundedB, estimate, product }),
    };
  }
  return {
    text: tm("estimate.printedRound", { a, b }),
    answer: tm("estimate.printedRoundAnswer", { ra: roundedA, rb: roundedB, estimate, product }),
  };
}

export function methodFor(question: EstimateQuestion): string[] | null {
  const { a, b, unitA, unitB, roundedA, roundedB, estimate } = question;
  const lines = [
    tm("estimate.methodRoundA", { a, unit: unitName(unitA), rounded: roundedA }),
    unitB === 1
      ? tm("estimate.methodLeaveB", { b })
      : tm("estimate.methodRoundB", { b, unit: unitName(unitB), rounded: roundedB }),
    tm("estimate.methodProduct", { ra: roundedA, rb: roundedB, estimate }),
  ];
  if (question.mode === "reasonable") {
    lines.push(tm("estimate.methodCompare", { claim: question.claim }));
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
        ? tm("estimate.hintClaimRevealed", { estimate: question.estimate, claim: question.claim })
        : tm("estimate.hintClaimRound"),
      // Names the size of the error without saying which way the answer goes.
      tm("estimate.hintClaimTen"),
    );
  }
  return composeHints(
    kidTip,
    state.dialA !== question.roundedA
      ? tm("estimate.hintBetween", { a, units: unitNames(unitA) })
      : unitB !== 1 && state.dialB !== question.roundedB
        ? tm("estimate.hintNowB", { b })
        : tm("estimate.hintBoth"),
    tm("estimate.hintEasier"),
  );
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const EstimateDial: React.FC<ActivityProps<EstimateParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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
    /*
     * A refused move is this engine already knowing the move was wrong.
     *
     * What it never did was notice a child doing it repeatedly, which is the
     * difference between a slip and not having the technique. Safe to call a
     * coach declared further down: this only ever runs from a handler, long
     * after the render that created it.
     */
    guide.stumbled();
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

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    if (!question) return;
    /* Dials start on the factor itself, so the child moves it to a round
       number rather than being handed one to accept. */
    setDialA(question.a);
    setDialB(question.b);
    setRevealed(false);
    clearNudge();
  };


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
      refuse(tm("estimate.leaveAlone", { b }), tm("estimate.leaveAloneSay"));
      return;
    }
    const current = which === "a" ? dialA : dialB;
    /* The dial snaps to the multiples of its own unit. From the factor itself
       it lands on whichever neighbour the child turns towards, which is the
       decision the level is about. */
    const base = roundTo(current, unit);
    const next = base === current ? current + by * unit : by > 0 ? Math.ceil(current / unit) * unit : Math.floor(current / unit) * unit;
    if (next <= 0) {
      refuse(tm("estimate.notNothing"), tm("estimate.notNothingSay"));
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
      refuse(tm("estimate.stillRound"), tm("estimate.stillRoundSay"));
      return;
    }
    const correct = dialA === question.roundedA && dialB === question.roundedB;
    judge(
      correct,
      String(shownEstimate),
      correct ? tm("estimate.closeTitle") : tm("estimate.notNearestTitle"),
      correct
        ? tm("estimate.closeMessage", { ra: question.roundedA, rb: question.roundedB, estimate: question.estimate, product: question.product })
        : unitB === 1
          ? tm("estimate.roundsTo", { a, ra: question.roundedA, estimate: question.estimate })
          : tm("estimate.roundsToBoth", { a, ra: question.roundedA, b, rb: question.roundedB, estimate: question.estimate }),
    );
  };

  /* ---- the claim ---- */
  const revealEstimate = () => {
    if (revealed || round.feedback) return;
    setRevealed(true);
    round.useSupport("reveal");
    chime(koda, "reached");
    speak(tm("estimate.about", { estimate: question.estimate }));
  };

  const answerClaim = (saidYes: boolean) => {
    if (round.feedback) return;
    const correct = saidYes === question.reasonable;
    judge(
      correct,
      saidYes ? "Yes" : "No",
      correct ? tm("estimate.judgeTitle") : tm("estimate.lookAgain"),
      question.reasonable
        ? tm("estimate.claimClose", { ra: question.roundedA, rb: question.roundedB, estimate: question.estimate, claim: question.claim })
        : tm("estimate.claimFar", { ra: question.roundedA, rb: question.roundedB, estimate: question.estimate, claim: question.claim, product: question.product }),
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
            aria-label={tm("estimate.roundDown", { original })}
            onClick={() => turn(which, -1)}
            disabled={!!round.feedback}
            className={themeSystem.button("secondary", "choice")}
          >
            −
          </button>
          <span
            aria-label={tm("estimate.roundedTo", { original, value })}
            className={`${FACTOR_TILE} ${value === original ? `${NEUTRAL.border} bg-surface ${NEUTRAL.text}` : `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text}`}`}
          >
            {value}
          </span>
          <button
            type="button"
            aria-label={tm("estimate.roundUp", { original })}
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
          {untouched ? tm("estimate.roundToSee") : tm("estimate.aboutShown", { estimate: shownEstimate })}
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
          {tm("estimate.isAbout", { ra: question.roundedA, rb: question.roundedB, estimate: question.estimate })}
        </p>
      ) : (
        <button
          type="button"
          onClick={revealEstimate}
          disabled={!!round.feedback}
          aria-label={tm("estimate.roundAndSee")}
          className={themeSystem.button("secondary", "md")}
        >
          {tm("estimate.roundAndSee")}
        </button>
      )}
    </div>
  );

  const controls = estimating ? (
    <button type="button" onClick={checkEstimate} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
      {tm("estimate.check")}
    </button>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {[true, false].map((saidYes) => (
        <button
          key={String(saidYes)}
          type="button"
          aria-label={saidYes ? tm("estimate.ariaYes", { claim: question.claim }) : tm("estimate.ariaNo", { claim: question.claim })}
          onClick={() => answerClaim(saidYes)}
          disabled={!!round.feedback}
          className={`${TOUCH_TARGET} rounded-2xl border-2 px-6 py-3 text-lg font-black text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
            saidYes ? `${PRODUCT.border} ${PRODUCT.soft}` : `${ADJUSTMENT.border} ${ADJUSTMENT.soft}`
          }`}
        >
          {saidYes ? tm("estimate.couldBe") : tm("estimate.notClose")}
        </button>
      ))}
    </div>
  );

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : estimateHints(question, copy.kidTip, { dialA, dialB, revealed });
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
    /*
     * Effort, measured against where the question set the dials.
     *
     * They open on the question's own numbers, not at zero, so "the dial is not
     * zero" counted a child who had touched nothing as two moves in — the
     * coach then stepped in at five seconds instead of seven. Third time this
     * trap has appeared, in a third disguise.
     */
    progress:
      (revealed ? 1 : 0) +
      (dialA !== question.a ? 1 : 0) +
      (dialB !== question.b ? 1 : 0),
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("estimate.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (revealed || dialA !== question.a || dialB !== question.b) ? restart : undefined
      }
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
