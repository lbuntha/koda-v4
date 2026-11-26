import React, { useId } from "react";
import { motion } from "motion/react";
import type { MassThing } from "../internal/balance";
import type { CustomaryUnit, Vessel } from "../internal/capacity";

/**
 * The instruments and objects BalanceBeam and PourLab draw.
 *
 * Flat SVG in the house palette (water is sky). Every rig takes `motionOK`
 * so the `instrument_motion` switch and reduced motion both make it jump
 * straight to its value instead of springing there.
 */

const springOr = (motionOK: boolean, spring = { type: "spring" as const, stiffness: 120, damping: 14 }) =>
  motionOK ? spring : { duration: 0 };

/* ------------------------------------------------------------ mass things */

export const MassArt: React.FC<{ thing: MassThing; px: number }> = ({ thing, px }) => {
  const common = { width: px, height: px, viewBox: "0 0 64 64", "aria-hidden": true } as const;
  switch (thing) {
    case "feather":
      return (
        <svg {...common}>
          <path d="M14 54 C22 30 38 14 54 8 C50 26 36 44 14 54 Z" fill="#E0E7FF" stroke="#6366F1" strokeWidth="2.5" />
          <path d="M14 54 L46 18" stroke="#6366F1" strokeWidth="2" />
        </svg>
      );
    case "balloon":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="24" rx="17" ry="20" fill="#F472B6" stroke="#BE185D" strokeWidth="2.5" />
          <path d="M29 44 L35 44 L32 48 Z" fill="#BE185D" />
          <path d="M32 48 C28 54 36 56 32 62" stroke="#64748B" strokeWidth="2" fill="none" />
          <ellipse cx="25" cy="17" rx="4" ry="6" fill="#FBCFE8" />
        </svg>
      );
    case "pillow":
      return (
        <svg {...common}>
          <path d="M6 22 Q32 12 58 22 Q62 32 58 42 Q32 52 6 42 Q2 32 6 22 Z" fill="#DDD6FE" stroke="#7C3AED" strokeWidth="2.5" />
          <path d="M18 30 Q32 26 46 30" stroke="#A78BFA" strokeWidth="2" fill="none" />
        </svg>
      );
    case "brick":
      return (
        <svg {...common}>
          <rect x="6" y="20" width="52" height="26" rx="3" fill="#E11D48" stroke="#9F1239" strokeWidth="2.5" />
          <path d="M6 33 H58 M24 20 V33 M42 33 V46" stroke="#9F1239" strokeWidth="2" />
        </svg>
      );
    case "rock":
      return (
        <svg {...common}>
          <path d="M8 46 L14 26 L30 16 L48 20 L58 38 L50 50 L18 52 Z" fill="#94A3B8" stroke="#475569" strokeWidth="2.5" />
          <path d="M22 30 L30 26 M40 36 L48 34" stroke="#64748B" strokeWidth="2" />
        </svg>
      );
    case "apple":
      return (
        <svg {...common}>
          <path d="M32 18 C20 10 8 20 12 36 C15 50 26 58 32 54 C38 58 49 50 52 36 C56 20 44 10 32 18 Z" fill="#F43F5E" stroke="#BE123C" strokeWidth="2.5" />
          <path d="M32 18 C32 12 34 8 38 6" stroke="#57534E" strokeWidth="2.5" fill="none" />
          <path d="M34 12 C40 6 48 8 50 12 C44 16 38 15 34 12 Z" fill="#10B981" />
        </svg>
      );
    case "watermelon":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="34" rx="28" ry="22" fill="#10B981" stroke="#047857" strokeWidth="2.5" />
          <path d="M14 20 Q20 34 14 48 M26 13 Q32 34 26 55 M38 13 Q44 34 38 55 M50 20 Q56 34 50 48" stroke="#065F46" strokeWidth="2.5" fill="none" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <rect x="12" y="10" width="40" height="46" rx="3" fill="#6366F1" stroke="#3730A3" strokeWidth="2.5" />
          <rect x="18" y="10" width="4" height="46" fill="#3730A3" />
          <rect x="28" y="20" width="18" height="6" rx="1" fill="#E0E7FF" />
        </svg>
      );
    case "shoe":
      return (
        <svg {...common}>
          <path d="M6 40 L10 22 L26 22 L32 32 L52 36 Q60 38 58 46 L8 46 Z" fill="#0EA5E9" stroke="#0369A1" strokeWidth="2.5" />
          <path d="M8 46 H58" stroke="#0C4A6E" strokeWidth="4" />
          <path d="M20 26 L24 32 M26 28 L28 33" stroke="#E0F2FE" strokeWidth="2" />
        </svg>
      );
  }
};

export const Cube: React.FC<{ px?: number }> = ({ px = 20 }) => (
  <svg width={px} height={px} viewBox="0 0 20 20" aria-hidden="true">
    <rect x="1.5" y="1.5" width="17" height="17" rx="3" fill="#A78BFA" stroke="#6D28D9" strokeWidth="2" />
    <rect x="5" y="5" width="5" height="3" rx="1" fill="#EDE9FE" />
  </svg>
);

/* ------------------------------------------------------------ pan balance */

/**
 * A pan balance drawn in a 300×240 design box and laid out in percentages of
 * it, so it scales down to any frame and the pans always hang from the beam's
 * ends inside it. The beam turns `angle` degrees (positive = right side down);
 * each pan drops or rises with its end of the beam, and its strings run from
 * that end to the plate's rim.
 */
export const PanBalance: React.FC<{
  angle: number;
  left: React.ReactNode;
  right: React.ReactNode;
  motionOK: boolean;
}> = ({ angle, left, right, motionOK }) => {
  const W = 300;
  const H = 240;
  const pivotY = 40;
  const halfBeam = 100;
  const panW = 96;
  const panH = 116;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const dy = Math.sin((angle * Math.PI) / 180) * halfBeam;
  const t = springOr(motionOK);
  const pan = (content: React.ReactNode, side: "left" | "right") => (
    <motion.div
      className="absolute flex flex-col justify-end"
      style={{
        left: pct(W / 2 + (side === "left" ? -halfBeam : halfBeam) - panW / 2, W),
        top: pct(pivotY, H),
        width: pct(panW, W),
        height: pct(panH, H),
      }}
      initial={false}
      animate={{ y: pct(side === "left" ? -dy : dy, panH) }}
      transition={t}
      data-testid={`pan-${side}`}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${panW} ${panH}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={`M${panW / 2} 0 L4 ${panH - 8} M${panW / 2} 0 L${panW - 4} ${panH - 8}`} className="stroke-slate-400" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative flex items-end justify-center gap-0.5 pb-0.5">{content}</div>
      <div className="relative h-2.5 w-full rounded-b-full bg-slate-500" />
    </motion.div>
  );
  return (
    <div className="relative mx-auto w-full max-w-[300px]" style={{ aspectRatio: `${W} / ${H}` }} data-testid="balance" data-angle={angle}>
      <div className="absolute rounded-t bg-slate-500" style={{ left: pct(W / 2 - 6, W), width: pct(12, W), top: pct(pivotY, H), bottom: pct(8, H) }} />
      <div className="absolute bottom-0 h-3 rounded-full bg-slate-600" style={{ left: pct(W / 2 - 56, W), width: pct(112, W) }} />
      {pan(left, "left")}
      {pan(right, "right")}
      <motion.div
        className="absolute h-2.5 rounded-full bg-slate-600 dark:bg-slate-300"
        style={{ left: pct(W / 2 - halfBeam, W), width: pct(halfBeam * 2, W), top: pct(pivotY - 5, H) }}
        initial={false}
        animate={{ rotate: angle }}
        transition={t}
      />
      <div className="absolute aspect-square rounded-full bg-violet-600" style={{ left: pct(W / 2 - 10, W), width: pct(20, W), top: pct(pivotY - 10, H) }} />
    </div>
  );
};

/* ------------------------------------------------------------ vessels and water */

/** Outline paths in a 60×80 box; the water is clipped to the same shape. */
const VESSEL_PATH: Record<Vessel, string> = {
  jar: "M18 6 H42 V12 Q46 14 46 20 V74 Q46 78 42 78 H18 Q14 78 14 74 V20 Q14 14 18 12 Z",
  bottle: "M25 4 H35 V18 Q46 24 46 34 V74 Q46 78 42 78 H18 Q14 78 14 74 V34 Q14 24 25 18 Z",
  vase: "M20 4 H40 Q36 18 44 34 Q52 54 42 78 H18 Q8 54 16 34 Q24 18 20 4 Z",
  bowl: "M2 40 H58 Q56 72 30 76 Q4 72 2 40 Z",
  mug: "M6 34 H46 V72 Q46 78 40 78 H12 Q6 78 6 72 Z",
  pot: "M4 30 H56 V70 Q56 78 48 78 H12 Q4 78 4 70 Z",
};
/** Top and bottom of the inside, so a fill fraction maps to a water line. */
const VESSEL_SPAN: Record<Vessel, [number, number]> = {
  jar: [12, 78],
  bottle: [18, 78],
  vase: [8, 78],
  bowl: [40, 76],
  mug: [34, 78],
  pot: [30, 78],
};

export const VesselArt: React.FC<{ vessel: Vessel; fill: number; px?: number; motionOK: boolean }> = ({ vessel, fill, px = 96, motionOK }) => {
  const id = useId().replace(/:/g, "");
  const [top, bottom] = VESSEL_SPAN[vessel];
  const level = bottom - (bottom - top) * Math.max(0, Math.min(1, fill));
  return (
    <svg width={px} height={(px * 80) / 60} viewBox="0 0 60 80" aria-hidden="true" data-fill={fill}>
      <defs>
        <clipPath id={`v${id}`}>
          <path d={VESSEL_PATH[vessel]} />
        </clipPath>
      </defs>
      <path d={VESSEL_PATH[vessel]} className="fill-white dark:fill-slate-800" />
      {/* Clip a group, not the rect: motion moves the rect, and a clip on it would move with it. */}
      <g clipPath={`url(#v${id})`}>
        <motion.rect
          x="0"
          width="60"
          className="fill-sky-400/80"
          initial={false}
          animate={{ attrY: level, height: 80 - level }}
          transition={springOr(motionOK, { type: "spring", stiffness: 60, damping: 16 })}
          data-level={level}
        />
      </g>
      {vessel === "mug" && <path d="M46 42 Q58 42 58 54 Q58 64 46 64" fill="none" className="stroke-slate-500" strokeWidth="3" />}
      <path d={VESSEL_PATH[vessel]} fill="none" className="stroke-slate-600 dark:stroke-slate-300" strokeWidth="2.5" />
    </svg>
  );
};

/** A row of the same small cup, each full or empty: what one vessel poured into. */
export const CupRow: React.FC<{ full: number; motionOK: boolean; testId?: string }> = ({ full, motionOK, testId }) => (
  <div className="flex min-h-10 flex-wrap justify-center gap-1" data-testid={testId} data-full={full}>
    {Array.from({ length: full }, (_, i) => (
      <motion.div
        key={i}
        initial={motionOK ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={motionOK ? { delay: i * 0.18, type: "spring", stiffness: 300, damping: 20 } : { duration: 0 }}
      >
        <VesselArt vessel="mug" fill={0.85} px={28} motionOK={false} />
      </motion.div>
    ))}
  </div>
);

/* ------------------------------------------------------------ measuring jug */

/**
 * A measuring jug, `max` mL, a mark every `step` and a number every
 * `labelEvery`. `ml` is the water; `target`, if given, is a dashed line to fill to.
 */
export const MeasuringJug: React.FC<{
  ml: number;
  max: number;
  step: number;
  labelEvery: number;
  unit: string;
  target?: number;
  highlight?: boolean;
  motionOK: boolean;
}> = ({ ml, max, step, labelEvery, unit, target, highlight, motionOK }) => {
  const top = 20;
  const bottom = 280;
  const yOf = (v: number) => bottom - ((bottom - top) * v) / max;
  const marks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  return (
    <svg viewBox="0 0 220 300" className="mx-auto h-72 w-auto" aria-hidden="true" data-testid="jug" data-ml={ml}>
      <path d="M40 10 H170 V286 Q170 294 162 294 H48 Q40 294 40 286 Z" className="fill-white dark:fill-slate-800" />
      <motion.rect
        x="42"
        width="126"
        initial={false}
        animate={{ attrY: yOf(ml), height: Math.max(0, bottom - yOf(ml) + 12) }}
        transition={springOr(motionOK, { type: "spring", stiffness: 70, damping: 15 })}
        className="fill-sky-400/75"
      />
      {marks.map((v) => {
        const labelled = v % labelEvery === 0;
        return (
          <g key={v}>
            <path d={`M40 ${yOf(v)} h${labelled ? 34 : 18}`} className="stroke-slate-700 dark:stroke-slate-200" strokeWidth={labelled ? 2.5 : 1.5} />
            {labelled && v > 0 && (
              <text x="80" y={yOf(v) + 5} fontSize="15" fontWeight="800" className="fill-slate-800 dark:fill-slate-100" fontFamily="Arial, sans-serif">
                {v}
              </text>
            )}
          </g>
        );
      })}
      <text x="150" y="36" fontSize="14" fontWeight="800" textAnchor="end" className="fill-slate-500" fontFamily="Arial, sans-serif">
        {unit}
      </text>
      {target !== undefined && (
        <path d={`M34 ${yOf(target)} H176`} className="stroke-rose-500" strokeWidth="3" strokeDasharray="7 5" data-testid="target-line" />
      )}
      {highlight && <path d={`M30 ${yOf(ml)} H180`} className="stroke-violet-600" strokeWidth="3" data-testid="water-top" />}
      <path d="M170 60 Q204 60 204 110 Q204 160 170 160" fill="none" className="stroke-slate-600 dark:stroke-slate-300" strokeWidth="6" />
      <path d="M40 10 V286 Q40 294 48 294 H162 Q170 294 170 286 V10" fill="none" className="stroke-slate-600 dark:stroke-slate-300" strokeWidth="3" />
    </svg>
  );
};

/* ------------------------------------------------------------ US containers */

/** Drawn heights grow with capacity, so a gallon looks like a gallon next to a cup. */
const CUSTOMARY_PX: Record<CustomaryUnit, number> = { cup: 34, pint: 48, quart: 66, gallon: 96 };

export const CustomaryArt: React.FC<{ unit: CustomaryUnit; label: string }> = ({ unit, label }) => {
  const h = CUSTOMARY_PX[unit];
  return (
    <span className="flex flex-col items-center gap-1" aria-hidden="true">
      <svg width={h * 0.7} height={h} viewBox="0 0 42 60">
        {unit === "gallon" ? (
          <path d="M6 14 H30 L36 8 H40 V56 Q40 58 38 58 H4 Q2 58 2 56 V18 Z" className="fill-sky-200 stroke-sky-700" strokeWidth="2.5" />
        ) : unit === "cup" ? (
          <path d="M4 14 H34 L30 56 H8 Z" className="fill-sky-200 stroke-sky-700" strokeWidth="2.5" />
        ) : (
          <path d="M8 4 H34 V12 L38 18 V56 Q38 58 36 58 H6 Q4 58 4 56 V18 L8 12 Z" className="fill-sky-200 stroke-sky-700" strokeWidth="2.5" />
        )}
      </svg>
      <span className="text-xs font-bold text-ink">{label}</span>
    </span>
  );
};
