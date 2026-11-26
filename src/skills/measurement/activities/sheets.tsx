import type { PrintedQuestion, WorksheetSource } from "../../types";
import { tx } from "../internal/i18n";
import { quartersText } from "../internal/ruler";
import { stepsOf } from "../internal/scale";
import { degText } from "../internal/thermo";
import { ESTIMATE_THINGS } from "../internal/estimate";
import { forRegion } from "../internal/regionModes";
import { needleAngle, dialLabel } from "./dials";
import { amountText, buildRulerQuestion, type RulerRoundQuestion } from "./RulerDesk";
import { buildScaleQuestion, type ScaleRoundQuestion } from "./DialScale";
import { buildThermoQuestion, type ThermoRoundQuestion } from "./Thermometer";
import { buildCapacityQuestion, usName, type CapacityRoundQuestion } from "./PourLab";
import { buildStoryQuestion, type StoryRoundQuestion } from "./MeasureStory";
import { buildEstimateQuestion, unitSymbol, type EstimateRoundQuestion } from "./EstimateCards";

/**
 * Measure It on paper (SKILL_DEVELOPMENT §11.1).
 *
 * The instrument is the question, so most sheets carry a figure: the ruler with
 * the thing laid on it, the dial with its needle, the thermometer, the jug. They
 * are redrawn here in black lines for a printer, not reused from the round.
 * Only the reading is left blank. Modes whose subject is a thing to touch
 * (comparing, pouring into cups, placing on the ruler) return `null` and are
 * not printed.
 *
 * The printer counts questions from 0; every round here counts from 1, which
 * picks the step sizes that get harder through a round. Hence `i + 1`.
 *
 * The printer is not told the learner's region. A practice sheet mixes a whole
 * stage, so it prints only the modes every region is taught: no pounds, cups or
 * °F on a sheet that may be printed in Phnom Penh. (US-only teaching lessons are
 * hidden outside the US already, so their own sheets are safe.)
 */
const shared = (params: Record<string, unknown>) => forRegion({ question: params as { modes?: string[] } }, "INTL").question;

const INK = "black";
/** The sheet draws its own answer line beside every question, so the text needs no blank of its own. */
const blank = (prompt: string) => prompt;
const method = (key: string, n = 2) => Array.from({ length: n }, (_, i) => tx(`sheet.method.${key}.${i}`));
const font = { fontFamily: "system-ui, sans-serif", fill: INK } as const;

/* ------------------------------------------------------------------ ruler */

export function PrintRuler({ q }: { q: RulerRoundQuestion["q"] }) {
  const { ruler } = q;
  const u = Math.min(34, 500 / ruler.span);
  const pad = 16;
  const w = pad * 2 + ruler.span * u;
  const x = (step: number) => pad + (step / ruler.sub) * u;
  const bars = [{ from: q.from, steps: q.steps }, ...(q.other ? [{ from: 0, steps: q.other.steps }] : [])];
  const top = 8 + bars.length * 20;
  return (
    <svg viewBox={`0 0 ${w} ${top + 50}`} width="100%" style={{ maxWidth: w }} role="img" aria-label="ruler">
      {bars.map((b, i) => (
        <rect key={i} x={x(b.from)} y={8 + i * 20} width={x(b.from + b.steps) - x(b.from)} height="14" fill="white" stroke={INK} strokeWidth="1.5" />
      ))}
      <rect x={pad - 8} y={top} width={ruler.span * u + 16} height="44" fill="white" stroke={INK} strokeWidth="1.5" />
      {Array.from({ length: ruler.span * ruler.sub + 1 }, (_, s) => {
        const whole = s % ruler.sub === 0;
        const half = ruler.sub === 10 && s % 5 === 0;
        return <line key={s} x1={x(s)} x2={x(s)} y1={top} y2={top + (whole ? 16 : half ? 11 : 7)} stroke={INK} strokeWidth={whole ? 1.4 : 0.8} />;
      })}
      {Array.from({ length: ruler.span + 1 }, (_, n) => (
        <text key={n} x={x(n * ruler.sub)} y={top + 30} textAnchor="middle" fontSize="11" style={font}>
          {ruler.start + n}
        </text>
      ))}
      <text x={w - pad} y={top + 42} textAnchor="end" fontSize="9" style={font}>
        {ruler.unit === "mm" ? "cm" : ruler.unit}
      </text>
    </svg>
  );
}

const rulerSheet: WorksheetSource = {
  build: (params, i, seen) => buildRulerQuestion(shared(params) as never, i + 1, seen),
  prompt: (question: RulerRoundQuestion) => question.prompt ?? "",
  printed: (question: RulerRoundQuestion): PrintedQuestion | null => {
    const q = question.q;
    if (q.mode === "place") return null;
    const answer = amountText(q, q.answer);
    if (q.mode === "draw") return { text: tx("sheet.draw", { n: String(q.answer), unit: q.ruler.unit }), answer };
    return { text: blank(question.prompt ?? ""), answer };
  },
  method: (question: RulerRoundQuestion) => {
    const m = question.q.mode;
    return method(m === "offset" || m === "difference" || m === "numberline" || m === "draw" ? m : "ruler");
  },
  figure: (question: RulerRoundQuestion) =>
    question.q.mode === "numberline" || question.q.mode === "draw" || question.q.mode === "place" ? null : <PrintRuler q={question.q} />,
};

/* ------------------------------------------------------------------ scale */

export function PrintDial({ q }: { q: ScaleRoundQuestion["q"] }) {
  const { dial, value } = q;
  const C = 100;
  const R = 80;
  const at = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  };
  const isLabel = (v: number) => Math.abs(v / dial.labelEvery - Math.round(v / dial.labelEvery)) < 1e-9;
  const [nx, ny] = at(needleAngle(dial, value), R - 6);
  return (
    <svg viewBox="0 0 200 190" width="100%" style={{ maxWidth: 200 }} role="img" aria-label="scale">
      <circle cx={C} cy={C} r={R + 6} fill="white" stroke={INK} strokeWidth="1.5" />
      {Array.from({ length: stepsOf(dial) + 1 }, (_, i) => {
        const v = i * dial.step;
        const [x1, y1] = at(needleAngle(dial, v), R);
        const [x2, y2] = at(needleAngle(dial, v), isLabel(v) ? R - 12 : R - 6);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={isLabel(v) ? 1.6 : 0.8} />;
      })}
      {Array.from({ length: stepsOf(dial) + 1 }, (_, i) => i * dial.step)
        .filter(isLabel)
        .map((v) => {
          const [x, y] = at(needleAngle(dial, v), R - 24);
          return (
            <text key={v} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="10" style={font}>
              {dialLabel(dial, v)}
            </text>
          );
        })}
      <text x={C} y={C + 36} textAnchor="middle" fontSize="10" style={font}>
        {dial.unit === "oz" ? "lb · oz" : dial.unit}
      </text>
      <line x1={C} y1={C} x2={nx} y2={ny} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={C} cy={C} r="4" fill={INK} />
    </svg>
  );
}

const scaleSheet: WorksheetSource = {
  build: (params, i, seen) => buildScaleQuestion(shared(params) as never, i + 1, seen),
  prompt: (question: ScaleRoundQuestion) => question.prompt ?? "",
  printed: (question: ScaleRoundQuestion) => ({ text: blank(question.prompt ?? ""), answer: question.expected ?? "" }),
  method: () => method("scale"),
  figure: (question: ScaleRoundQuestion) => <PrintDial q={question.q} />,
};

/* ------------------------------------------------------------ thermometer */

export function PrintThermometer({ q }: { q: ThermoRoundQuestion["q"] }) {
  const s = q.scale;
  const top = 12;
  const bottom = 222;
  const y = (v: number) => bottom - ((v - s.min) / (s.max - s.min)) * (bottom - top);
  const marks = Array.from({ length: Math.round((s.max - s.min) / s.step) + 1 }, (_, i) => s.min + i * s.step);
  return (
    <svg viewBox="0 0 110 262" width="100%" style={{ maxWidth: 110 }} role="img" aria-label="thermometer">
      <text x="14" y="16" fontSize="10" style={font}>°{s.unit}</text>
      <rect x="34" y={top - 6} width="16" height={bottom - top + 22} rx="8" fill="white" stroke={INK} strokeWidth="1.5" />
      <rect x="38" y={y(q.value)} width="8" height={240 - y(q.value)} fill="#9ca3af" />
      <circle cx="42" cy="242" r="13" fill="#9ca3af" stroke={INK} strokeWidth="1.5" />
      {marks.map((v) => {
        const lab = v % s.labelEvery === 0;
        return (
          <g key={v}>
            <line x1="50" x2={lab ? 60 : 55} y1={y(v)} y2={y(v)} stroke={INK} strokeWidth={lab ? 1.3 : 0.7} />
            {lab && (
              <text x="63" y={y(v)} dominantBaseline="central" fontSize="9" style={font}>
                {degText(v)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const thermoSheet: WorksheetSource = {
  build: (params, i, seen) => buildThermoQuestion(shared(params) as never, i + 1, seen),
  prompt: (question: ThermoRoundQuestion) => question.prompt ?? "",
  printed: (question: ThermoRoundQuestion) => ({ text: blank(question.prompt ?? ""), answer: question.expected ?? "" }),
  method: (question: ThermoRoundQuestion) => method(question.q.mode === "change" ? "change" : "thermo"),
  // A change is worked out in words; the thermometer would show the start, which the sentence already gives.
  figure: (question: ThermoRoundQuestion) => (question.q.mode === "change" ? null : <PrintThermometer q={question.q} />),
};

/* -------------------------------------------------------------------- jug */

export function PrintJug({ q, filled }: { q: CapacityRoundQuestion["q"]; filled: boolean }) {
  const max = q.max ?? 1000;
  const step = q.step ?? 100;
  const labelEvery = q.labelEvery ?? Math.max(step, 100);
  const top = 14;
  const bottom = 214;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  return (
    <svg viewBox="0 0 150 228" width="100%" style={{ maxWidth: 150 }} role="img" aria-label="jug">
      {filled && <rect x="20" y={y(q.ml ?? 0)} width="80" height={bottom - y(q.ml ?? 0)} fill="#d1d5db" />}
      <path d={`M20 ${top - 6} V${bottom} H100 V${top - 6}`} fill="none" stroke={INK} strokeWidth="1.8" />
      {Array.from({ length: max / step + 1 }, (_, i) => i * step).map((v) => {
        const lab = v % labelEvery === 0;
        return (
          <g key={v}>
            <line x1="100" x2={lab ? 86 : 92} y1={y(v)} y2={y(v)} stroke={INK} strokeWidth={lab ? 1.3 : 0.7} />
            {lab && v > 0 && (
              <text x="106" y={y(v)} dominantBaseline="central" fontSize="9" style={font}>
                {v}
              </text>
            )}
          </g>
        );
      })}
      <text x="106" y={bottom + 10} fontSize="9" style={font}>ml</text>
    </svg>
  );
}

const capacitySheet: WorksheetSource = {
  build: (params, i, seen) => buildCapacityQuestion(shared(params) as never, i + 1, seen),
  prompt: (question: CapacityRoundQuestion) => question.prompt ?? "",
  printed: (question: CapacityRoundQuestion): PrintedQuestion | null => {
    const q = question.q;
    if (q.mode === "jug") return { text: blank(question.prompt ?? ""), answer: `${q.ml} ml` };
    if (q.mode === "fill") return { text: tx("sheet.fill", { target: String(q.ml), unit: "ml" }), answer: `${q.ml} ml` };
    if (q.mode === "customary") return { text: blank(question.prompt ?? ""), answer: q.kind === "which" ? usName(q.answer as never) : q.answer };
    return null; // pour and cups: the subject is the water you pour.
  },
  method: (question: CapacityRoundQuestion) => {
    const m = question.q.mode;
    return m === "customary" ? method("customary", 1) : m === "fill" ? method("fill") : method("jug");
  },
  figure: (question: CapacityRoundQuestion) => {
    const m = question.q.mode;
    return m === "jug" || m === "fill" ? <PrintJug q={question.q} filled={m === "jug"} /> : null;
  },
};

/* --------------------------------------------------------- story, estimate */

const storySheet: WorksheetSource = {
  build: (params, i, seen) => buildStoryQuestion(shared(params) as never, i + 1, seen),
  prompt: (question: StoryRoundQuestion) => question.prompt ?? "",
  printed: (question: StoryRoundQuestion) => ({ text: blank(question.prompt ?? ""), answer: question.expected ?? "" }),
  method: () => method("story"),
  figure: () => null,
};

const estimateSheet: WorksheetSource = {
  build: (params, i, seen) => buildEstimateQuestion(shared(params) as never, i + 1, seen),
  prompt: (question: EstimateRoundQuestion) => question.prompt ?? "",
  printed: (question: EstimateRoundQuestion) => {
    const q = question.q;
    if (q.mode === "choose_unit") {
      const units = (q.units ?? []).map((u) => unitSymbol(u, "INTL"));
      return { text: `${question.prompt ?? ""} (${units.join(" / ")})`, answer: unitSymbol(q.answer as never, "INTL") };
    }
    const unit = unitSymbol(ESTIMATE_THINGS[q.thing].unit, "INTL");
    const [a, b] = q.options!;
    return { text: `${question.prompt ?? ""} (${a} ${unit} / ${b} ${unit})`, answer: `${q.answer} ${unit}` };
  },
  method: () => method("estimate"),
  figure: () => null,
};

export const SHEETS = { ruler: rulerSheet, scale: scaleSheet, thermo: thermoSheet, capacity: capacitySheet, story: storySheet, estimate: estimateSheet };

/** For tests: a quarter-inch answer reads as the ruler says it. */
export const sheetQuarters = quartersText;
