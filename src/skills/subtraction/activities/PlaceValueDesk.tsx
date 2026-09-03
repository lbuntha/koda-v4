import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { DIGIT_CELL, SCENE } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, digitsOf, drawDifference, withoutRepeat,
  type Difference, type DifferenceSpec, type Place,
} from "../internal/data/subtractionNumbers";

export type ChartMode =
  | "chart_subtract"
  | "chart_three"
  | "expanded"
  | "check_addition"
  | "left_right";

export interface ChartSetup extends PracticeSetup {
  mode?: ChartMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  questionsPerRound?: number;
}

export interface PlaceValueDeskParams extends ChartSetup { question?: ChartSetup }

/** One box the child fills, and the value that box is right with. */
export interface ChartSlot {
  key: string;
  label: string;
  answer: number;
  /** Shown before the box, e.g. "60 − 20 =". */
  lead?: string;
}

export interface ChartQuestion extends RoundQuestion {
  mode: ChartMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  places: Place[];
  slots: ChartSlot[];
}

const CLEAN_TWO: DifferenceSpec = { minuendRange: [21, 99], subtrahendRange: [10, 88], exchange: "never", excludeEqual: true };

const DEFAULT_SPEC: Record<ChartMode, DifferenceSpec> = {
  chart_subtract: CLEAN_TWO,
  chart_three: { minuendRange: [200, 999], subtrahendRange: [100, 888], exchange: "never", excludeEqual: true },
  expanded: CLEAN_TWO,
  check_addition: CLEAN_TWO,
  left_right: CLEAN_TWO,
};

const declared = (setup: ChartSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) out.differenceRange = setup.differenceRange;
  return out;
};

/**
 * Every chart mode subtracts column by column, so none of them may regroup.
 *
 * Left-to-right in particular: a place whose subtraction goes negative needs a
 * signed partial, which decision 3 puts in a later integer skill rather than
 * here. Reapplying `exchange: "never"` after the lesson's ranges keeps a
 * widened range from quietly introducing one.
 */
export const specFor = (mode: ChartMode, setup: ChartSetup): DifferenceSpec => ({
  ...DEFAULT_SPEC[mode], ...declared(setup), exchange: "never", excludeEqual: true,
});

const PLACE_LABEL: Record<Place, string> = { hundreds: "H", tens: "T", ones: "O" };

const slotsFor = (mode: ChartMode, value: Difference, places: Place[]): ChartSlot[] => {
  const a = digitsOf(value.minuend);
  const b = digitsOf(value.subtrahend);
  const d = digitsOf(value.difference);

  if (mode === "expanded") {
    const parts = places
      .filter((place) => place !== "ones")
      .map((place) => {
        const unit = place === "hundreds" ? 100 : 10;
        return { key: place, label: `${PLACE_LABEL[place]} part`, lead: `${a[place] * unit} − ${b[place] * unit} =`, answer: (a[place] - b[place]) * unit };
      });
    return [
      ...parts,
      { key: "ones", label: "O part", lead: `${a.ones} − ${b.ones} =`, answer: a.ones - b.ones },
      { key: "total", label: "Total", lead: "added together =", answer: value.difference },
    ];
  }

  if (mode === "check_addition") return [
    { key: "difference", label: "Difference", lead: `${value.minuend} − ${value.subtrahend} =`, answer: value.difference },
    { key: "check", label: "Check", lead: `□ + ${value.subtrahend} =`, answer: value.minuend },
  ];

  if (mode === "left_right") {
    const steps: ChartSlot[] = [];
    let running = value.minuend;
    for (const place of places) {
      const unit = place === "hundreds" ? 100 : place === "tens" ? 10 : 1;
      const chunk = b[place] * unit;
      const before = running;
      running -= chunk;
      steps.push({ key: place, label: `After the ${place}`, lead: `${before} − ${chunk} =`, answer: running });
    }
    return steps;
  }

  return places.map((place) => ({ key: place, label: PLACE_LABEL[place], answer: d[place] }));
};

export const buildQuestion = (setup: ChartSetup, index: number, seen: Set<string>): ChartQuestion => {
  const mode = modeAt<ChartMode>(setup, index, "chart_subtract");
  const value = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  const places: Place[] = value.minuend >= 100 ? ["hundreds", "tens", "ones"] : ["tens", "ones"];
  const slots = slotsFor(mode, value, places);
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_chart_${mode}`,
    mode, ...value, places, slots,
    expected: slots.map((slot) => slot.answer).join(","), itemCount: value.minuend,
  };
};

export const promptFor = (q: ChartQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  if (q.mode === "expanded") return `${q.minuend} minus ${q.subtrahend}. Subtract each part, then put them back together.`;
  if (q.mode === "check_addition") return `${q.minuend} minus ${q.subtrahend}. Solve it, then check it with addition.`;
  if (q.mode === "left_right") return `${q.minuend} minus ${q.subtrahend}. Subtract the biggest place first.`;
  return `${q.minuend} minus ${q.subtrahend}. Fill the answer row of the chart.`;
};

export const printedFor = (q: ChartQuestion): PrintedQuestion => {
  if (q.mode === "expanded") {
    const a = digitsOf(q.minuend);
    const b = digitsOf(q.subtrahend);
    const expand = (d: ReturnType<typeof digitsOf>, value: number) =>
      (value >= 100 ? [d.hundreds * 100, d.tens * 10, d.ones] : [d.tens * 10, d.ones]).join(" + ");
    return { text: `(${expand(a, q.minuend)}) − (${expand(b, q.subtrahend)}) =`, answer: String(q.difference) };
  }
  if (q.mode === "check_addition") return { text: `${q.minuend} − ${q.subtrahend} = □, then □ + ${q.subtrahend} = ${q.minuend}`, answer: String(q.difference) };
  if (q.mode === "left_right") {
    const steps = q.slots.map((slot) => `${slot.lead} □`).join(", then ");
    return { text: steps, answer: String(q.difference) };
  }
  return { text: `Write ${q.minuend} − ${q.subtrahend} in the chart and subtract each column.`, answer: String(q.difference) };
};

export const methodFor = (q: ChartQuestion): string[] => {
  if (q.mode === "expanded") return ["Split both numbers into their places.", "Subtract each place separately.", "Add the parts back together."];
  if (q.mode === "check_addition") return ["Subtract to find the difference.", "Add the difference to the part taken away.", "The check is right only when it rebuilds the whole."];
  if (q.mode === "left_right") return ["Subtract the largest place first.", "Subtract each smaller place from what is left.", "The last total is the difference."];
  return ["Line the digits up by place.", "Subtract each column on its own.", "Read the answer row."];
};

export function chartHints(
  q: ChartQuestion,
  state: { filled: number; kidTip?: string },
): string[] {
  const next = q.slots[Math.min(state.filled, q.slots.length - 1)];
  if (q.mode === "check_addition") return composeHints(
    state.kidTip ?? "Addition undoes subtraction.",
    state.filled === 0
      ? `First find ${q.minuend} minus ${q.subtrahend}.`
      : `Now add your difference to ${q.subtrahend}. It should rebuild ${q.minuend}.`,
    `${q.difference} plus ${q.subtrahend} is ${q.minuend}, so ${q.difference} is right.`,
  );
  if (q.mode === "expanded") return composeHints(
    state.kidTip ?? "Split both numbers by place, then subtract each part.",
    `${state.filled} of ${q.slots.length} boxes are filled. Next: ${next.lead}`,
    `The parts add back to ${q.difference}.`,
  );
  if (q.mode === "left_right") return composeHints(
    state.kidTip ?? "Take the biggest place away first.",
    `${state.filled} of ${q.slots.length} steps are done. Next: ${next.lead}`,
    `Working down the places leaves ${q.difference}.`,
  );
  return composeHints(
    state.kidTip ?? "Subtract one column at a time.",
    `${state.filled} of ${q.slots.length} columns are filled. Each column only uses its own two digits.`,
    `The answer row spells ${q.difference}.`,
  );
}

export const figureFor = (q: ChartQuestion): React.ReactNode => {
  const rows: Array<[string, number]> = [["", q.minuend], ["−", q.subtrahend]];
  return <span className="inline-flex flex-col text-slate-900" role="img" aria-label={`Place value chart for ${q.minuend} minus ${q.subtrahend} with the answer row blank`}>
    <span className="inline-flex">
      <span className="inline-flex h-6 w-6 items-center justify-center text-[9px] uppercase" />
      {q.places.map((place) => <span key={place} className="inline-flex h-6 w-8 items-center justify-center border-x-2 border-t-2 border-slate-900 text-[9px] uppercase">{PLACE_LABEL[place]}</span>)}
    </span>
    {rows.map(([sign, value], row) => <span key={row} className="inline-flex">
      <span className="inline-flex h-8 w-6 items-center justify-center font-bold">{sign}</span>
      {q.places.map((place) => <span key={place} className="inline-flex h-8 w-8 items-center justify-center border-x-2 border-t-2 border-slate-900 font-bold">{digitsOf(value)[place]}</span>)}
    </span>)}
    <span className="inline-flex">
      <span className="inline-flex h-8 w-6 items-center justify-center font-bold">=</span>
      {q.places.map((place) => <span key={place} className="inline-flex h-8 w-8 items-center justify-center border-2 border-slate-900" />)}
    </span>
  </span>;
};

const ChartRow: React.FC<{ sign: string; value: number; places: Place[]; tone: typeof WHOLE }> = ({ sign, value, places, tone }) => (
  <div className="flex items-center justify-center gap-1.5">
    <span className="w-6 text-right text-xl font-black text-ink/40">{sign}</span>
    {places.map((place) => <span key={place}
      className={`${DIGIT_CELL} rounded-xl border-2 ${tone.soft} ${tone.border} flex items-center justify-center text-2xl font-black tabular-nums ${tone.text}`}>
      {digitsOf(value)[place]}
    </span>)}
  </div>
);

export const PlaceValueDesk: React.FC<ActivityProps<PlaceValueDeskParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: ChartSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 28,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as ChartQuestion;

  useEffect(() => { setEntries({}); nudge.clear(); }, [q.id, nudge.clear]);

  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const filled = q.slots.filter((slot) => (entries[slot.key] ?? "") !== "").length;
  const chart = q.mode === "chart_subtract" || q.mode === "chart_three";

  const check = () => {
    if (filled < q.slots.length) {
      nudge.refuse(`${q.slots.length - filled} ${q.slots.length - filled === 1 ? "box is" : "boxes are"} still empty.`);
      return;
    }
    const given = q.slots.map((slot) => entries[slot.key]).join(",");
    const correct = given === q.expected;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    // A column filled with the right digit in the wrong place is a place-value
    // slip, not a random miss, and the analyzer should be able to tell them apart.
    const wrongPlaces = q.slots.filter((slot) => entries[slot.key] !== String(slot.answer));
    round.submit({
      correct, given, expected: q.expected,
      errorKind: correct ? undefined : chart && wrongPlaces.length < q.slots.length ? "place_value" : "off_by_more",
      title: correct ? "Every place agrees!" : "Check each place again",
      message: practising ? undefined : `${q.minuend} minus ${q.subtrahend} is ${q.difference}.`,
    });
  };

  const box = (slot: typeof q.slots[number]) => <input key={slot.key} inputMode="numeric" pattern="[0-9]*"
    value={entries[slot.key] ?? ""} disabled={Boolean(round.feedback)}
    onChange={(event) => setEntries((current) => ({ ...current, [slot.key]: event.target.value.replace(/[^0-9]/g, "").slice(0, 3) }))}
    aria-label={slot.label} className={themeSystem.field("md", "w-full text-center text-2xl font-black tabular-nums")} />;

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Place Value Desk" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="layers" iconTone="indigo"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : chartHints(q, { filled, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6 space-y-3`}>
        {chart ? <>
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-6" />
            {q.places.map((place) => <span key={place} className={`${DIGIT_CELL} flex items-center justify-center text-[11px] font-bold uppercase tracking-wide text-ink/55`}>{PLACE_LABEL[place]}</span>)}
          </div>
          <ChartRow sign="" value={q.minuend} places={q.places} tone={WHOLE} />
          <ChartRow sign="−" value={q.subtrahend} places={q.places} tone={REMOVED_PART} />
          <div className="flex items-center justify-center gap-1.5 pt-1 border-t-4 border-ink/20 mx-auto max-w-xs">
            <span className="w-6 text-right text-xl font-black text-ink/40">=</span>
            {q.slots.map((slot) => <span key={slot.key} className={`${DIGIT_CELL} shrink-0`}>{box(slot)}</span>)}
          </div>
        </> : <>
          <div className={`text-center text-3xl font-black tabular-nums ${WHOLE.text}`}>
            {q.minuend}<span className="text-ink/30"> − </span><span className={REMOVED_PART.text}>{q.subtrahend}</span>
          </div>
          <div className="space-y-2.5 mx-auto max-w-sm">
            {q.slots.map((slot) => <label key={slot.key} className="flex items-center justify-end gap-2 text-lg font-black tabular-nums text-ink">
              <span className="whitespace-nowrap">{slot.lead}</span>
              <span className="w-24 shrink-0">{box(slot)}</span>
            </label>)}
          </div>
        </>}
        {scaffold && !practising && <div className={`text-center text-sm font-bold ${filled === q.slots.length ? DIFFERENCE.text : "text-ink/60"}`}>
          {q.mode === "check_addition"
            ? filled === 0 ? "Subtract first, then check it." : `Your check must rebuild ${q.minuend}.`
            : q.mode === "left_right" ? "Biggest place first, then work down."
              : q.mode === "expanded" ? "Each place is subtracted on its own."
                : "Each column uses only its own two digits."}
        </div>}
      </div>
      {q.mode === "check_addition" && <div className={`text-center text-sm font-bold ${COMPARISON.text}`}>The subtraction stays on screen so the check has something to rebuild.</div>}
      <div className="flex justify-center"><button type="button" onClick={check} className={themeSystem.button("primary", "lg")}>Check</button></div>
    </div>
  </SkillRound>;
};
