/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hold the zoom still inside an activity, and only there.
 *
 * Dragging ten counters into a ten-frame with two fingers is indistinguishable from a pinch,
 * so an activity that lets the page zoom mid-drag throws the learner's target out from under
 * them. Suppressing that is worth it on the canvas.
 *
 * It is not worth it everywhere. The same handlers registered on `window` also take away
 * ⌘/Ctrl-scroll zoom from the parent dashboard, the admin console and the curriculum studio —
 * adults reading dense tables on a laptop, and a WCAG 1.4.4 (Resize Text) failure for anyone
 * who needs larger text. Scoping to the element is what keeps both properties.
 *
 * Returns a ref to attach to the surface that should not zoom.
 */

import { useEffect, useRef } from "react";

export function useZoomLock<T extends HTMLElement>(enabled: boolean = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const block = (event: Event) => event.preventDefault();
    const blockZoomWheel = (event: WheelEvent) => {
      // A trackpad pinch arrives as a wheel event with ctrlKey set; an ordinary scroll
      // must still pass through, or the activity cannot be scrolled at all.
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };

    // Safari-only gesture events; harmlessly absent elsewhere, where the viewport meta
    // already prevents pinch-zoom.
    node.addEventListener("gesturestart", block);
    node.addEventListener("gesturechange", block);
    node.addEventListener("gestureend", block);
    node.addEventListener("wheel", blockZoomWheel, { passive: false });

    return () => {
      node.removeEventListener("gesturestart", block);
      node.removeEventListener("gesturechange", block);
      node.removeEventListener("gestureend", block);
      node.removeEventListener("wheel", blockZoomWheel);
    };
  }, [enabled]);

  return ref;
}
