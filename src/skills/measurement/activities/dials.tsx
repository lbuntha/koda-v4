import React from "react";
import { motion } from "motion/react";
import { Apple, Carrot, Luggage, PersonStanding, ShoppingBasket, Wheat, type LucideIcon } from "lucide-react";
import { stepsOf, type Dial, type ScaleLoad } from "../internal/scale";
import { degText, type ThermoScale } from "../internal/thermo";
import { tx } from "../internal/i18n";

/**
 * The round scale, the thermometer and the bar model.
 *
 * Both instruments are SVG drawn to their own numbers: every mark is a real
 * step of the scale and the needle or liquid stops exactly on one. The needle
 * overshoots and settles like a real spring scale (plan §5.2 F).
 */

/* ------------------------------------------------------------ round scale */

const CX = 120;
const CY = 124;
const R = 96;
/** The dial sweeps 270°, from bottom-left (0) round to bottom-right (max). */
export const needleAngle = (dial: Dial, value: number) => -135 + (270 * value) / dial.max;
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};

export const LOAD_ICON: Record<ScaleLoad, LucideIcon> = {
  flour: Wheat,
  apples: Apple,
  rice: ShoppingBasket,
  carrots: Carrot,
  child: PersonStanding,
  suitcase: Luggage,
};

/** A number on the dial, as it is printed there. */
export const dialLabel = (dial: Dial, v: number) => (dial.unit === "oz" ? (v === 0 ? "0" : `${v / 16} lb`) : String(v));

export const ScaleDial: React.FC<{
  dial: Dial;
  value: number;
  load: ScaleLoad;
  motionOK: boolean;
  /** Hint: an emerald arc from this value to the needle, with the marks in it dotted. */
  from?: number;
}> = ({ dial, value, load, motionOK, from }) => {
  const n = stepsOf(dial);
  const Icon = LOAD_ICON[load];
  const medium = (v: number) =>
    (dial.unit === "oz" && v % 4 === 0) || (dial.unit === "kg" && dial.step === 1 && v % 5 === 0) || (dial.unit === "kg" && dial.step === 0.5 && Number.isInteger(v));
  const isLabel = (v: number) => Math.abs(v / dial.labelEvery - Math.round(v / dial.labelEvery)) < 1e-9;
  const arc = (a: number, b: number, r: number) => {
    const [x1, y1] = polar(needleAngle(dial, a), r);
    const [x2, y2] = polar(needleAngle(dial, b), r);
    const large = needleAngle(dial, b) - needleAngle(dial, a) > 180 ? 1 : 0;
    return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  return (
    <div className="mx-auto flex w-full max-w-[280px] flex-col items-center" data-testid="dial" data-value={value} data-max={dial.max} data-step={dial.step}>
      <div className="relative z-10 -mb-2 flex h-14 w-40 items-end justify-center rounded-t-xl border-b-4 border-ink/70">
        <Icon className="h-12 w-12 text-violet-600 dark:text-violet-300" strokeWidth={1.75} aria-label={tx(`scale.load.${load}`)} />
      </div>
      <svg viewBox="0 0 240 232" className="w-full" role="img" aria-label={tx(`scale.load.${load}`)}>
        <rect x="4" y="4" width="232" height="224" rx="36" className="fill-violet-100 stroke-violet-700 dark:fill-violet-950 dark:stroke-violet-400" strokeWidth="4" />
        <circle cx={CX} cy={CY} r={R + 8} className="fill-white stroke-ink/60 dark:fill-slate-900" strokeWidth="2" />
        {from !== undefined && from < value && (
          <path d={arc(from, value, R - 4)} className="fill-none stroke-emerald-400" strokeWidth="10" data-testid="dial-arc" />
        )}
        {Array.from({ length: n + 1 }, (_, i) => {
          const v = i * dial.step;
          const lab = isLabel(v);
          const [x1, y1] = polar(needleAngle(dial, v), R);
          const [x2, y2] = polar(needleAngle(dial, v), lab ? R - 14 : medium(v) ? R - 10 : R - 6);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-ink" strokeWidth={lab ? 2.4 : 1.4} />;
        })}
        {Array.from({ length: n + 1 }, (_, i) => i * dial.step)
          .filter(isLabel)
          .map((v) => {
            const [x, y] = polar(needleAngle(dial, v), R - 28);
            return (
              <text key={v} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-ink text-[13px] font-bold">
                {dialLabel(dial, v)}
              </text>
            );
          })}
        <text x={CX} y={CY + 44} textAnchor="middle" className="fill-body text-[13px] font-black">
          {dial.unit === "oz" ? "lb · oz" : dial.unit}
        </text>
        <motion.line
          x1={CX}
          y1={CY + 12}
          x2={CX}
          y2={CY - R + 6}
          className="stroke-rose-600"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` }}
          initial={motionOK ? { rotate: -135 } : false}
          animate={{ rotate: needleAngle(dial, value) }}
          transition={motionOK ? { type: "spring", stiffness: 90, damping: 7 } : { duration: 0 }}
          data-testid="needle"
        />
        <circle cx={CX} cy={CY} r="7" className="fill-rose-600" />
      </svg>
    </div>
  );
};

/* ------------------------------------------------------------ thermometer */

const TOP = 20;
const BOTTOM = 290;
export const thermoY = (s: ThermoScale, v: number) => BOTTOM - ((v - s.min) / (s.max - s.min)) * (BOTTOM - TOP);

export const ThermometerArt: React.FC<{
  scale: ThermoScale;
  value: number;
  motionOK: boolean;
  /** Hint: ring this number and dot the marks from it to the top of the line. */
  from?: number;
  /** Hint (change): an arrow up or down beside the tube. */
  arrow?: "up" | "down";
}> = ({ scale, value, motionOK, from, arrow }) => {
  const marks = Array.from({ length: Math.round((scale.max - scale.min) / scale.step) + 1 }, (_, i) => scale.min + i * scale.step);
  const top = thermoY(scale, value);
  return (
    <svg viewBox="0 0 150 340" className="mx-auto h-[290px] w-auto" role="img" aria-label="thermometer" data-testid="thermometer" data-value={value}>
      <text x="26" y="26" textAnchor="middle" className="fill-body text-[14px] font-black">°{scale.unit}</text>
      <rect x="48" y={TOP - 8} width="24" height={BOTTOM - TOP + 30} rx="12" className="fill-white stroke-ink/70 dark:fill-slate-900" strokeWidth="3" />
      <circle cx="60" cy="312" r="20" className="fill-rose-500 stroke-ink/70" strokeWidth="3" />
      <motion.rect
        x="54"
        width="12"
        className="fill-rose-500"
        initial={false}
        animate={{ attrY: top, height: 312 - top }}
        transition={motionOK ? { type: "spring", stiffness: 120, damping: 18 } : { duration: 0 }}
        data-testid="liquid"
      />
      {marks.map((v) => {
        const y = thermoY(scale, v);
        const lab = v % scale.labelEvery === 0;
        const counted = from !== undefined && v > from && v <= value;
        return (
          <g key={v}>
            <line x1="74" x2={lab ? 88 : 81} y1={y} y2={y} className="stroke-ink" strokeWidth={lab ? 2 : 1.2} />
            {lab && (
              <text x="92" y={y} dominantBaseline="central" className="fill-ink text-[12px] font-bold">
                {degText(v)}
              </text>
            )}
            {lab && from === v && <rect x="88" y={y - 9} width="34" height="18" rx="9" className="fill-none stroke-rose-500" strokeWidth="2" data-testid="thermo-ring" />}
            {counted && <circle cx="80" cy={y} r="2.6" className="fill-emerald-500" data-testid="thermo-dot" />}
          </g>
        );
      })}
      {scale.min < 0 && <line x1="40" x2="74" y1={thermoY(scale, 0)} y2={thermoY(scale, 0)} className="stroke-sky-600" strokeWidth="2" strokeDasharray="3 3" />}
      {arrow && (
        <text x="22" y={top} dominantBaseline="central" textAnchor="middle" className="fill-emerald-600 text-[26px] font-black" data-testid="thermo-arrow">
          {arrow === "up" ? "↑" : "↓"}
        </text>
      )}
    </svg>
  );
};

/* ------------------------------------------------------------ bar model */

/** Rung 2 of a story: the bar model, with the unknown part as "?". */
export const BarModel: React.FC<{ kind: "join" | "left" | "compare"; a: number; b: number; unit: string }> = ({ kind, a, b, unit }) => {
  const big = kind === "join" ? a + b : a;
  // Parts share the row in proportion, but never so thin that "10 cm" wraps.
  const w = (v: number): React.CSSProperties => ({ flex: `${v / big} 1 0%`, minWidth: "4.5rem" });
  const cell = "flex items-center justify-center whitespace-nowrap rounded-md border-2 px-1 py-2 text-sm font-black";
  const v = (n: number) => `${n} ${unit}`;
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-3 shadow-inner" data-testid="bar-model" data-kind={kind}>
      {kind === "compare" ? (
        <>
          <div className={`${cell} border-violet-600 bg-violet-200 text-violet-950 dark:bg-violet-800 dark:text-violet-50`} style={{ width: "100%" }}>{v(a)}</div>
          <div className="flex">
            <div className={`${cell} border-sky-600 bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-sky-50`} style={w(b)}>{v(b)}</div>
            <div className={`${cell} border-dashed border-emerald-600 text-emerald-800 dark:text-emerald-200`} style={w(a - b)}>?</div>
          </div>
        </>
      ) : (
        <>
          <div className={`${cell} border-ink/50 bg-surface text-ink`} style={{ width: "100%" }}>{kind === "join" ? "?" : v(a)}</div>
          <div className="flex">
            <div className={`${cell} border-violet-600 bg-violet-200 text-violet-950 dark:bg-violet-800 dark:text-violet-50`} style={w(kind === "join" ? a : b)}>
              {v(kind === "join" ? a : b)}
            </div>
            <div
              className={`${cell} ${kind === "join" ? "border-sky-600 bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-sky-50" : "border-dashed border-emerald-600 text-emerald-800 dark:text-emerald-200"}`}
              style={w(kind === "join" ? b : a - b)}
            >
              {kind === "join" ? v(b) : "?"}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
