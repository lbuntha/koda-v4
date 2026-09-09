/**
 * One responsive size ladder for every Multiplication engine.
 *
 * This skill's apparatus grows in two dimensions at once, which addition's and
 * subtraction's mostly do not: a 12 × 12 array is 144 cells and a full times
 * table is 169 including its headers. Both are past what a 360px screen can
 * show at a tappable size, so they step down together and scroll inside their
 * own container — the page itself never scrolls sideways.
 */

export const TOUCH_TARGET = "min-w-11 min-h-11";

export const TOKEN = "w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20";
export const TOKEN_COMPACT = "w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14";
export const DIGIT_CELL = "w-12 h-12 sm:w-14 sm:h-14";

/** A bin holds one group. Its label carries the count; its fill carries the role. */
export const GROUP_BIN = "min-w-24 min-h-24 sm:min-w-28 sm:min-h-28 rounded-2xl p-2";

/**
 * Array and table cells at two densities.
 *
 * Anything past an eight by eight array is dense; the full table is always
 * dense. Mixing the two within one grid would make rows look unequal, which is
 * the one thing an array must never do.
 */
export const GRID_SIZES = {
  roomy: { cell: "w-9 h-9 sm:w-11 sm:h-11", gap: "gap-1.5", text: "text-sm sm:text-base" },
  dense: { cell: "w-6 h-6 sm:w-8 sm:h-8", gap: "gap-1", text: "text-[10px] sm:text-xs" },
} as const;

export type GridDensity = keyof typeof GRID_SIZES;

/** Past this many cells on a side, the grid steps down rather than overflowing. */
export const DENSE_ABOVE = 8;

export const densityFor = (rows: number, cols: number): GridDensity =>
  rows > DENSE_ABOVE || cols > DENSE_ABOVE ? "dense" : "roomy";

/**
 * A wide apparatus scrolls inside itself. The shell owns the page.
 *
 * `min-w-0` is doing the work, and without it none of the rest does anything.
 * Every one of these boxes is a flex item, and a flex item defaults to
 * `min-width: auto` — it refuses to shrink below its content, so a 620px times
 * table sat at 620px inside a 360px parent and pushed the page sideways
 * instead of scrolling. `overflow-x-auto` never engaged, because there was
 * nothing to overflow. Measured in the running app at §12 trap 16.
 */
export const SCROLL_BOX = "overflow-x-auto min-w-0 max-w-full -mx-2 px-2";

/**
 * A times-table cell, and the row and column headers around it.
 *
 * Kept at a real touch size rather than shrunk to fit. Thirteen columns of this
 * is about 470px, which does not fit a 360px screen — so the chart scrolls
 * inside its own container (§6.E) and the page never does. A 12 × 12 chart
 * squeezed down to fit would put 26px targets under a six-year-old's finger,
 * which is a worse answer than a sideways scroll.
 */
export const CHART_CELL = "w-9 h-9 sm:w-11 sm:h-11 text-xs sm:text-sm";
export const CHART_GAP = "gap-0.5 sm:gap-1";

/** A traced row or column: the path the eye follows to the cell. */
export const TRACED = "ring-2 ring-violet-400/60";

/** Edge labels sit outside the grid so no cell is ever partly a label. */
export const EDGE_LABEL =
  "font-black tabular-nums text-sm sm:text-base flex items-center justify-center";

export const COUNT_BADGE =
  "absolute -top-1.5 -right-1.5 w-7 h-7 sm:w-9 sm:h-9 rounded-full font-black " +
  "text-sm sm:text-lg tabular-nums flex items-center justify-center shadow-lg " +
  "ring-[3px] ring-surface";

/**
 * A choice button with words in it.
 *
 * `themeSystem.button(…, "choice")` is a fixed 56px square. That is exactly
 * right for a single digit and exactly wrong for a sentence: "No, one is
 * different" overflowed the box on all four sides and collided with the button
 * beside it, which is what a square with `p-0` does to a phrase. Anything
 * longer than a number or an operator wants this — it sizes to its text, keeps
 * a full touch target, and never wraps mid-word into its neighbour.
 */
export const WORD_CHOICE =
  "min-h-11 rounded-2xl border-2 px-4 py-3 text-base font-bold text-ink " +
  "text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

/** Held is ring + lift, never colour alone. Pair with `aria-pressed`. */
export const HELD = "ring-4 ring-violet-500/70 -translate-y-1 shadow-xl z-10";

/** A selected cell in a pattern hunt: ring + inset, so selection survives colour blindness. */
export const SELECTED = "ring-4 ring-emerald-500/70 ring-inset font-black";

/** The number line's hop arc. */
export const HOP_ARC = "stroke-[3] fill-none";

/**
 * The number line's own geometry, in viewBox units.
 *
 * One line for every hop length: the arcs rise clear of the top edge, the
 * landings are numbered under the line, and a marked target sits below those
 * again, so no two rows of text can ever collide however many hops are made.
 */
export const HOP_LINE = {
  width: 320,
  height: 100,
  inset: 16,
  baseline: 62,
  arcRise: 40,
  landingLabel: 16,
  targetLabel: 32,
} as const;

/**
 * Past this many landings the line stops numbering them.
 *
 * Thirty landings across 320 units is a number every ten units wide; badges
 * that render as an unreadable smudge are worse than none, which is the same
 * call `densityFor` makes for the array.
 */
export const HOP_LABEL_LIMIT = 12;

/**
 * The area model's frame.
 *
 * Its parts are not drawn to true scale — 23 × 46 cannot be at this width — so
 * every part carries its own label and no part is ever allowed to collapse
 * below a readable minimum.
 */
export const AREA_FRAME = "w-full max-w-md aspect-[4/3] rounded-xl";
export const AREA_PART_MIN = "min-w-12 min-h-12";

export const SCENE = "rounded-[2rem] bg-gradient-to-b from-play-sky to-play-ground";
export const ZONE = "rounded-3xl px-4 py-3";

/**
 * A factor tile, and the small numbers a child tries against one.
 *
 * `FactorBoard` puts three of these side by side at 360px, so the tile is sized
 * to fit three plus their operators rather than to be as large as it could be.
 */
export const FACTOR_TILE =
  "min-w-14 min-h-14 sm:min-w-16 sm:min-h-16 rounded-2xl border-2 " +
  "flex items-center justify-center text-2xl sm:text-3xl font-black tabular-nums";

/** One of the numbers offered to divide into a total. */
export const CANDIDATE = "w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 font-black tabular-nums";
