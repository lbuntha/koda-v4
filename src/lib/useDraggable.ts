import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, type MotionValue } from "motion/react";

/**
 * Make one thing draggable anywhere in the window, and keep it there.
 *
 * Everything a floating control needs and nothing about what it looks like:
 * the gesture, the edges it may not cross, remembering where it was left, and
 * telling a click apart from the end of a drag. `KodaBuddy` is the first user;
 * anything else that should float and be moved — a scratchpad, a timer, a
 * picture-in-picture tutor — gets the same behaviour by calling this rather
 * than by writing the same four problems again.
 *
 * Positioning stays the caller's: place the element with CSS wherever it should
 * start, and this moves it *from* there. That is why the limits are measured
 * rather than computed — the resting spot may be an anchor plus a tab bar's
 * clearance plus a safe-area inset, and re-deriving that sum here would be a
 * second copy of it.
 */

export interface UseDraggableOptions {
  /**
   * `localStorage` key to remember the position under. Omit and the element
   * returns to its CSS position on every load.
   */
  storageKey?: string;
  /** Kept this far from every window edge. */
  margin?: number;
}

export interface Draggable<T extends HTMLElement> {
  /** Live offset from the CSS position. Read these to react to where it is. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /**
   * Where CSS parked it, before any drag, plus its measured size. Combine with
   * `x`/`y` to get a position on the glass — which is what anything reacting to
   * *where* the element is needs.
   */
  anchor: { left: number; top: number; width: number; height: number };
  /**
   * Whether the gesture that just ended was a drag rather than a tap. Check it
   * first in a click handler, or parking the element fires the click too.
   */
  wasDragged(): boolean;
  /** Spread onto the `motion` element that should move. */
  dragProps: {
    ref: React.MutableRefObject<T | null>;
    drag: true;
    dragConstraints: { left: number; right: number; top: number; bottom: number };
    dragElastic: number;
    dragMomentum: boolean;
    onPointerDown(): void;
    onDragStart(): void;
    onDragEnd(): void;
    style: { x: MotionValue<number>; y: MotionValue<number>; touchAction: "none" };
  };
}

interface Spot {
  x: number;
  y: number;
}

const readSpot = (key: string | undefined): Spot | null => {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Spot>;
    if (typeof value?.x !== "number" || typeof value?.y !== "number") return null;
    return { x: value.x, y: value.y };
  } catch {
    /* Private mode, blocked storage, or something else wrote nonsense here. A
       control in its default corner is a fine outcome; a crash is not. */
    return null;
  }
};

export function useDraggable<T extends HTMLElement>({
  storageKey,
  margin = 8,
}: UseDraggableOptions = {}): Draggable<T> {
  const ref = useRef<T | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  /* Set while a gesture is travelling, so the click that ends a drag is not
     also treated as a tap. A ref, not state: it is read inside the click that
     immediately follows, which no re-render would be in time for. */
  const dragged = useRef(false);
  const [limits, setLimits] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [anchor, setAnchor] = useState({ left: 0, top: 0, width: 0, height: 0 });

  /*
   * How far it may travel from where CSS put it. Subtracting the live transform
   * recovers the untouched position, which is what the limits are relative to.
   */
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const baseLeft = box.left - x.get();
    const baseTop = box.top - y.get();
    const next = {
      left: margin - baseLeft,
      right: window.innerWidth - margin - box.width - baseLeft,
      top: margin - baseTop,
      bottom: window.innerHeight - margin - box.height - baseTop,
    };
    setLimits(next);
    setAnchor({ left: baseLeft, top: baseTop, width: box.width, height: box.height });
    /* A phone that rotated, or a window that shrank, can leave this outside the
       screen it is now on. Pull it back rather than stranding a control that is
       meant to be always reachable. */
    x.set(Math.min(Math.max(x.get(), next.left), next.right));
    y.set(Math.min(Math.max(y.get(), next.top), next.bottom));
  }, [margin, x, y]);

  useEffect(() => {
    const spot = readSpot(storageKey);
    if (spot) {
      x.set(spot.x);
      y.set(spot.y);
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure, storageKey, x, y]);

  return {
    x,
    y,
    anchor,
    wasDragged: () => dragged.current,
    dragProps: {
      ref,
      drag: true,
      dragConstraints: limits,
      /* No overshoot and no glide: this is a thing being put somewhere, not
         thrown. Whoever lets go over a button expects it to stay off that
         button. */
      dragElastic: 0,
      dragMomentum: false,
      /* Every gesture starts clean. Without this the flag is only ever cleared
         by a drag that ended properly, so one `pointercancel` — a notification
         sheet, a second finger, the browser taking the gesture for itself —
         would leave it set and the element would never accept a tap again. */
      onPointerDown: () => {
        dragged.current = false;
      },
      onDragStart: () => {
        dragged.current = true;
      },
      onDragEnd: () => {
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify({ x: x.get(), y: y.get() }));
          } catch {
            /* Storage refused. It still moved; it just will not be remembered. */
          }
        }
        /* Cleared after the click that ends this gesture has been and gone. */
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      },
      style: { x, y, touchAction: "none" },
    },
  };
}
