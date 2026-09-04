import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { SCENE, TOUCH_TARGET } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, digitsOf, drawRoundingDifference, roundTo, shuffle, withoutRepeat,
  type Difference,
} from "../internal/data/subtractionNumbers";

export type EstimateMode = "round_estimate" | "reasonable";

export interface EstimateSetup extends PracticeSetup {
  mode?: EstimateMode;
  digits?: 2 | 3;
  questionsPerRound?: number;
}

export interface EstimateDialParams extends EstimateSetup { question?: EstimateSetup }

/** Why a claimed answer is or is not worth believing. */
export type ClaimKind = "exact" | "estimate" | "reversed" | "place_value" | "added";

/**
 * `expected` joins the verdict and the reason with a comma, so no reason may
 * contain one — a sentence broken at its own punctuation would compare a
 * half-reason against a whole one and fail a child who was right.
 */
export const REASONS: Record<ClaimKind, string> = {
  exact: "It is close to the rounded estimate.",
  estimate: "It is close to the rounded estimate.",
  reversed: "Some columns were taken the wrong way round.",
  place_value: "It is about ten times too big.",
  added: "That is what adding would give rather than subtracting.",
};

export const isReasonable = (kind: ClaimKind): boolean => kind === "exact" || kind === "estimate";

export interface EstimateQuestion extends RoundQuestion {
  mode: EstimateMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  unit: 10 | 100;
  roundedMinuend: number;
  roundedSubtrahend: number;
  estimate: number;
  /** `reasonable` only. */
  claim?: number;
  claimKind?: ClaimKind;
  reasons?: string[];
}

/** The same digits subtracted the wrong way round in any column that borrows. */
export const reverseColumns = (minuend: number, subtrahend: number): number => {
  const a = digitsOf(minuend);
  const b = digitsOf(subtrahend);
  return Math.abs(a.hundreds - b.hundreds) * 100 + Math.abs(a.tens - b.tens) * 10 + Math.abs(a.ones - b.ones);
};

/**
 * Wrong claims a child could actually produce.
 *
 * Absurd distractors teach nothing: a number twenty times too big is rejected
 * on sight without any estimating. These are the three real ones — columns
 * taken the wrong way round, an answer a place out, and adding instead of
 * subtracting — so judging them needs an actual estimate.
 */
export const claimsFor = (value: Difference, estimate: number): Array<{ kind: ClaimKind; value: number }> => {
  const wrong: Array<{ kind: ClaimKind; value: number }> = [];
  const reversed = reverseColumns(value.minuend, value.subtrahend);
  if (reversed !== value.difference) wrong.push({ kind: "reversed", value: reversed });
  wrong.push({ kind: "place_value", value: value.difference * 10 });
  wrong.push({ kind: "added", value: value.minuend + value.subtrahend });
  return [
    { kind: "exact", value: value.difference },
    { kind: "estimate", value: estimate },
    ...wrong,
  ];
};

export const buildQuestion = (setup: EstimateSetup, index: number, seen: Set<string>): EstimateQuestion => {
  const mode = modeAt<EstimateMode>(setup, index, "round_estimate");
  const digits = setup.digits ?? 3;
  const value = withoutRepeat<Difference>(() => drawRoundingDifference(digits), differenceKey, seen);
  const unit: 10 | 100 = digits === 2 ? 10 : 100;
  const roundedMinuend = roundTo(value.minuend, unit);
  const roundedSubtrahend = roundTo(value.subtrahend, unit);
  const estimate = roundedMinuend - roundedSubtrahend;
  const base = {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_estimate_${mode}`,
    mode, ...value, unit, roundedMinuend, roundedSubtrahend, estimate, itemCount: value.minuend,
  };

  if (mode === "round_estimate") return { ...base, expected: String(estimate) };

  const pool = claimsFor(value, estimate);
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...base, claim: picked.value, claimKind: picked.kind,
    reasons: shuffle([...new Set(Object.values(REASONS))]),
    expected: `${isReasonable(picked.kind) ? "yes" : "no"},${REASONS[picked.kind]}`,
  };
};

export const promptFor = (q: EstimateQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference)).replaceAll("{claim}", String(q.claim ?? ""));
  if (filled) return filled;
  if (q.mode === "reasonable") return `Someone says ${q.minuend} minus ${q.subtrahend} is ${q.claim}. Is that reasonable?`;
  return `About how much is ${q.minuend} minus ${q.subtrahend}?`;
};

export const printedFor = (q: EstimateQuestion): PrintedQuestion => q.mode === "reasonable"
  ? { text: `${q.minuend} − ${q.subtrahend} = ${q.claim}. Reasonable? Circle yes or no and say why.`, answer: `${isReasonable(q.claimKind!) ? "yes" : "no"} — ${REASONS[q.claimKind!]}` }
  : { text: `Estimate: ${q.minuend} − ${q.subtrahend} is about □`, answer: `about ${q.estimate}` };

export const methodFor = (q: EstimateQuestion): string[] => q.mode === "reasonable"
  ? ["Round both numbers and estimate the answer.", "Compare the claim with your estimate.", "Say which mistake would explain the gap."]
  : [`Round each number to the nearest ${q.unit === 10 ? "ten" : "hundred"}.`, "Subtract the rounded numbers.", "The answer is an estimate, so say 'about'."];

export function estimateHints(
  q: EstimateQuestion,
  state: { rounded: boolean; verdict?: string; kidTip?: string },
): string[] {
  const unitName = q.unit === 10 ? "ten" : "hundred";
  if (q.mode === "reasonable") return composeHints(
    state.kidTip ?? "Estimate first, then judge the claim.",
    `Rounded, this is about ${q.roundedMinuend} minus ${q.roundedSubtrahend}, which is about ${q.estimate}.`,
    isReasonable(q.claimKind!)
      ? `${q.claim} sits close to ${q.estimate}, so it is worth believing.`
      : `${q.claim} is nowhere near ${q.estimate}. ${REASONS[q.claimKind!]}`,
  );
  return composeHints(
    state.kidTip ?? `Round both numbers to the nearest ${unitName} first.`,
    state.rounded
      ? `You have ${q.roundedMinuend} minus ${q.roundedSubtrahend}. Subtract those.`
      : `${q.minuend} rounds to ${q.roundedMinuend}, and ${q.subtrahend} rounds to ${q.roundedSubtrahend}.`,
    `${q.roundedMinuend} minus ${q.roundedSubtrahend} is about ${q.estimate}.`,
  );
}

export const roundingChoices = (value: number, unit: 10 | 100): number[] => {
  const down = Math.floor(value / unit) * unit;
  return shuffle([down, down + unit, roundTo(value, unit) + unit * (roundTo(value, unit) === down ? 2 : -2)]
    .filter((option, at, all) => option >= 0 && all.indexOf(option) === at));
};

/**
 * Four distinct estimates, always.
 *
 * Clamping `estimate - unit` at zero used to collapse a choice into another
 * when the estimate was small, leaving three buttons — and a round with fewer
 * wrong answers than it looks is a round a child can win by counting.
 */
const estimateChoices = (estimate: number, unit: 10 | 100): number[] => {
  const options = new Set<number>([estimate]);
  for (let step = 1; options.size < 4; step += 1) {
    if (estimate - unit * step >= 0) options.add(estimate - unit * step);
    if (options.size < 4) options.add(estimate + unit * step);
  }
  return shuffle([...options]);
};

export const EstimateDial: React.FC<ActivityProps<EstimateDialParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: EstimateSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [rounded, setRounded] = useState(false);
  const [verdict, setVerdict] = useState<string>();
  const [reason, setReason] = useState<string>();
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 41,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as EstimateQuestion;

  useEffect(() => { setRounded(false); setVerdict(undefined); setReason(undefined); nudge.clear(); }, [q.id, nudge.clear]);

  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);

  const answerEstimate = (value: number) => {
    const correct = value === q.estimate;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given: String(value), expected: q.expected,
      errorKind: correct ? undefined : Math.abs(value - q.estimate) === q.unit ? "off_by_one" : "off_by_more",
      title: correct ? "A good estimate!" : "Round again",
      message: practising ? undefined : `${q.roundedMinuend} minus ${q.roundedSubtrahend} is about ${q.estimate}.`,
    });
  };

  const submitJudgement = () => {
    if (!verdict) { nudge.refuse("Say whether the answer is reasonable first."); return; }
    if (!reason) { nudge.refuse("Choose the reason that explains it."); return; }
    const given = `${verdict},${reason}`;
    const correct = given === q.expected;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given, expected: q.expected,
      errorKind: correct ? undefined : q.claimKind === "reversed" ? "reversed" : q.claimKind === "place_value" ? "place_value" : "off_by_more",
      title: correct ? "Well judged!" : "Estimate it again",
      message: practising ? undefined : `About ${q.estimate}, so ${q.claim} is ${isReasonable(q.claimKind!) ? "reasonable" : "not"}. ${REASONS[q.claimKind!]}`,
    });
  };

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Estimate and Judge" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="scale" iconTone="cyan"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : estimateHints(q, { rounded, verdict, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-7 min-h-[210px] flex flex-col items-center justify-center gap-4`}>
        <div className="text-3xl sm:text-4xl font-black tabular-nums">
          <span className={WHOLE.text}>{q.minuend}</span><span className="text-ink/30"> − </span><span className={REMOVED_PART.text}>{q.subtrahend}</span>
          {q.mode === "reasonable" && <><span className="text-ink/30"> = </span><span className={COMPARISON.text}>{q.claim}</span></>}
        </div>

        {q.mode === "round_estimate" && (rounded
          ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-2xl font-black tabular-nums ${DIFFERENCE.text}`}>
            about {q.roundedMinuend} − {q.roundedSubtrahend}
          </motion.div>
          : <button type="button" className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}
            onClick={() => { setRounded(true); round.useSupport("walkthrough"); chime(koda, "changed"); }}>
            Round both to the nearest {q.unit === 10 ? "ten" : "hundred"}
          </button>)}

        {q.mode === "reasonable" && <div className="flex gap-2.5">
          {["yes", "no"].map((option) => <button key={option} type="button" onClick={() => setVerdict(option)} aria-pressed={verdict === option}
            className={`${themeSystem.button("secondary", "choice")} ${verdict === option ? "ring-4 ring-violet-400/60" : ""}`}>{option === "yes" ? "Reasonable" : "Not reasonable"}</button>)}
        </div>}

        {scaffold && !practising && <div className="text-center text-sm font-bold text-ink/60">
          {q.mode === "reasonable"
            ? "Estimate in your head, then judge the claim."
            : rounded ? "Now subtract the rounded numbers." : "An estimate is about, not exact."}
        </div>}
      </div>

      {q.mode === "round_estimate" && rounded && <div className="flex flex-wrap justify-center gap-2.5">
        {estimateChoices(q.estimate, q.unit).map((value) => <button key={value} type="button" onClick={() => answerEstimate(value)}
          disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>about {value}</button>)}
      </div>}

      {q.mode === "reasonable" && <>
        <div className="space-y-2 mx-auto max-w-md">
          {q.reasons!.map((option) => <button key={option} type="button" onClick={() => setReason(option)} aria-pressed={reason === option}
            className={`w-full text-left ${themeSystem.button("secondary", "md")} ${reason === option ? "ring-4 ring-violet-400/60" : ""}`}>{option}</button>)}
        </div>
        <div className="flex justify-center"><button type="button" onClick={submitJudgement} className={themeSystem.button("primary", "lg")}>Check</button></div>
      </>}
    </div>
  </SkillRound>;
};
