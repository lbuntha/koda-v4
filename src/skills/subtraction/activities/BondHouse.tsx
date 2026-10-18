import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, guideSetup, useGuide, type PracticeSetup, type RoundQuestion,
  answerChoices,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { BOND_NODE, SCENE } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, drawDifference, withoutRepeat, type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";
import { ts } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

export type BondMode = "part_unknown" | "subtrahend_unknown" | "minuend_unknown";

export interface BondSetup extends PracticeSetup {
  mode?: BondMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  questionsPerRound?: number;
}

export interface BondHouseParams extends BondSetup { question?: BondSetup }

export interface BondQuestion extends RoundQuestion {
  mode: BondMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  blankRole: "whole" | "removed" | "remaining";
}

const DEFAULT_SPEC: Record<BondMode, DifferenceSpec> = {
  part_unknown: { minuendRange: [3, 10], subtrahendRange: [1, 9] },
  subtrahend_unknown: { minuendRange: [4, 20], subtrahendRange: [1, 19] },
  minuend_unknown: { minuendRange: [3, 20], subtrahendRange: [1, 10] },
};

const declared = (setup: BondSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) out.differenceRange = setup.differenceRange;
  return out;
};

export const specFor = (mode: BondMode, setup: BondSetup): DifferenceSpec => ({ ...DEFAULT_SPEC[mode], ...declared(setup) });

export const buildQuestion = (setup: BondSetup, index: number, seen: Set<string>): BondQuestion => {
  const mode = modeAt<BondMode>(setup, index, "part_unknown");
  const value = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  const blankRole = mode === "minuend_unknown" ? "whole" : mode === "subtrahend_unknown" ? "removed" : "remaining";
  const answer = blankRole === "whole" ? value.minuend : blankRole === "removed" ? value.subtrahend : value.difference;
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_bond_${mode}`,
    mode, ...value, blankRole, expected: String(answer), itemCount: value.minuend,
  };
};

export const promptFor = (q: BondQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  if (q.mode === "subtrahend_unknown") return ts("bond.promptRemoved", { a: q.minuend, difference: q.difference });
  if (q.mode === "minuend_unknown") return ts("bond.promptWhole", { b: q.subtrahend, difference: q.difference });
  return ts("bond.prompt", { a: q.minuend, b: q.subtrahend });
};

export const printedFor = (q: BondQuestion): PrintedQuestion => {
  if (q.mode === "subtrahend_unknown") return { text: `${q.minuend} − □ = ${q.difference}`, answer: String(q.subtrahend) };
  if (q.mode === "minuend_unknown") return { text: `□ − ${q.subtrahend} = ${q.difference}`, answer: String(q.minuend) };
  return { text: `${q.minuend} − ${q.subtrahend} = □`, answer: String(q.difference) };
};

export const methodFor = (q: BondQuestion): string[] => q.mode === "minuend_unknown"
  ? [ts("bond.methodWhole1"), ts("bond.methodWhole2"), ts("bond.methodWhole3")]
  : [ts("bond.method1"), ts(q.mode === "part_unknown" ? "bond.method2Removed" : "bond.method2Remaining"), ts("bond.method3")];

export function bondHints(q: BondQuestion, state: { selected?: number; kidTip?: string }): string[] {
  if (q.mode === "minuend_unknown") return composeHints(
    state.kidTip ?? ts("bond.hintWholeTip"),
    ts("bond.hintPutBack", { b: q.subtrahend, difference: q.difference }),
    ts("bond.hintMakesWhole", { b: q.subtrahend, difference: q.difference, a: q.minuend }),
  );
  if (q.mode === "subtrahend_unknown") return composeHints(
    state.kidTip ?? ts("bond.hintRemovedTip"),
    ts("bond.hintCountUp", { difference: q.difference, a: q.minuend }),
    ts("bond.hintBetween", { difference: q.difference, a: q.minuend }),
  );
  return composeHints(
    state.kidTip ?? ts("bond.hintTip"),
    ts("bond.hintComplete", { a: q.minuend, b: q.subtrahend }),
    ts("bond.hintMinus", { a: q.minuend, b: q.subtrahend }),
  );
}

const valueFor = (q: BondQuestion, role: BondQuestion["blankRole"]): number => role === "whole" ? q.minuend : role === "removed" ? q.subtrahend : q.difference;
/** Four near misses, ordered by the question so they cannot be learned by position. */
const choicesFor = (answer: number, seed: string): number[] => answerChoices(answer, seed);

export const figureFor = (q: BondQuestion): React.ReactNode => {
  const text = (role: BondQuestion["blankRole"]) => q.blankRole === role ? "" : String(valueFor(q, role));
  return <span className="inline-flex flex-col items-center gap-1 text-slate-900" role="img" aria-label={ts(`bond.figure.${q.blankRole}`)}>
    <span className="text-[9px] uppercase tracking-wide">{ts("bond.whole")}</span>
    <span className="inline-flex h-8 w-12 items-center justify-center border-2 border-slate-900 font-bold">{text("whole")}</span>
    <span className="h-3 w-20 border-l-2 border-r-2 border-t-2 border-slate-900" />
    <span className="inline-flex gap-3">
      <span className="inline-flex flex-col items-center"><span className="inline-flex h-8 w-12 items-center justify-center border-2 border-slate-900 font-bold">{text("removed")}</span><span className="text-[9px]">{ts("bond.removed")}</span></span>
      <span className="inline-flex flex-col items-center"><span className="inline-flex h-8 w-12 items-center justify-center border-2 border-slate-900 font-bold">{text("remaining")}</span><span className="text-[9px]">{ts("bond.remaining")}</span></span>
    </span>
  </span>;
};

const Node: React.FC<{ label: string; value?: number; role: "whole" | "removed" | "remaining"; selected?: number }> = ({ label, value, role, selected }) => {
  const tone = role === "whole" ? WHOLE : role === "removed" ? REMOVED_PART : DIFFERENCE;
  const shown = value ?? selected;
  return <div className="flex flex-col items-center gap-1.5">
    <div className={`${BOND_NODE} rounded-2xl border-2 ${tone.soft} ${tone.border} flex items-center justify-center text-3xl font-black tabular-nums ${tone.text}`}>{shown ?? "?"}</div>
    <span className="text-[10px] font-bold uppercase tracking-wide text-ink/55">{label}</span>
  </div>;
};

export const BondHouse: React.FC<ActivityProps<BondHouseParams>> = ({ params, koda, onComplete, lesson }) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: BondSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [selected, setSelected] = useState<number>();
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 13,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as BondQuestion;
  useEffect(() => { setSelected(undefined); nudge.clear(); }, [q.id, nudge.clear]);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const answer = Number(q.expected);
  const submit = () => {
    if (selected === undefined) { nudge.refuse(ts("bond.refuseChoose")); return; }
    const correct = selected === answer;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({ correct, given: String(selected), expected: q.expected, errorKind: correct ? undefined : "off_by_more",
      title: correct ? ts("bond.rightTitle") : ts("bond.wrongTitle"),
      message: practising ? undefined : ts("bond.message", { b: q.subtrahend, difference: q.difference, a: q.minuend }) });
  };
  const value = (role: BondQuestion["blankRole"]) => q.blankRole === role ? undefined : valueFor(q, role);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : bondHints(q, { selected, kidTip: copy.kidTip });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: q.id,
    rungs: hints,
    target: -1,
    progress: selected === undefined ? 0 : 1,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle={ts("bond.title")} round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="gem" iconTone="emerald"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={hints}
    guide={practising ? undefined : guide}
    guideMethod={copy.stepByStep}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-5">
      <div className={`${SCENE} p-5 sm:p-8 min-h-[250px] flex flex-col items-center justify-center`}>
        <Node label={ts("bond.whole")} role="whole" value={value("whole")} selected={q.blankRole === "whole" ? selected : undefined} />
        <div className="h-8 w-32 border-l-4 border-r-4 border-t-4 border-ink/25 rounded-t-2xl" aria-hidden="true" />
        <div className="flex gap-8 sm:gap-16">
          <Node label={ts("bond.removedPart")} role="removed" value={value("removed")} selected={q.blankRole === "removed" ? selected : undefined} />
          <Node label={ts("bond.remainingPart")} role="remaining" value={value("remaining")} selected={q.blankRole === "remaining" ? selected : undefined} />
        </div>
        {scaffold && !practising && <div className="mt-5 text-sm font-bold text-ink/60">{ts("bond.equation")}</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {choicesFor(answer, q.id).map((choice) => <motion.button key={choice} type="button" onClick={() => setSelected(choice)} aria-pressed={selected === choice}
          className={`${themeSystem.button("secondary", "choice")} ${selected === choice ? "ring-4 ring-violet-400/60" : ""}`} whileTap={{ scale: 0.9 }}>{choice}</motion.button>)}
      </div>
      <div className="flex justify-center"><button type="button" onClick={submit} className={themeSystem.button("primary", "lg")}>{ts("check")}</button></div>
    </div>
  </SkillRound>;
};
