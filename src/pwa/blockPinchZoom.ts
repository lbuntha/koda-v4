/**
 * Holds the page at 1× on iOS.
 *
 * Two of the three guards against zoom are declarative — `user-scalable=no` in
 * the viewport meta, `touch-action: pan-x pan-y` in `index.css` — and neither is
 * enough on its own for Safari. It has ignored `user-scalable=no` since iOS 10
 * as an accessibility decision, and its pinch gesture arrives as the non-standard
 * `gesturestart`/`gesturechange` pair, which is dispatched alongside the touch
 * stream rather than through it, so `touch-action` does not cancel it.
 *
 * This is what actually stops the pinch there. It is deliberately the *third*
 * layer and not the only one: a JavaScript listener does nothing until the
 * bundle has run, and the CSS holds the line before then.
 *
 * `doubleTapZoom` is Safari's other route to the same place. `touch-action`
 * covers it on paper, but only where the target inherits that rule — a canvas or
 * a drag surface that sets its own `touch-action: none` opts out of the
 * inheritance and gets the double-tap back. Cancelling the second tap of a fast
 * pair is exactly what a counting grid needs.
 *
 * Nothing here touches the OS accessibility zoom, which is a system setting and
 * not this app's to override.
 */
export const blockPinchZoom = (): (() => void) => {
  const stop = (event: Event) => event.preventDefault();

  /* Not `passive`, or the browser is entitled to ignore `preventDefault`. */
  const options: AddEventListenerOptions = { passive: false };
  const gestures = ["gesturestart", "gesturechange", "gestureend"] as const;

  for (const name of gestures) document.addEventListener(name, stop, options);

  /*
   * The second tap of a pair, within the window Safari treats as a double tap.
   *
   * Only the tap that would zoom is cancelled — a single tap is never delayed
   * and never swallowed, so a button still fires on the first touch.
   */
  const DOUBLE_TAP_MS = 320;
  let lastTouchEnd = 0;
  const onTouchEnd = (event: TouchEvent) => {
    const now = event.timeStamp;
    if (now - lastTouchEnd <= DOUBLE_TAP_MS) event.preventDefault();
    lastTouchEnd = now;
  };
  document.addEventListener("touchend", onTouchEnd, options);

  return () => {
    for (const name of gestures) document.removeEventListener(name, stop, options);
    document.removeEventListener("touchend", onTouchEnd, options);
  };
};
