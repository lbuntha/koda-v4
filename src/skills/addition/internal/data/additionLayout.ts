/**
 * How big anything a child touches is, everywhere in this skill.
 *
 * Twelve engines put tappable things on screen — objects in a tray, cells in a
 * frame, blocks in a yard, chips in a chain — and the temptation is for each to
 * pick a size that suits its own composition. Counting learned what that costs:
 * five activities, five target sizes, and a child meeting a different finger
 * target in every lesson of the same skill.
 *
 * One ladder instead, and the steps matter as much as the sizes. The smallest
 * step is the one that has to hold: 44px is roughly where a five-year-old's
 * finger stops missing, so nothing here drops below it at any width.
 */

/** A countable thing in a tray: an apple, a bead, a balloon. */
export const TOKEN = "w-14 h-14 sm:w-20 sm:h-20 lg:w-[88px] lg:h-[88px]";

/** The same object where two groups share the width, as in `count_on`. */
export const TOKEN_COMPACT = "w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16";

/** One cell of a five- or ten-frame. Square-ish at every width, so 5+5 holds. */
export const FRAME_CELL = "h-14 sm:h-16 lg:h-20";

/**
 * Base-ten blocks, in proportion to each other rather than to the screen.
 *
 * A rod that is not visibly ten units and a flat that is not visibly ten rods
 * is a picture of place value rather than a model of it, so the ratios are
 * fixed and only the scale steps with the viewport.
 */
export const BLOCK_UNIT = "w-5 h-5 sm:w-6 sm:h-6";
export const BLOCK_ROD = "w-5 h-[104px] sm:w-6 sm:h-[124px]";
export const BLOCK_FLAT = "w-[104px] h-[104px] sm:w-[124px] sm:h-[124px]";

/** An addend chip in a chain — a number to be tapped, so sized like a button. */
export const CHIP = "min-w-[3.25rem] h-12 sm:min-w-[3.75rem] sm:h-14 px-3";

/** A digit cell in the place-value chart or the column pad. */
export const DIGIT_CELL = "w-12 h-12 sm:w-14 sm:h-14";

/** The badge that numbers a counted object, so it cannot be counted twice. */
export const COUNT_BADGE =
  "absolute -top-1.5 -right-1.5 w-7 h-7 sm:w-9 sm:h-9 rounded-full font-black text-sm sm:text-lg " +
  "tabular-nums flex items-center justify-center shadow-lg ring-[3px] ring-surface";

/**
 * What "held" looks like, for every tap-to-place move in the skill.
 *
 * Tap the source, tap the destination. The state between those two taps is the
 * one thing a child has to be able to see, and it is never colour alone: a ring
 * and a lift, with `aria-pressed` carrying the same fact to a screen reader.
 * Shared because twelve engines showing "held" four different ways is twelve
 * chances to get it wrong once.
 */
export const HELD = "ring-4 ring-violet-500/70 -translate-y-1 shadow-xl z-10";

/**
 * The ground an addition activity happens on.
 *
 * The same theme tokens counting's scene uses (`--koda-play-sky` /
 * `--koda-play-ground`), not Tailwind palette shades — a hardcoded
 * `dark:from-slate-800` is a second definition of the surface waiting to drift.
 */
export const SCENE = "rounded-[2rem] bg-gradient-to-b from-play-sky to-play-ground";

/**
 * A group's own patch of the scene — a soft tint and room to breathe, and
 * deliberately **no border**.
 *
 * One frame per question. The scene is already a container, the round already
 * sits on its own screen, and the kit deliberately draws no card around the
 * question for the same reason: boxes inside boxes is most of what makes a
 * screen feel busy. Two bordered bins inside the scene, each holding a third
 * bordered tile, is what this replaced — three frames deep, all of them saying
 * nothing the spacing and the plus sign were not already saying.
 *
 * Used only where a group needs to read as a *container* rather than as a pile:
 * a closed box whose number is known. An open group of objects gets no patch at
 * all — the objects are the group.
 */
export const BIN = "rounded-3xl px-4 py-3";
