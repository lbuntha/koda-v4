import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { BOND_NODE, SCENE } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import {
  differenceKey, drawDifference, withoutRepeat, type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";

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
  if (q.mode === "subtrahend_unknown") return `${q.minuend} is the whole and ${q.difference} remains. What part was taken away?`;
  if (q.mode === "minuend_unknown") return `One part is ${q.subtrahend} and the other is ${q.difference}. What is the whole?`;
  return `${q.minuend} is the whole. One part is ${q.subtrahend}. What is the missing part?`;
};

export const printedFor = (q: BondQuestion): PrintedQuestion => {
  if (q.mode === "subtrahend_unknown") return { text: `${q.minuend} − □ = ${q.difference}`, answer: String(q.subtrahend) };
  if (q.mode === "minuend_unknown") return { text: `□ − ${q.subtrahend} = ${q.difference}`, answer: String(q.minuend) };
  return { text: `${q.minuend} − ${q.subtrahend} = □`, answer: String(q.difference) };
};

export const methodFor = (q: BondQuestion): string[] => q.mode === "minuend_unknown"
  ? ["The two parts join to make the whole.", "Add the removed and remaining parts.", "Put that total in the whole box."]
  : ["Start from the whole.", `Use the known ${q.mode === "part_unknown" ? "removed" : "remaining"} part.`, "The other part completes the bond."];

export function bondHints(q: BondQuestion, state: { selected?: number; kidTip?: string }): string[] {
  if (q.mode === "minuend_unknown") return composeHints(
    state.kidTip ?? "The whole is both parts together.",
    `Put the removed part ${q.subtrahend} and remaining part ${q.difference} back together.`,
    `${q.subtrahend} plus ${q.difference} makes the whole ${q.minuend}.`,
  );
  if (q.mode === "subtrahend_unknown") return composeHints(
    state.kidTip ?? "Find the gap between the whole and the part that remains.",
    `Start at ${q.difference} and count up to the whole ${q.minuend}.`,
    `The missing removed part is the amount between ${q.difference} and ${q.minuend}.`,
  );
  return composeHints(
    state.kidTip ?? "The two parts must make the whole.",
    `The whole is ${q.minuend}. One part is ${q.subtrahend}; find the part that completes it.`,
    `${q.minuend} minus ${q.subtrahend} gives the missing remaining part.`,
  );
}

const valueFor = (q: BondQuestion, role: BondQuestion["blankRole"]): number => role === "whole" ? q.minuend : role === "removed" ? q.subtrahend : q.difference;
const choicesFor = (answer: number) => Array.from({ length: 4 }, (_, i) => Math.max(0, answer - 2) + i);

export const figureFor = (q: BondQuestion): React.ReactNode => {
  const text = (role: BondQuestion["blankRole"]) => q.blankRole === role ? "" : String(valueFor(q, role));
  return <span className="inline-flex flex-col items-center gap-1 text-slate-900" role="img" aria-label={`Part-whole bond with ${q.blankRole} missing`}>
    <span className="text-[9px] uppercase tracking-wide">whole</span>
    <span className="inline-flex h-8 w-12 items-center justify-center border-2 border-slate-900 font-bold">{text("whole")}</span>
    <span className="h-3 w-20 border-l-2 border-r-2 border-t-2 border-slate-900" />
    <span className="inline-flex gap-3">
      <span className="inline-flex flex-col items-center"><span className="inline-flex h-8 w-12 items-center justify-center border-2 border-slate-900 font-bold">{text("removed")}</span><span className="text-[9px]">removed</span></span>
      <span className="inline-flex flex-col items-center"><span className="inline-flex h-8 w-12 items-center justify-center border-2 border-slate-900 font-bold">{text("remaining")}</span><span className="text-[9px]">remaining</span></span>
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
    if (selected === undefined) { nudge.refuse("Choose the number for the empty box before you check."); return; }
    const correct = selected === answer;
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({ correct, given: String(selected), expected: q.expected, errorKind: correct ? undefined : "off_by_more",
      title: correct ? "The bond is complete!" : "Check the whole and its parts",
      message: practising ? undefined : `${q.subtrahend} and ${q.difference} are the two parts of ${q.minuend}.` });
  };
  const value = (role: BondQuestion["blankRole"]) => q.blankRole === role ? undefined : valueFor(q, role);

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Subtraction Number Bonds" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="gem" iconTone="emerald"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : bondHints(q, { selected, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-5">
      <div className={`${SCENE} p-5 sm:p-8 min-h-[250px] flex flex-col items-center justify-center`}>
        <Node label="whole" role="whole" value={value("whole")} selected={q.blankRole === "whole" ? selected : undefined} />
        <div className="h-8 w-32 border-l-4 border-r-4 border-t-4 border-ink/25 rounded-t-2xl" aria-hidden="true" />
        <div className="flex gap-8 sm:gap-16">
          <Node label="removed part" role="removed" value={value("removed")} selected={q.blankRole === "removed" ? selected : undefined} />
          <Node label="remaining part" role="remaining" value={value("remaining")} selected={q.blankRole === "remaining" ? selected : undefined} />
        </div>
        {scaffold && !practising && <div className="mt-5 text-sm font-bold text-ink/60">Whole = removed part + remaining part</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {choicesFor(answer).map((choice) => <motion.button key={choice} type="button" onClick={() => setSelected(choice)} aria-pressed={selected === choice}
          className={`${themeSystem.button("secondary", "choice")} ${selected === choice ? "ring-4 ring-violet-400/60" : ""}`} whileTap={{ scale: 0.9 }}>{choice}</motion.button>)}
      </div>
      <div className="flex justify-center"><button type="button" onClick={submit} className={themeSystem.button("primary", "lg")}>Check</button></div>
    </div>
  </SkillRound>;
};
