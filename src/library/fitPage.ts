/**
 * Fitting a page to the screen it is read on.
 *
 * A picture book page is meant to be taken in at a glance, not scrolled: the
 * picture and the words belong on the page together. Type sized in `clamp()`
 * already follows the screen's *width*, but nothing there knows how tall the
 * reader's box is, so a long page on a short phone — or a phone held sideways,
 * or a large-text setting — still spilled below the fold.
 *
 * So the reader measures the box it was given and, when a page overflows it,
 * works out one factor that brings it back: the type and the picture both scale
 * by it, so the page shrinks as a whole rather than the words shrinking around a
 * picture that stays put. The factor only ever shrinks — `MAX` is the page's own
 * size — and it stops at `MIN`, below which a child would be squinting; past
 * that the page scrolls, as it did before. The reader's own text-size choice
 * multiplies the result, so "larger text" always makes text larger.
 *
 * Kept as plain numbers so the behaviour can be tested without a screen.
 */

/** The smallest a page may be squeezed before it is left to scroll instead. */
export const FIT_MIN = 0.72;
/** A page that already fits is drawn at its own size. */
export const FIT_MAX = 1;

/** Ignore a correction smaller than this, so a page cannot flutter between two sizes. */
const DEADBAND = 0.02;
/** Leave a hair of room, so rounding cannot leave a page one pixel too tall. */
const SLACK = 0.99;

/**
 * The factor to draw a page at next, given the one it is drawn at now and how
 * tall it turned out against the box it has to sit in. Returns `current`
 * unchanged when the page already fits, when the correction is too small to be
 * worth a redraw, or when nothing could be measured (a page that has not been
 * laid out yet, or a test with no layout at all).
 */
export function nextFit(current: number, contentPx: number, availablePx: number): number {
  if (!(contentPx > 0) || !(availablePx > 0)) return current;
  const wanted = clampFit(current * (availablePx / contentPx) * SLACK);
  // Growing back is only ever a return towards the page's own size, so a page
  // that has room to spare walks up while one that overflows walks down.
  return Math.abs(wanted - current) < DEADBAND ? current : wanted;
}

/** A fit factor held inside the range a page may be drawn at. */
export const clampFit = (n: number): number => Math.min(FIT_MAX, Math.max(FIT_MIN, Math.round(n * 1000) / 1000));
