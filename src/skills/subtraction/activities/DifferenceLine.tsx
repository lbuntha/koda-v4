import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { SCENE } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, digitsOf, drawConstantDifference, drawDifference, numberWord,
  shuffle, withoutRepeat, type ConstantDifference, type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";

export type LineMode =
  | "path_back"
  | "open_back"
  | "count_up"
  | "bridge_ten"
  | "bridge_hundred"
  | "compensate_subtrahend"
  | "constant_difference"
  | "jump_tens_ones";

export interface LineSetup extends PracticeSetup {
  mode?: LineMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  questionsPerRound?: number;
}

export interface DifferenceLineParams extends LineSetup { question?: LineSetup }

export interface LineQuestion extends RoundQuestion {
  mode: LineMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  from: number;
  min: number;
  max: number;
  /** Zero makes an open line. */
  ticks: number;
  /** Signed jumps: negative goes back, positive goes forward. */
  required: number[];
  offered: number[];
  ordered: boolean;
  offset?: number;
  adjustedMinuend?: number;
  adjustedSubtrahend?: number;
}

const DEFAULT_SPEC: Record<LineMode, DifferenceSpec> = {
  path_back: { minuendRange: [3, 20], subtrahendRange: [1, 9] },
  open_back: { minuendRange: [20, 100], subtrahendRange: [2, 29] },
  count_up: { minuendRange: [10, 100], subtrahendRange: [1, 99], differenceRange: [1, 10], smallDifference: true, excludeEqual: true },
  bridge_ten: { minuendRange: [11, 19], subtrahendRange: [2, 9], differenceRange: [1, 9], crossBoundary: 10 },
  bridge_hundred: { minuendRange: [101, 199], subtrahendRange: [2, 99], differenceRange: [2, 99], crossBoundary: 100 },
  compensate_subtrahend: { minuendRange: [30, 99], subtrahendRange: [18, 79], subtrahendEndsIn: [8, 9], excludeEqual: true },
  constant_difference: { minuendRange: [30, 99], subtrahendRange: [11, 79], excludeEqual: true },
  jump_tens_ones: { minuendRange: [20, 99], subtrahendRange: [10, 88], exchange: "never", excludeEqual: true },
};

const declared = (setup: LineSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) out.differenceRange = setup.differenceRange;
  return out;
};

export const specFor = (mode: LineMode, setup: LineSetup): DifferenceSpec => {
  const spec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  if (mode === "count_up") { spec.smallDifference = true; spec.excludeEqual = true; }
  if (mode === "bridge_ten") spec.crossBoundary = 10;
  if (mode === "bridge_hundred") spec.crossBoundary = 100;
  if (mode === "compensate_subtrahend") spec.subtrahendEndsIn = [8, 9];
  if (mode === "jump_tens_ones") { spec.exchange = "never"; spec.excludeEqual = true; }
  return spec;
};

const bounds = (points: number[], pad: number): [number, number] => [
  Math.max(0, Math.min(...points) - pad), Math.max(...points) + pad,
];

export const buildQuestion = (setup: LineSetup, index: number, seen: Set<string>): LineQuestion => {
  const mode = modeAt<LineMode>(setup, index, "path_back");
  const baseId = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_line_${mode}`, mode };

  if (mode === "constant_difference") {
    const drawn = withoutRepeat<ConstantDifference>(
      () => drawConstantDifference(specFor(mode, setup), 10), differenceKey, seen,
    );
    const required = [drawn.offset, -drawn.adjustedSubtrahend];
    const [min, max] = bounds([drawn.minuend, drawn.adjustedMinuend, drawn.difference], 5);
    return { ...baseId, ...drawn, from: drawn.minuend, min, max, ticks: 0, required,
      offered: required, ordered: true, expected: String(drawn.difference), itemCount: drawn.minuend };
  }

  const drawn = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  let from = drawn.minuend;
  let ticks = 0;
  let required: number[];
  let ordered = true;

  switch (mode) {
    case "path_back":
      required = Array.from({ length: drawn.subtrahend }, () => -1);
      ticks = 1;
      break;
    case "count_up":
      from = drawn.subtrahend;
      required = Array.from({ length: drawn.difference }, () => 1);
      ticks = 1;
      break;
    case "bridge_ten": {
      const first = drawn.minuend - 10;
      required = [-first, -(drawn.subtrahend - first)].filter((step) => step !== 0);
      ticks = 10;
      break;
    }
    case "bridge_hundred": {
      const first = drawn.minuend - 100;
      required = [-first, -(drawn.subtrahend - first)].filter((step) => step !== 0);
      ticks = 100;
      break;
    }
    case "compensate_subtrahend": {
      const rounded = Math.ceil(drawn.subtrahend / 10) * 10;
      required = [-rounded, rounded - drawn.subtrahend];
      break;
    }
    case "jump_tens_ones": {
      const d = digitsOf(drawn.subtrahend);
      required = [-d.tens * 10, -d.ones].filter((step) => step !== 0);
      ordered = false;
      break;
    }
    default:
      required = [-drawn.subtrahend];
  }

  const points = [from];
  let position = from;
  for (const step of required) { position += step; points.push(position); }
  const unit = ticks === 1 ? 1 : 5;
  const [boundedMin, boundedMax] = bounds(points, unit);
  const [min, max] = mode === "bridge_ten" ? [0, 20]
    : mode === "bridge_hundred" ? [0, 200]
      : [boundedMin, boundedMax];
  return { ...baseId, ...drawn, from, min, max, ticks, required,
    offered: shuffle([...new Set(required)]), ordered,
    expected: String(drawn.difference), itemCount: drawn.minuend };
};

export const promptFor = (q: LineQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  switch (q.mode) {
    case "open_back": return `Start at ${q.minuend}. Jump back ${q.subtrahend}. Where do you land?`;
    case "count_up": return `Start at ${q.subtrahend}. Count up to ${q.minuend}. How big is the difference?`;
    case "bridge_ten": return `${q.minuend} minus ${q.subtrahend}. Jump back through ten.`;
    case "bridge_hundred": return `${q.minuend} minus ${q.subtrahend}. Jump back through one hundred.`;
    case "compensate_subtrahend": return `${q.minuend} minus ${q.subtrahend}. Subtract a friendly ten, then adjust.`;
    case "constant_difference": return `${q.minuend} minus ${q.subtrahend}. Shift both numbers to keep the same difference.`;
    case "jump_tens_ones": return `${q.minuend} minus ${q.subtrahend}. Jump back the tens and the ones.`;
    default: return `Start at ${q.minuend} and move back ${q.subtrahend}.`;
  }
};

export const printedFor = (q: LineQuestion): PrintedQuestion => ({
  text: q.mode === "count_up"
    ? `Count up from ${q.subtrahend} to ${q.minuend}. What is the difference?`
    : q.mode === "constant_difference"
      ? `Shift both operands by ${q.offset}: ${q.minuend} − ${q.subtrahend} =`
      : `${q.minuend} − ${q.subtrahend} =`,
  answer: String(q.difference),
});

export const methodFor = (q: LineQuestion): string[] => {
  switch (q.mode) {
    case "count_up": return ["Start at the smaller number.", "Count forward until the larger number.", "The distance travelled is the difference."];
    case "bridge_ten": return ["Jump back to ten first.", "Subtract the rest of the subtrahend.", "Read where you land."];
    case "bridge_hundred": return ["Jump back to one hundred first.", "Subtract the remaining part.", "Read where you land."];
    case "compensate_subtrahend": return ["Round the subtrahend up to the next ten.", "Subtract that friendly number.", "Add back the one or two extra you subtracted."];
    case "constant_difference": return ["Add the same offset to both operands.", "The distance between them stays equal.", "Subtract the new friendly pair."];
    case "jump_tens_ones": return ["Split the subtrahend into tens and ones.", "Jump both parts backward.", "Either order reaches the same difference."];
    default: return ["Start at the minuend.", "Make backward jumps for the subtrahend.", "Where you land is the difference."];
  }
};

export function lineHints(q: LineQuestion, state: { at: number; made: number[]; kidTip?: string }): string[] {
  const next = q.required[state.made.length];
  switch (q.mode) {
    case "count_up":
      return composeHints(state.kidTip ?? "Count the distance, not the number you land on.", `You are at ${state.at}. You have counted up ${state.made.length} of ${q.difference}.`, `From ${q.subtrahend} to ${q.minuend} is a distance of ${q.difference}.`);
    case "bridge_ten":
    case "bridge_hundred": {
      const boundary = q.mode === "bridge_ten" ? 10 : 100;
      return composeHints(state.kidTip ?? `Land exactly on ${boundary} before continuing.`, state.made.length === 0 ? `The first jump is from ${q.minuend} back to ${boundary}.` : `You reached ${boundary}. Now subtract the part still left.`, `${q.minuend} minus ${q.subtrahend} lands on ${q.difference}.`);
    }
    case "compensate_subtrahend": {
      const rounded = Math.ceil(q.subtrahend / 10) * 10;
      return composeHints(state.kidTip ?? "Subtract a little too much, then add that little bit back.", state.made.length === 0 ? `${q.subtrahend} is close to ${rounded}. Subtract ${rounded} first.` : `You subtracted ${rounded}, which was ${rounded - q.subtrahend} too much. Add it back.`, `${q.minuend} minus ${rounded}, then plus ${rounded - q.subtrahend}, is ${q.difference}.`);
    }
    case "constant_difference":
      return composeHints(state.kidTip ?? "Move both numbers by the same amount; the gap does not change.", state.made.length === 0 ? `Add ${q.offset} to both ${q.minuend} and ${q.subtrahend}.` : `Now subtract the friendly pair ${q.adjustedMinuend} minus ${q.adjustedSubtrahend}.`, `Both pairs have the same difference, ${q.difference}.`);
    case "jump_tens_ones":
      return composeHints(state.kidTip ?? "Split the number being subtracted into tens and ones.", `You are at ${state.at}. ${next === undefined ? "Both parts are done." : `A jump of ${Math.abs(next)} is still available.`}`, `${q.subtrahend} is ${digitsOf(q.subtrahend).tens * 10} and ${digitsOf(q.subtrahend).ones}.`);
    default:
      return composeHints(state.kidTip ?? "Backward jumps make the number smaller.", state.made.length === 0 ? `Start at ${q.from}. The first jump goes left.` : `You are at ${state.at}. ${q.required.length - state.made.length} jumps remain.`, `${q.minuend} minus ${q.subtrahend} lands on ${q.difference}.`);
  }
}

export const figureFor = (q: LineQuestion): React.ReactNode => {
  const width = 320;
  const span = Math.max(1, q.max - q.min);
  const x = (value: number) => ((value - q.min) / span) * width;
  const regularMarks = q.ticks > 0
    ? Array.from({ length: Math.floor(span / q.ticks) + 1 }, (_, i) => q.min + i * q.ticks).filter((v) => v <= q.max)
    : [q.from];
  const marks = [...new Set([...regularMarks, q.from])].sort((a, b) => a - b);
  const pad = Math.max(14, Math.max(...marks.map((m) => String(m).length)) * 4);
  return <svg viewBox={`${-pad} 0 ${width + pad * 2} 36`} width={width + pad * 2} height="36" role="img"
    aria-label={`Subtraction number line starting at ${q.from}`} className="text-slate-900">
    <defs><marker id={`print-arrow-${q.id}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="currentColor" /></marker></defs>
    <line x1="0" y1="13" x2={width} y2="13" stroke="currentColor" strokeWidth="1.5" />
    {marks.map((value) => <g key={value}><line x1={x(value)} y1="8" x2={x(value)} y2="18" stroke="currentColor" strokeWidth={value === q.from ? 2.5 : 1} /><text x={x(value)} y="31" textAnchor="middle" fontSize="10" fill="currentColor">{value}</text></g>)}
  </svg>;
};

const choicesFor = (answer: number) => Array.from({ length: 4 }, (_, i) => Math.max(0, answer - 2) + i);
const WIDTH = 1000;
const BASE = 112;
/**
 * Room for the labels the line hangs off its own ends.
 *
 * Endpoint labels are centred on x=0 and x=WIDTH, so without padding the
 * viewBox each one loses its outer half to the scene's `overflow-hidden` —
 * bridge-through-100 printed ")" and "2C" for 0 and 200 at 360px. The printed
 * figure already pads for the same reason.
 */
const LABEL_PAD = 34;
const LABEL_ROW = BASE + 39;
const SECOND_ROW = LABEL_ROW + 28;
/** Closer than this and two labels sit on top of each other, as 100 and 104 did. */
const LABEL_GAP = 44;

/**
 * The arrowhead, drawn twice.
 *
 * A marker paints in its own context, so `currentColor` inside one resolves
 * against the `<defs>` rather than the arc that referenced it: every head came
 * out ink-coloured, reading as a separate object from its own arc. And at the
 * default `markerUnits="strokeWidth"` a 9-unit head becomes 45 units against a
 * 5-wide stroke, which on bridge-through-100 was wider than the eight-unit jump
 * it terminated. One marker per direction, sized in user space, fixes both.
 */
const ArrowMarkers: React.FC<{ id: string }> = ({ id }) => <defs>
  {([["back", "fill-rose-500"], ["forward", "fill-sky-500"]] as const).map(([way, fill]) => (
    <marker key={way} id={`${id}-${way}`} markerUnits="userSpaceOnUse"
      markerWidth="22" markerHeight="22" refX="17" refY="11" orient="auto">
      <path d="M0,0 L22,11 L0,22 z" className={fill} />
    </marker>
  ))}
</defs>;

/** Clear of a 22-unit arrowhead sitting on the baseline. */
const LABEL_LIFT = 36;

const Arc: React.FC<{ x1: number; x2: number; step: number; id: string }> = ({ x1, x2, step, id }) => {
  const back = step < 0;
  const mid = (x1 + x2) / 2;
  const lift = Math.min(62, Math.max(28, Math.abs(x2 - x1) * 0.42));
  return <g>
    <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }}
      d={`M ${x1} ${BASE} Q ${mid} ${BASE - lift} ${x2} ${BASE}`} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
      markerEnd={`url(#${id}-${back ? "back" : "forward"})`} className={back ? "text-rose-500" : "text-sky-500"} />
    <text x={mid} y={BASE - Math.max(lift * 0.7, LABEL_LIFT)} textAnchor="middle" className={`text-[27px] font-black ${back ? "fill-rose-600" : "fill-sky-600"}`}>{back ? "−" : "+"}{Math.abs(step)}</text>
  </g>;
};

export const DifferenceLine: React.FC<ActivityProps<DifferenceLineParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: LineSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [at, setAt] = useState(0);
  const [made, setMade] = useState<number[]>([]);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 14,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as LineQuestion;
  useEffect(() => { setAt(q.from); setMade([]); nudge.clear(); }, [q.id, q.from, nudge.clear]);
  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const showsDifference = koda.config.isEnabled("running_difference_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const x = (value: number) => ((value - q.min) / Math.max(1, q.max - q.min)) * WIDTH;
  const consumed = (step: number) => made.filter((madeStep) => madeStep === step).length;
  const allowedCount = (step: number) => q.required.filter((required) => required === step).length;
  const complete = made.length === q.required.length;
  const jump = (step: number) => {
    if (round.feedback || complete) return;
    const expectedNext = q.required[made.length];
    if (q.ordered && step !== expectedNext) {
      const boundary = q.mode === "bridge_ten" ? 10 : q.mode === "bridge_hundred" ? 100 : undefined;
      nudge.refuse(boundary ? `Land on ${boundary} first. Take the ${Math.abs(expectedNext)} jump.` : `Take the ${expectedNext < 0 ? "backward" : "forward"} ${Math.abs(expectedNext)} move first.`);
      return;
    }
    if (!q.ordered && consumed(step) >= allowedCount(step)) return;
    const next = at + step;
    setAt(next);
    setMade((current) => [...current, step]);
    chime(koda, step < 0 ? "changed" : "moved");
    koda.haptics.tap();
    if (speaks) void koda.speech.say(numberWord(next), speechRate(koda));
    if (q.mode === "path_back" && made.length + 1 === q.required.length) {
      chime(koda, "reached");
      koda.haptics.success();
      round.submit({ correct: true, given: String(q.difference), expected: q.expected, title: "You landed on the difference!", message: `${q.minuend} minus ${q.subtrahend} is ${q.difference}.` });
    }
  };
  const choose = (value: number) => {
    const correct = value === q.difference;
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({ correct, given: String(value), expected: q.expected, errorKind: correct ? undefined : "off_by_more",
      title: correct ? "That is the difference!" : "Check the distance",
      message: practising ? undefined : `${q.minuend} minus ${q.subtrahend} is ${q.difference}.` });
  };
  const undo = () => {
    const last = made.at(-1);
    if (last === undefined || round.feedback) return;
    setAt((value) => value - last);
    setMade((current) => current.slice(0, -1));
    chime(koda, "undone");
    koda.haptics.tap();
  };
  const prompt = promptFor(q, copy.prompts?.default);
  const regularTicks = q.ticks > 0 ? Array.from({ length: Math.floor((q.max - q.min) / q.ticks) + 1 }, (_, i) => q.min + i * q.ticks).filter((value) => value <= q.max) : [];
  const tickValues = q.ticks > 0 ? [...new Set([...regularTicks, q.from])].sort((a, b) => a - b) : [];
  let travelled = q.from;
  const arrowId = `line-arrow-${q.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // The start always keeps its label; a landmark tick sitting almost on top of
  // it — 100 beside a start of 104 — pushes the start onto a second row.
  const crowded = tickValues.some((value) => value !== q.from && Math.abs(x(value) - x(q.from)) < LABEL_GAP);
  const labelY = (value: number) => (crowded && value === q.from ? SECOND_ROW : LABEL_ROW);

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Subtraction Number Lines" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="footprints" iconTone="cyan"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : lineHints(q, { at, made, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-3 sm:p-6 overflow-hidden`}>
        {q.mode === "constant_difference" && scaffold && !practising && <div className="mb-2 text-center text-sm font-bold text-ink/60 tabular-nums">{q.minuend} − {q.subtrahend} = {q.adjustedMinuend} − {q.adjustedSubtrahend}</div>}
        <svg viewBox={`${-LABEL_PAD} 0 ${WIDTH + LABEL_PAD * 2} ${(crowded ? SECOND_ROW : LABEL_ROW) + 12}`} className="w-full h-auto" role="img" aria-label={`Number line starting at ${q.from}`}>
          <ArrowMarkers id={arrowId} />
          <line x1="0" y1={BASE} x2={WIDTH} y2={BASE} stroke="currentColor" strokeWidth="4" className="text-ink/25" />
          {tickValues.map((value) => <g key={value}><line x1={x(value)} y1={BASE - 9} x2={x(value)} y2={BASE + 9} stroke="currentColor" strokeWidth="3" className="text-ink/30" /><text x={x(value)} y={labelY(value)} textAnchor="middle" className="text-[23px] font-bold fill-current text-ink/60">{value}</text></g>)}
          {q.ticks === 0 && <g><line x1={x(q.from)} y1={BASE - 10} x2={x(q.from)} y2={BASE + 10} stroke="currentColor" strokeWidth="4" className="text-ink/40" /><text x={x(q.from)} y={LABEL_ROW} textAnchor="middle" className="text-[24px] font-bold fill-current text-ink/60">{q.from}</text></g>}
          {made.map((step, i) => { const start = travelled; travelled += step; return <Arc key={i} x1={x(start)} x2={x(travelled)} step={step} id={arrowId} />; })}
          <motion.circle animate={{ cx: x(at) }} transition={SPRING.enter} cy={BASE} r="14" className="fill-emerald-500" />
        </svg>
        {showsDifference && <div aria-live="polite" className={`text-center text-2xl font-black tabular-nums ${q.mode === "count_up" ? COMPARISON.text : DIFFERENCE.text}`}>{q.mode === "count_up" ? made.length : at}<span className="ml-2 text-[10px] uppercase text-ink/50">{q.mode === "count_up" ? "distance" : "current"}</span></div>}
        {scaffold && !practising && made.length > 0 && <div className="mt-1 text-center text-sm font-bold text-ink/60">{made.map((step) => `${step < 0 ? "back" : "forward"} ${Math.abs(step)}`).join(" · ")}</div>}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {q.offered.map((step, i) => {
          const spent = consumed(step);
          const unavailable = spent >= allowedCount(step) || Boolean(round.feedback);
          const shift = q.mode === "constant_difference" && i === 0;
          return <motion.button key={`${step}-${i}`} type="button" onClick={() => jump(step)} disabled={unavailable}
            className={themeSystem.button(step < 0 ? "secondary" : "primary", "lg")} whileTap={{ scale: 0.9 }}>
            {shift ? `Shift both by ${step}` : `${step < 0 ? "Jump back" : "Jump forward"} ${Math.abs(step)}`}
          </motion.button>;
        })}
      </div>
      {made.length > 0 && !round.feedback && <div className="flex justify-center"><button type="button" onClick={undo} className={themeSystem.button("ghost", "sm")}>Undo last jump</button></div>}
      {complete && q.mode !== "path_back" && <div className="flex flex-wrap justify-center gap-2.5">{choicesFor(q.difference).map((value) => <button key={value} type="button" onClick={() => choose(value)} disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}</div>}
    </div>
  </SkillRound>;
};
