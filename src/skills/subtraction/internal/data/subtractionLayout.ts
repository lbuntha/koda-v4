/**
 * One responsive size ladder for every Subtraction engine.
 *
 * Visual base-ten units may be smaller to preserve their 1:10 geometry, but
 * their interactive wrappers use `TOUCH_TARGET`. Every control therefore keeps
 * the 44px coarse-pointer floor at the smallest supported viewport.
 */

export const TOUCH_TARGET = "min-w-11 min-h-11";

export const TOKEN = "w-14 h-14 sm:w-20 sm:h-20 lg:w-[88px] lg:h-[88px]";
export const TOKEN_COMPACT = "w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16";
export const FRAME_CELL = "h-14 sm:h-16 lg:h-20";
export const BOND_NODE = "min-w-16 min-h-14 sm:min-w-20 sm:min-h-16";
export const DIGIT_CELL = "w-12 h-12 sm:w-14 sm:h-14";

export const BLOCK_UNIT = "w-5 h-5 sm:w-6 sm:h-6";
export const BLOCK_ROD = "w-5 h-[104px] sm:w-6 sm:h-[124px]";
export const BLOCK_FLAT = "w-[104px] h-[104px] sm:w-[124px] sm:h-[124px]";

export const COUNT_BADGE =
  "absolute -top-1.5 -right-1.5 w-7 h-7 sm:w-9 sm:h-9 rounded-full font-black " +
  "text-sm sm:text-lg tabular-nums flex items-center justify-center shadow-lg " +
  "ring-[3px] ring-surface";

/** Held is ring + lift, never colour alone. Pair with `aria-pressed`. */
export const HELD = "ring-4 ring-violet-500/70 -translate-y-1 shadow-xl z-10";

/** Removed is strike + displacement + opacity, never faded colour alone. */
export const REMOVED = "opacity-45 translate-y-2 after:absolute after:inset-x-1 after:top-1/2 " +
  "after:h-1 after:-rotate-12 after:rounded-full after:bg-rose-600";

export const SCENE = "rounded-[2rem] bg-gradient-to-b from-play-sky to-play-ground";
export const ZONE = "rounded-3xl px-4 py-3";

/**
 * Base-ten geometry at two densities.
 *
 * A desk holding nine flats cannot use the roomy size at 360px, and mixing
 * sizes within one scene would break the 1:10:100 reading the blocks exist to
 * show — so the whole scene steps down together when it is crowded.
 */
export const BLOCK_SIZES = {
  roomy: { unit: BLOCK_UNIT, rod: BLOCK_ROD, flat: BLOCK_FLAT },
  dense: {
    unit: "w-3 h-3 sm:w-4 sm:h-4",
    rod: "w-3 h-[62px] sm:w-4 sm:h-[82px]",
    flat: "w-[62px] h-[62px] sm:w-[82px] sm:h-[82px]",
  },
} as const;

export type BlockDensity = keyof typeof BLOCK_SIZES;
