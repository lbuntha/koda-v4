import React from "react";
import { motion } from "motion/react";
import type { RulerSpec } from "../internal/ruler";
import { tx } from "../internal/i18n";

/**
 * The ruler and number line RulerDesk draws.
 *
 * Positions are percentages of the strip, so the thing above the ruler and the
 * marks on it line up at any width. Tick lines are an SVG stretched to the
 * strip; the numbers are HTML, so they stay readable instead of stretching.
 * The 0 is inset from the ruler's edge on purpose: a real ruler's edge is not 0.
 */

/** Half a unit of empty ruler before the 0 and after the last mark. */
export const INSET = 0.5;

/** Where `step` (1/sub of a unit from the left mark) sits, as a percentage of the strip. */
export const xPct = (spec: RulerSpec, step: number) => ((INSET + step / spec.sub) / (spec.span + 2 * INSET)) * 100;
export const wPct = (spec: RulerSpec, steps: number) => (steps / spec.sub / (spec.span + 2 * INSET)) * 100;

const tickHeight = (spec: RulerSpec, i: number) => {
  if (i % spec.sub === 0) return 46;
  if (spec.sub === 10 && i % 5 === 0) return 32;
  if (spec.sub === 4 && i % 2 === 0) return 32;
  if (spec.sub === 2) return 30;
  return 20;
};

export interface RulerStripProps {
  spec: RulerSpec;
  /** Hint: an emerald band between two steps, and, with `count`, the whole units in it numbered 1, 2, 3. */
  green?: { from: number; to: number; count?: boolean };
  /** Hint: ring the number at this step. */
  ring?: number;
  /** Makes each whole mark (and the edge before the first one) a button. */
  onMark?: (n: number) => void;
  onEdge?: () => void;
  disabled?: boolean;
  testId?: string;
}

export const RulerStrip: React.FC<RulerStripProps> = ({ spec, green, ring, onMark, onEdge, disabled, testId = "ruler" }) => {
  const total = spec.span + 2 * INSET;
  const steps = spec.span * spec.sub;
  const labels = Array.from({ length: spec.span + 1 }, (_, u) => u);
  return (
    <div
      className="relative h-16 rounded-md border-2 border-sky-700/70 bg-sky-100 dark:border-sky-400/60 dark:bg-sky-950"
      data-testid={testId}
      data-start={spec.start}
    >
      {green && (
        <span
          className="absolute inset-y-0 bg-emerald-300/70 dark:bg-emerald-500/40"
          style={{ left: `${xPct(spec, green.from)}%`, width: `${wPct(spec, green.to - green.from)}%` }}
          data-testid="green"
        />
      )}
      {green?.count &&
        Array.from({ length: Math.floor((green.to - green.from) / spec.sub) }, (_, k) => (
          <span
            key={k}
            className="absolute top-[46%] -translate-x-1/2 text-[10px] font-black text-emerald-900 dark:text-emerald-200"
            style={{ left: `${xPct(spec, green.from + (k + 0.5) * spec.sub)}%` }}
          >
            {k + 1}
          </span>
        ))}
      <svg viewBox={`0 0 ${total} 100`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: steps + 1 }, (_, i) => {
          const x = INSET + i / spec.sub;
          return <line key={i} x1={x} x2={x} y1={0} y2={tickHeight(spec, i)} className="stroke-ink" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {labels.map((u) => (
        <span
          key={u}
          className={`pointer-events-none absolute bottom-1 -translate-x-1/2 text-[11px] font-bold leading-none text-ink ${
            ring === u * spec.sub ? "rounded-full px-1 py-0.5 ring-2 ring-rose-500" : ""
          }`}
          style={{ left: `${xPct(spec, u * spec.sub)}%` }}
        >
          {spec.start + u}
        </span>
      ))}
      {spec.unit !== "mm" && (
        <span className="pointer-events-none absolute -top-4 right-0 text-[11px] font-bold leading-none text-body">{spec.unit}</span>
      )}
      {onEdge && (
        <button
          type="button"
          disabled={disabled}
          aria-label={tx("ruler.edge")}
          onClick={onEdge}
          className="absolute inset-y-0 left-0 rounded-l-md"
          style={{ width: `${(INSET / total) * 100 * 0.8}%` }}
        />
      )}
      {onMark &&
        labels.map((u) => (
          <button
            key={u}
            type="button"
            disabled={disabled}
            aria-label={tx("ruler.mark", { n: String(spec.start + u) })}
            onClick={() => onMark(spec.start + u)}
            className="absolute inset-y-0 -translate-x-1/2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            style={{ left: `${xPct(spec, u * spec.sub)}%`, width: `${(1 / total) * 100}%` }}
          />
        ))}
    </div>
  );
};

/**
 * One unit of the ruler, magnified: the centimetre (or inch) the thing ends
 * in, so millimetres and quarter inches can be counted on a phone.
 */
export const ZoomLens: React.FC<{ spec: RulerSpec; end: number }> = ({ spec, end }) => {
  const k = end % spec.sub === 0 ? end / spec.sub - 1 : Math.floor(end / spec.sub);
  const inside = end - k * spec.sub;
  const label = spec.unit === "mm" ? "cm" : spec.unit;
  return (
    <div className="flex flex-col gap-1" data-testid="zoom" data-from={k}>
      <span className="text-xs font-black uppercase text-body">
        {tx("ruler.zoom")} · {label}
      </span>
      <div className="relative h-24 overflow-hidden rounded-md border-2 border-sky-700/70 bg-sky-100 dark:border-sky-400/60 dark:bg-sky-950">
        <span className="absolute left-0 top-2 h-6 rounded-r bg-pink-500" style={{ width: `${(4 + (inside / spec.sub) * 92)}%` }} data-testid="zoom-thing" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-x-0 top-10 h-9 w-full" aria-hidden="true">
          {Array.from({ length: spec.sub + 1 }, (_, i) => {
            const x = 4 + (i / spec.sub) * 92;
            const h = i % spec.sub === 0 ? 100 : (spec.sub === 10 && i === 5) || (spec.sub === 4 && i === 2) ? 70 : 45;
            return <line key={i} x1={x} x2={x} y1={0} y2={h} className="stroke-ink" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {[k, k + 1].map((n, i) => (
          <span key={n} className="absolute bottom-0.5 -translate-x-1/2 text-sm font-black leading-none text-ink" style={{ left: `${4 + i * 92}%` }}>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
};

/** A line drawn from the ruler's 0 to a mark, for `draw`. */
export const DrawnLine: React.FC<{ spec: RulerSpec; to: number | null; motionOK: boolean }> = ({ spec, to, motionOK }) => (
  <div className="relative h-6" data-testid="drawn" data-to={to ?? ""}>
    <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700" style={{ left: `${xPct(spec, 0)}%` }} />
    <motion.span
      className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-violet-600"
      style={{ left: `${xPct(spec, 0)}%` }}
      initial={false}
      animate={{ width: `${wPct(spec, (to ?? 0) * spec.sub)}%` }}
      transition={motionOK ? { type: "spring", stiffness: 260, damping: 26 } : { duration: 0 }}
    />
  </div>
);

/** 0–max number line with a mark every `step` and a number every `labelEvery`; every mark a button. */
export const NumberLine: React.FC<{
  max: number;
  step: number;
  labelEvery: number;
  start: number;
  picked: number | null;
  arrow?: "right" | "left";
  onPick: (n: number) => void;
  disabled?: boolean;
}> = ({ max, step, labelEvery, start, picked, arrow, onPick, disabled }) => {
  const pos = (n: number) => 4 + (n / max) * 92;
  const marks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  return (
    <div className="relative h-20" data-testid="numberline" data-picked={picked ?? ""}>
      <span className="absolute left-[2%] right-[2%] top-8 h-1 rounded bg-ink" />
      {marks.map((n) => (
        <span key={n} className={`absolute top-6 w-0.5 -translate-x-1/2 bg-ink ${n % labelEvery === 0 ? "h-5" : "h-3 translate-y-1"}`} style={{ left: `${pos(n)}%` }} />
      ))}
      {marks.filter((n) => n % labelEvery === 0).map((n) => (
        <span key={n} className="absolute top-12 -translate-x-1/2 text-[11px] font-bold text-ink" style={{ left: `${pos(n)}%` }}>{n}</span>
      ))}
      <span className="absolute top-[22px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-pink-700 bg-pink-400" style={{ left: `${pos(start)}%` }} data-testid="start" />
      {arrow && (
        <span className="absolute top-0 -translate-x-1/2 text-lg font-black text-emerald-600" style={{ left: `${pos(start)}%` }} data-testid="arrow">
          {arrow === "right" ? "→" : "←"}
        </span>
      )}
      {picked !== null && (
        <span className="absolute top-[22px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-violet-800 bg-violet-500" style={{ left: `${pos(picked)}%` }} data-testid="picked" />
      )}
      {marks.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={tx("ruler.mark", { n: String(n) })}
          onClick={() => onPick(n)}
          className="absolute top-2 h-12 -translate-x-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          style={{ left: `${pos(n)}%`, width: `${(step / max) * 92}%` }}
        />
      ))}
    </div>
  );
};
