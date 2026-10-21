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

/** The smallest a page may be squeezed before it is left to scroll instead. */
export const FIT_MIN = 0.72;
/** A page that already fits is drawn at its own size. */
export const FIT_MAX = 1;

/** How many halvings the search makes: 8 narrow the 0.28 range to about 0.001. */
const PROBES = 8;

/**
 * The largest factor, between `FIT_MIN` and `FIT_MAX`, at which the page fits.
 *
 * `heightAt` draws the page at a factor and says how tall it came out; the
 * reader gives it the page itself, so the answer is the real wrap of the real
 * words — Khmer included — and not an estimate. A page only gets shorter as the
 * factor falls, which is what makes a halving search right: it settles in
 * `PROBES + 2` draws, all before the browser paints, where a loop of redraws
 * took a render each and could show the page at a size it was about to leave.
 *
 * A page that fits at its own size is left alone, one that cannot fit even at
 * the floor gets the floor (and scrolls), and a page that could not be measured
 * (no layout yet, a test) is left at its own size.
 */
export function solveFit(heightAt: (fit: number) => number, availablePx: number): number {
  if (!(availablePx > 0)) return FIT_MAX;
  const fits = (fit: number) => {
    const h = heightAt(fit);
    return !(h > 0) || h <= availablePx;
  };
  if (fits(FIT_MAX)) return FIT_MAX;
  if (!fits(FIT_MIN)) return FIT_MIN;
  let lo = FIT_MIN;
  let hi = FIT_MAX;
  for (let i = 0; i < PROBES; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return clampFit(lo);
}

/** A fit factor held inside the range a page may be drawn at. */
export const clampFit = (n: number): number => Math.min(FIT_MAX, Math.max(FIT_MIN, Math.round(n * 1000) / 1000));

/**
 * How much of the page's squeeze the words take.
 *
 * A page that does not fit has to give up height somewhere, and it should not
 * give it all up in one place: the words are what a child is here to read and
 * the picture is what can lose a little without being lost. So the picture is
 * scaled by the whole factor twice over — it shrinks fastest — and the words by
 * half of it, which keeps them readable for longer before the page falls back to
 * scrolling. Squeezed to the floor (0.72) the picture is about half its height
 * and the words are still 0.86 of theirs, rather than both being 0.72.
 */
export const wordsFit = (fit: number): number => 1 - (1 - fit) / 2;
