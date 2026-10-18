import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, guideSetup, useGuide, type PracticeSetup, type RoundQuestion,
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
import { ts } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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

/** "H", "T", "O", in the language on screen. */
const placeLabel = (place: Place): string => ts(`place.${place}Short`);

const slotsFor = (mode: ChartMode, value: Difference, places: Place[]): ChartSlot[] => {
  const a = digitsOf(value.minuend);
  const b = digitsOf(value.subtrahend);
  const d = digitsOf(value.difference);

  if (mode === "expanded") {
    const parts = places
      .filter((place) => place !== "ones")
      .map((place) => {
        const unit = place === "hundreds" ? 100 : 10;
        return { key: place, label: ts("desk.part", { place: placeLabel(place) }), lead: `${a[place] * unit} − ${b[place] * unit} =`, answer: (a[place] - b[place]) * unit };
      });
    return [
      ...parts,
      { key: "ones", label: ts("desk.part", { place: placeLabel("ones") }), lead: `${a.ones} − ${b.ones} =`, answer: a.ones - b.ones },
      { key: "total", label: ts("desk.total"), lead: ts("desk.addedTogether"), answer: value.difference },
    ];
  }

  if (mode === "check_addition") return [
    { key: "difference", label: ts("desk.difference"), lead: `${value.minuend} − ${value.subtrahend} =`, answer: value.difference },
    { key: "check", label: ts("check"), lead: `□ + ${value.subtrahend} =`, answer: value.minuend },
  ];

  if (mode === "left_right") {
    const steps: ChartSlot[] = [];
    let running = value.minuend;
    for (const place of places) {
      const unit = place === "hundreds" ? 100 : place === "tens" ? 10 : 1;
      const chunk = b[place] * unit;
      const before = running;
      running -= chunk;
      steps.push({ key: place, label: ts(`desk.after.${place}`), lead: `${before} − ${chunk} =`, answer: running });
    }
    return steps;
  }

  return places.map((place) => ({ key: place, label: placeLabel(place), answer: d[place] }));
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
  if (q.mode === "expanded") return ts("desk.promptExpanded", { a: q.minuend, b: q.subtrahend });
  if (q.mode === "check_addition") return ts("desk.promptCheck", { a: q.minuend, b: q.subtrahend });
  if (q.mode === "left_right") return ts("desk.promptLeftRight", { a: q.minuend, b: q.subtrahend });
  return ts("desk.prompt", { a: q.minuend, b: q.subtrahend });
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
    const steps = q.slots.map((slot) => `${slot.lead} □`).join(ts("desk.then"));
    return { text: steps, answer: String(q.difference) };
  }
  return { text: ts("desk.printed", { a: q.minuend, b: q.subtrahend }), answer: String(q.difference) };
};

export const methodFor = (q: ChartQuestion): string[] => {
  if (q.mode === "expanded") return [ts("desk.methodExpanded1"), ts("desk.methodExpanded2"), ts("desk.methodExpanded3")];
  if (q.mode === "check_addition") return [ts("desk.methodCheck1"), ts("desk.methodCheck2"), ts("desk.methodCheck3")];
  if (q.mode === "left_right") return [ts("desk.methodLeftRight1"), ts("desk.methodLeftRight2"), ts("desk.methodLeftRight3")];
  return [ts("desk.method1"), ts("desk.method2"), ts("desk.method3")];
};

export function chartHints(
  q: ChartQuestion,
  state: { filled: number; kidTip?: string },
): string[] {
  const next = q.slots[Math.min(state.filled, q.slots.length - 1)];
  if (q.mode === "check_addition") return composeHints(
    state.kidTip ?? ts("desk.hintCheckTip"),
    state.filled === 0
      ? ts("desk.hintFirstFind", { a: q.minuend, b: q.subtrahend })
      : ts("desk.hintNowAdd", { b: q.subtrahend, a: q.minuend }),
    ts("desk.hintRebuilds", { difference: q.difference, b: q.subtrahend, a: q.minuend }),
  );
  if (q.mode === "expanded") return composeHints(
    state.kidTip ?? ts("desk.hintExpandedTip"),
    ts("desk.hintBoxesNext", { filled: state.filled, total: q.slots.length, next: next.lead ?? "" }),
    ts("desk.hintPartsAdd", { difference: q.difference }),
  );
  if (q.mode === "left_right") return composeHints(
    state.kidTip ?? ts("desk.hintLeftRightTip"),
    ts("desk.hintStepsNext", { filled: state.filled, total: q.slots.length, next: next.lead ?? "" }),
    ts("desk.hintWorkingDown", { difference: q.difference }),
  );
  return composeHints(
    state.kidTip ?? ts("desk.hintTip"),
    ts("desk.hintColumns", { filled: state.filled, total: q.slots.length }),
    ts("desk.hintSpells", { difference: q.difference }),
  );
}

export const figureFor = (q: ChartQuestion): React.ReactNode => {
  const rows: Array<[string, number]> = [["", q.minuend], ["−", q.subtrahend]];
  return <span className="inline-flex flex-col text-slate-900" role="img" aria-label={ts("desk.figure", { a: q.minuend, b: q.subtrahend })}>
    <span className="inline-flex">
      <span className="inline-flex h-6 w-6 items-center justify-center text-[9px] uppercase" />
      {q.places.map((place) => <span key={place} className="inline-flex h-6 w-8 items-center justify-center border-x-2 border-t-2 border-slate-900 text-[9px] uppercase">{placeLabel(place)}</span>)}
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
  // Re-render when the language changes: every line below reads the catalog.
  useT();
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

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setEntries({});
    nudge.clear();
  };


  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const filled = q.slots.filter((slot) => (entries[slot.key] ?? "") !== "").length;
  const chart = q.mode === "chart_subtract" || q.mode === "chart_three";

  const check = () => {
    if (filled < q.slots.length) {
      nudge.refuse(ts("desk.refuseEmpty", { count: q.slots.length - filled }));
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
      title: correct ? ts("desk.rightTitle") : ts("desk.wrongTitle"),
      message: practising ? undefined : ts("aMinusBIs", { a: q.minuend, b: q.subtrahend, difference: q.difference }),
    });
  };

  const box = (slot: typeof q.slots[number]) => <input key={slot.key} inputMode="numeric" pattern="[0-9]*"
    value={entries[slot.key] ?? ""} disabled={Boolean(round.feedback)}
    onChange={(event) => setEntries((current) => ({ ...current, [slot.key]: event.target.value.replace(/[^0-9]/g, "").slice(0, 3) }))}
    aria-label={q.slots.indexOf(slot) === guide.target ? ts("desk.fillNext", { label: slot.label }) : slot.label}
    className={themeSystem.field("md", `w-full text-center text-2xl font-black tabular-nums${
      q.slots.indexOf(slot) === guide.target ? " ring-4 ring-indigo-500" : ""
    }`)} />;

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : chartHints(q, { filled, kidTip: copy.kidTip });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: q.id,
    rungs: hints,
    /* The next empty box, in the order the chart reads. */
    target: q.slots.findIndex((slot) => (entries[slot.key] ?? "") === ""),
    progress: filled,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle={ts("desk.title")} round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="layers" iconTone="indigo"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={hints}
    guide={practising ? undefined : guide}
    guideMethod={copy.stepByStep}
    onStartOver={
      !round.feedback && (Object.values(entries).some((v) => v !== "")) ? restart : undefined
    }
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6 space-y-3`}>
        {chart ? <>
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-6" />
            {q.places.map((place) => <span key={place} className={`${DIGIT_CELL} flex items-center justify-center text-[11px] font-bold uppercase tracking-wide text-ink/55`}>{placeLabel(place)}</span>)}
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
            ? filled === 0 ? ts("desk.helpCheckFirst") : ts("desk.helpRebuild", { a: q.minuend })
            : q.mode === "left_right" ? ts("desk.helpLeftRight")
              : q.mode === "expanded" ? ts("desk.helpExpanded")
                : ts("desk.help")}
        </div>}
      </div>
      {q.mode === "check_addition" && <div className={`text-center text-sm font-bold ${COMPARISON.text}`}>{ts("desk.helpStays")}</div>}
      <div className="flex justify-center"><button type="button" onClick={check} className={themeSystem.button("primary", "lg")}>{ts("check")}</button></div>
    </div>
  </SkillRound>;
};
