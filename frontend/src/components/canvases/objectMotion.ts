/**
 * How a draggable object moves, in one place.
 *
 * Two problems this fixes, both of which a child feels rather than sees:
 *
 * - **Position.** Objects used to be placed with `left`/`top`, which the browser
 *   can only satisfy by running layout again — every pointer move, for every
 *   object on the stage. Placing them with the `translate` property instead
 *   keeps the whole drag on the compositor. `translate` is deliberately not
 *   `transform`: the objects also carry Tailwind's `scale-*` and the drop-pop
 *   keyframes, which own `transform`, and the two compose only if they stay on
 *   separate properties.
 *
 * - **Timing.** Every canvas had invented its own easing and duration — 0.25s
 *   here, 0.35s there — so the same apple settled at a different speed depending
 *   on the activity. There is one settle, and it is this one.
 */

import type { CSSProperties } from "react";

/** Settle animation for an object that was let go. */
export const OBJECT_SETTLE = "translate 0.24s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease, opacity 0.2s ease";

export interface ObjectStyleOptions {
  /** Top-left, in stage pixels. */
  x: number;
  y: number;
  /** Edge length, in pixels. */
  size: number;
  dragging?: boolean;
  /** Stacking order when not being dragged. */
  z?: number;
}

/**
 * The inline style every draggable counting object uses.
 *
 * A dragged object gets no transition — it must sit exactly under the finger,
 * not chase it — and is promoted to its own layer for the duration.
 */
export const objectStyle = ({ x, y, size, dragging = false, z = 20 }: ObjectStyleOptions): CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  translate: `${x}px ${y}px`,
  width: `${size}px`,
  height: `${size}px`,
  zIndex: dragging ? 50 : z,
  transition: dragging ? "none" : OBJECT_SETTLE,
  willChange: dragging ? "translate" : undefined,
  touchAction: "none"
});
