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
 * searches for the one factor that brings it back (`solveFit`). The type and the
 * picture both scale by it, so the page shrinks as a whole rather than the words shrinking around a
 * picture that stays put. The factor only ever shrinks — `MAX` is the page's own
 * size — and it stops at `MIN`, below which a child would be squinting; past
 * that the page scrolls, as it did before. The reader's own text-size choice
 * multiplies the result, so "larger text" always makes text larger.
 *
 * Kept as plain numbers so the behaviour can be tested without a screen.
 */

/**
 * The smallest a page's picture may be squeezed before the page is left to scroll
 * instead. The picture shrinks with the square of this, and it is the picture that
 * gives way: the words have their own floor (`WORDS_MIN`).
 */
export const FIT_MIN = 0.55;
/** A page that already fits is drawn at its own size. */
export const FIT_MAX = 1;

/** The smallest the book's words are set, however much a page has to say. */
export const WORDS_MIN = 0.86;

/** How many halvings the search makes: 8 narrow the 0.28 range to about 0.001. */
const PROBES = 8;

/**
 * The largest factor, between `min` and `max`, at which the page fits.
 *
 * `heightAt` draws the page at a factor and says how tall it came out; the
 * reader gives it the page itself, so the answer is the real wrap of the real
 * words — Khmer included — and not an estimate. A page only gets shorter as the
 * factor falls, which is what makes a halving search right: it settles in
 * `PROBES + 2` draws, all before the browser paints, where a loop of redraws
 * took a render each and could show the page at a size it was about to leave.
 *
 * A page that fits at `max` is left alone, one that cannot fit even at `min`
 * gets `min` (and scrolls), and a page that could not be measured (no layout
 * yet, a test) is left at `max`.
 */
export function solveFit(heightAt: (fit: number) => number, availablePx: number, min = FIT_MIN, max = FIT_MAX): number {
  if (!(availablePx > 0)) return max;
  const fits = (fit: number) => {
    const h = heightAt(fit);
    return !(h > 0) || h <= availablePx;
  };
  if (fits(max)) return max;
  if (!fits(min)) return min;
  let lo = min;
  let hi = max;
  for (let i = 0; i < PROBES; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 1000) / 1000;
}

/** A fit factor held inside the range a page may be drawn at. */
export const clampFit = (n: number): number => Math.min(FIT_MAX, Math.max(FIT_MIN, Math.round(n * 1000) / 1000));
