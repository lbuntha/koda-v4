/**
 * Base-10 blocks — the shared ten-rod and one-unit.
 *
 * One rule governs everything here: **the unit is the module.** A ten-rod is
 * exactly ten one-units laid in a line, drawn at the same size with the same
 * breathing room. Quantity is size — that is the whole reason these blocks
 * teach anything, and it breaks the moment a rod's cell is drawn smaller than
 * the unit it is supposed to equal.
 *
 * So both components read a single `u` (unit size in px) from context, and
 * every other measurement is a fixed ratio of it. Scale `u` and the blocks stay
 * proportionally identical at any size.
 *
 *   const u = useFittedUnitSize(ref, ROD_WIDTH_UNITS);
 *   <Base10Scale size={u}> <TenRod … /> <OneUnit … /> </Base10Scale>
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CountingAsset, AssetType } from "../Assets";

/** Shared feel for a block appearing or moving on the board — springy, not floaty. */
export const BLOCK_SPRING = { type: "spring", stiffness: 460, damping: 26 } as const;

/** Clamp range for the module. Below ~16px the artwork stops being readable. */
export const UNIT_MIN = 16;
export const UNIT_MAX = 40;
const UNIT_FALLBACK = 28;

/**
 * Proportions lifted from the one-unit that already reads well: the artwork
 * fills 60% of its box, with a fifth of a box between neighbours. The old rod
 * used 71% with a 14% gap, which is why its faces looked like they were
 * bursting out of their cells and touching each other.
 */
const ASSET_RATIO = 0.6;
const GAP_RATIO = 0.2;
const PAD_RATIO = 0.18;

/** Width of a horizontal ten-rod, measured in units (cells + gaps + padding). */
export const ROD_WIDTH_UNITS = 10 + 9 * GAP_RATIO + 2 * PAD_RATIO;
/** Height of a horizontal ten-rod, in units — one cell plus its padding. */
export const ROD_HEIGHT_UNITS = 1 + 2 * PAD_RATIO;

/** Absolute floor for a rod's unit — see `fitRodGrid`. */
export const ROD_UNIT_FLOOR = 10;

/**
 * The largest unit size that fits `count` rods into a box — and how to arrange
 * them to get it: how many columns, and **which way up**.
 *
 * A rod is a 12:1.4 sliver, so how many fit is a two-dimensional question and
 * the answer flips with the shape of the box. A wide desktop zone wants rods
 * lying down, reading left to right the way children count. A phone's place
 * column is ~110px wide and tall — laid down, a rod there is forced under 10px
 * a unit and still hangs over both edges, which is exactly what it did. Stood
 * up, the same rod fits at more than twice the unit size.
 *
 * So both orientations are tried, at every column count, and the arrangement
 * that makes the unit biggest wins. Quantity is size here, so a bigger honest
 * unit is always the better answer.
 */
export const fitRodGrid = (
  { width, height, count, gap = 6, min = ROD_UNIT_FLOOR }:
    { width: number; height: number; count: number; gap?: number; min?: number }
) => {
  const total = Math.max(1, count);
  let best = { unit: 0, columns: 1, orientation: "horizontal" as "horizontal" | "vertical" };

  for (const orientation of ["horizontal", "vertical"] as const) {
    const acrossUnits = orientation === "horizontal" ? ROD_WIDTH_UNITS : ROD_HEIGHT_UNITS;
    const downUnits = orientation === "horizontal" ? ROD_HEIGHT_UNITS : ROD_WIDTH_UNITS;

    for (let columns = 1; columns <= total; columns++) {
      const rows = Math.ceil(total / columns);
      const perRodWidth = (width - gap * (columns - 1)) / columns;
      const perRodHeight = (height - gap * (rows - 1)) / rows;
      const unit = Math.min(perRodWidth / acrossUnits, perRodHeight / downUnits);
      if (unit > best.unit) best = { unit, columns, orientation };
    }
  }

  /*
    Floored well below `UNIT_MIN`, and deliberately.

    `UNIT_MIN` is the size below which a *single* unit stops being readable, and
    raising a rod to it when the room is not there does not make anything more
    readable — it makes the rods overflow the box they were measured into, which
    is worse. A rod is read as a length, so fitting wins; the floor here only
    guards against absurd values.
  */
  return {
    unit: Math.max(min, Math.min(UNIT_MAX, Math.floor(best.unit))),
    columns: best.columns,
    orientation: best.orientation
  };
};

const UnitSizeContext = createContext<number>(UNIT_FALLBACK);
export const useUnitSize = () => useContext(UnitSizeContext);

export const Base10Scale: React.FC<{ size: number; children: React.ReactNode }> = ({ size, children }) => (
  <UnitSizeContext.Provider value={size}>{children}</UnitSizeContext.Provider>
);

/**
 * Derive a unit size that fits `unitsAcross` units into the measured element.
 *
 * Measures the container rather than the viewport: a canvas is usually a panel
 * inside the Studio, so viewport width would pick the wrong scale entirely.
 */
export function useFittedUnitSize(
  ref: React.RefObject<HTMLElement | null>,
  unitsAcross: number,
  /** Portion of the measured width a single rod may use. */
  fraction = 1
): number {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width;
      if (typeof next === "number") setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  if (width === null || unitsAcross <= 0) return UNIT_FALLBACK;
  return Math.max(UNIT_MIN, Math.min(UNIT_MAX, Math.floor((width * fraction) / unitsAcross)));
}

/**
 * Sizes every block inside it so that one ten-rod fits the available width.
 *
 * Rods live in wildly different boxes — a full-width workspace, one half of a
 * split column, a ~210px place-value cell — so a single canvas-wide unit size
 * inevitably overflows the narrow ones. Wrap the region that owns a rod and it
 * measures itself. Ones inside the same region inherit that unit, which is what
 * keeps a rod's cell and a one-unit identical.
 */
export const RodFit: React.FC<{
  /** Width available to a rod, as a fraction of this element (e.g. 0.5 for two columns). */
  fraction?: number;
  className?: string;
  children: React.ReactNode;
}> = ({ fraction = 1, className = "", children }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const u = useFittedUnitSize(ref, ROD_WIDTH_UNITS, fraction);
  return (
    <div ref={ref} className={`w-full ${className}`}>
      <Base10Scale size={u}>{children}</Base10Scale>
    </div>
  );
};

const px = (n: number, min = 1) => Math.max(min, Math.round(n));

/**
 * Ten one-units in a line.
 *
 * Horizontal by default: a vertical rod's height is always ten cells, which in
 * a short workspace forces the cell far below unit size and breaks the
 * equivalence. Lying it down costs width — which there is more of — and lets
 * the cell stay a true unit. It also reads left-to-right, the way children count.
 */
export const TenRod: React.FC<{
  type: string;
  /** Skip the entrance animation when a parent owns the movement. */
  noEnter?: boolean;
  orientation?: "horizontal" | "vertical";
  /** Stronger indigo faces for place-value mats where the block itself carries meaning. */
  highContrast?: boolean;
}> = ({ type, noEnter, orientation = "horizontal", highContrast = false }) => {
  const u = useUnitSize();
  const reduce = useReducedMotion();
  const still = reduce || noEnter;

  const gap = px(u * GAP_RATIO);
  const pad = px(u * PAD_RATIO, 2);
  const cell = px(u * ASSET_RATIO);

  return (
    <motion.div
      initial={still ? false : { scale: 0.5, opacity: 0, y: -14 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={BLOCK_SPRING}
      aria-label="Ten rod"
      className={`inline-flex items-center border-2 shadow-sm ${
        highContrast
          ? "border-indigo-600 bg-indigo-200/80 shadow-indigo-500/15 dark:border-indigo-400 dark:bg-indigo-500/20"
          : "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/10"
      } ${
        orientation === "horizontal" ? "flex-row" : "flex-col"
      }`}
      style={{ gap, padding: pad, borderRadius: px(u * 0.35, 6) }}
    >
      {Array.from({ length: 10 }).map((_, j) => (
        <motion.div
          key={j}
          initial={still ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: still ? 0 : 0.1 + j * 0.03, duration: 0.18 }}
          className={`flex items-center justify-center border ${highContrast
            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-400/30 dark:bg-slate-800"
            : "border-indigo-400/25 bg-white dark:bg-slate-800"
          }`}
          style={{ width: u, height: u, borderRadius: px(u * 0.22, 3) }}
        >
          <CountingAsset type={type as AssetType} size={cell} />
        </motion.div>
      ))}
    </motion.div>
  );
};

/** A single one — the module every other block is measured against. */
export const OneUnit: React.FC<{
  type: string;
  onClick?: () => void;
  isInteractive?: boolean;
  label?: string;
  noEnter?: boolean;
  highContrast?: boolean;
}> = ({ type, onClick, isInteractive, label, noEnter, highContrast = false }) => {
  const u = useUnitSize();
  const reduce = useReducedMotion() || noEnter;
  const badge = px(u * 0.36, 12);

  const content = (
    <>
      <CountingAsset type={type as AssetType} size={px(u * ASSET_RATIO)} />
      {label && (
        <span
          className="absolute bg-indigo-600 text-white font-black rounded-full flex items-center justify-center border border-white dark:border-slate-900"
          style={{
            width: badge,
            height: badge,
            fontSize: px(badge * 0.62, 8),
            bottom: -badge * 0.28,
            right: -badge * 0.28,
          }}
        >
          {label}
        </span>
      )}
    </>
  );

  const base = `flex items-center justify-center border shadow-sm relative select-none ${highContrast
    ? "border-indigo-400 bg-indigo-100 shadow-indigo-500/15 dark:border-indigo-400/40 dark:bg-indigo-500/15"
    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
  }`;
  const style = { width: u, height: u, borderRadius: px(u * 0.28, 6) };

  const enter = {
    initial: reduce ? (false as const) : { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: BLOCK_SPRING,
  };

  return isInteractive ? (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Move one unit into the ten frame"
      {...enter}
      whileHover={reduce ? undefined : { scale: 1.08 }}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      style={style}
      className={`${base} hover:border-indigo-500 hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
    >
      {content}
    </motion.button>
  ) : (
    <motion.div {...enter} style={style} className={base}>
      {content}
    </motion.div>
  );
};
