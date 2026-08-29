import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue, useTransform, type MotionValue } from "motion/react";

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
   * Where the element's centre actually is on the glass, live.
   *
   * Motion values rather than numbers, and derived here rather than left to the
   * caller to add up. A consumer that reacted to position by reading `anchor`
   * out of React state got the *first* render's value — zeros, before anything
   * had been measured — and a `useTransform` built on it never recomputed when
   * the real measurement arrived, because its own input had not changed. The
   * result looked right or wrong purely by where the element happened to start.
   */
  centreX: MotionValue<number>;
  centreY: MotionValue<number>;
  /** Where CSS parked it, before any drag, plus its measured size. */
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

/**
 * Where CSS put the element, ignoring any drag offset on it.
 *
 * `offsetLeft`/`offsetTop` are layout metrics: a transform does not move them,
 * which is the whole point of using them here. Deriving the same thing as
 * `rect - transform` looks equivalent and is not — the rect and the motion
 * value are written at different times, so any read that happens between them
 * pairs an old position with a new offset and lands a screen-width out. That is
 * survivable right up until StrictMode double-invokes the effect, at which
 * point the error compounds instead of cancelling.
 *
 * The walk up `offsetParent` is for the case where an ancestor transform makes
 * itself the containing block; with none, `offsetParent` is null on a fixed
 * element and the loop is a single step.
 */
const anchorOf = (el: HTMLElement): { left: number; top: number } => {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top };
};

/** How far the element may travel from where CSS put it, per edge. */
interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
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
  /* The untransformed centre, as motion values, so anything derived from
     position recomputes the moment a measurement lands. */
  const baseCentreX = useMotionValue(0);
  const baseCentreY = useMotionValue(0);
  const centreX = useTransform([x, baseCentreX], ([dx, cx]: number[]) => cx + dx);
  const centreY = useTransform([y, baseCentreY], ([dy, cy]: number[]) => cy + dy);

  /*
   * How far it may travel from where CSS put it. Subtracting the live transform
   * recovers the untouched position, which is what the limits are relative to.
   */
  const measure = useCallback((): Bounds | null => {
    const el = ref.current;
    if (!el) return null;
    const { left: baseLeft, top: baseTop } = anchorOf(el);
    const width = el.offsetWidth;
    const height = el.offsetHeight;

    /*
     * The visual viewport, not `innerWidth`/`innerHeight`.
     *
     * On a phone those two are not the same thing: the layout is built against
     * `100dvh` while `innerHeight` follows the browser's chrome, so they
     * disagree by the height of the URL bar for as long as it is on screen.
     */
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;

    /*
     * The resting place is always legal.
     *
     * Each edge is widened to include zero, and that one line is the whole fix
     * for a bug worth spelling out: while the two viewport heights disagreed,
     * `bottom` came out *negative* — the CSS anchor was, arithmetically, below
     * the floor. The clamp below then dutifully pulled a control that was
     * sitting exactly where it belonged up the screen, and did it again on
     * every resize the URL bar caused, walking Koda to the top of a phone.
     *
     * A limit that forbids the position CSS chose is a limit that is wrong, not
     * a position that is. Zero stays reachable and the clamp can only ever
     * rescue something genuinely stranded.
     */
    const next = {
      left: Math.min(margin - baseLeft, 0),
      right: Math.max(vw - margin - width - baseLeft, 0),
      top: Math.min(margin - baseTop, 0),
      bottom: Math.max(vh - margin - height - baseTop, 0),
    };
    setLimits(next);
    setAnchor({ left: baseLeft, top: baseTop, width, height });
    baseCentreX.set(baseLeft + width / 2);
    baseCentreY.set(baseTop + height / 2);
    /* A phone that rotated, or a window that shrank, can leave this outside the
       screen it is now on. Pull it back rather than stranding a control that is
       meant to be always reachable. */
    x.set(Math.min(Math.max(x.get(), next.left), next.right));
    y.set(Math.min(Math.max(y.get(), next.top), next.bottom));
    return next;
  }, [baseCentreX, baseCentreY, margin, x, y]);

  useEffect(() => {
    /*
     * Measure *before* restoring, then restore already clamped.
     *
     * The anchor is derived as `rect - transform`, so both have to come from
     * the same moment. Setting the offset first and measuring after cannot be
     * made reliable: the write reaches the DOM on Motion's own animation frame,
     * so reading the rect in this tick — or even in a frame of our own — can
     * pair the untransformed rect with the restored offset and put the anchor a
     * screen-width away. Every limit computed from it was then nonsense, which
     * is why a position saved on a larger screen was never pulled back at all.
     *
     * At mount `x`/`y` are still zero, so the rect *is* the anchor. Measuring
     * here needs no synchronisation, and the stored spot is clamped against
     * limits that are already known to be right.
     */
    const bounds = measure();
    const spot = readSpot(storageKey);
    if (spot && bounds) {
      x.set(Math.min(Math.max(spot.x, bounds.left), bounds.right));
      y.set(Math.min(Math.max(spot.y, bounds.top), bounds.bottom));
    }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    /* The visual viewport moves without a `resize` — a URL bar collapsing, a
       keyboard opening — and those are exactly the moments the limits go
       stale. */
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [measure, storageKey, x, y]);

  return {
    x,
    y,
    centreX,
    centreY,
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
