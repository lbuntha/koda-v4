/**
 * How big a countable thing is, everywhere in this skill.
 *
 * Five activities all put tappable objects on screen, and they had each picked
 * their own size: 88px scattered, 56px in the comparison, 64px in the ten-frame,
 * 44px dots in the flash. A child moving between lessons met a different target
 * every time, and each size had to be re-checked for overlap and for reach on
 * its own.
 *
 * One ladder instead. The steps matter as much as the sizes: the scattered scene
 * places objects by *percentage*, so an object that stays 88px while the scene
 * narrows eventually overlaps its neighbour. Stepping down with the viewport is
 * what keeps that geometry true — and 56px is still above the ~44px minimum a
 * five-year-old's finger reliably hits.
 */

/** A thing to be counted: a rocket, a butterfly, a leaf. */
export const COUNTABLE = "w-14 h-14 sm:w-20 sm:h-20 lg:w-[88px] lg:h-[88px]";

/** The same object inside a side-by-side comparison, where two groups share the width. */
export const COUNTABLE_COMPACT = "w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16";

/** One cell of a ten-frame. Square-ish at every width, so the 5+5 shape holds. */
export const FRAME_CELL = "h-14 sm:h-16 lg:h-20";

/** The counted-number badge that sits on a tapped object. */
export const COUNT_BADGE =
  "absolute -top-1.5 -right-1.5 w-7 h-7 sm:w-9 sm:h-9 rounded-full font-black text-sm sm:text-lg " +
  "tabular-nums flex items-center justify-center shadow-lg ring-[3px] ring-surface";

/**
 * The ground a counting activity happens on.
 *
 * Sky at the top, meadow at the bottom, so the shadows the artwork carries have
 * something to fall on. Shared rather than repeated per activity, because the
 * whole point is that a child recognises the place they count in.
 *
 * The colours are theme tokens (`--koda-play-sky` / `--koda-play-ground`), not
 * Tailwind palette shades. `index.css` states the rule: a component picks
 * semantic tokens so it is theme-correct by default, and a hardcoded
 * `dark:from-slate-800` is a second definition waiting to drift.
 */
export const SCENE = "rounded-[2rem] bg-gradient-to-b from-play-sky to-play-ground";
