import { useReducedMotion } from "motion/react";

/**
 * Four springs, and no others.
 *
 * The app had seventeen distinct spring configurations and ten durations, often
 * three of them inside one file. That is what "not quite polished" is made of —
 * not missing animation, but every element moving to its own rhythm, so nothing
 * reads as one product.
 *
 * The damping matters as much as the count. A tap at `stiffness 500 / damping
 * 15` is underdamped: it wobbles after the finger has already left, which reads
 * as sloppiness rather than as life. Overshoot is kept for `celebrate`, where it
 * is the whole point.
 */
export const SPRING = {
  /** Button press and release. Fast, tight, settles at once. */
  tap: { type: "spring", stiffness: 500, damping: 22 },
  /** Something arriving on screen. */
  enter: { type: "spring", stiffness: 400, damping: 26 },
  /** Something moving to a place it will stay. */
  settle: { type: "spring", stiffness: 320, damping: 30 },
  /** Reward moments only — the one place a bounce belongs. */
  celebrate: { type: "spring", stiffness: 400, damping: 12 },
} as const;

/**
 * How long to wait before the nth item in a group animates.
 *
 * A set that arrives all at once reads as a page painting; the same set arriving
 * over a few hundred milliseconds reads as things being placed. Capped, because
 * beyond about eight items the tail becomes a wait rather than a flourish.
 */
export const stagger = (index: number, step = 0.06, max = 0.5): number =>
  Math.min(index * step, max);

/**
 * Whether to animate at all.
 *
 * `index.css` already stops the decorative CSS animations for anybody who has
 * asked their system to reduce motion — but a `motion` component animates from
 * JavaScript and never sees that media query, so every activity has to ask.
 *
 * Idle loops are the ones that matter most here: a permanent gentle sway is
 * pleasant to most children and genuinely unpleasant to a vestibular-sensitive
 * one, and it is on screen for the whole lesson rather than for a moment.
 */
export const useMotionOK = (): boolean => !(useReducedMotion() ?? false);

/**
 * A slow, small vertical drift, offset per item so a group never pulses as one.
 *
 * Objects that sit perfectly still read as a screenshot to a young child — they
 * stop looking touchable. Four pixels over three seconds is enough to say "this
 * is alive" without pulling the eye away from the counting.
 */
export const idleFloat = (index: number, on = true) =>
  on
    ? {
        animate: { y: [0, -4, 0] },
        transition: {
          duration: 3 + (index % 3) * 0.4,
          repeat: Infinity,
          ease: "easeInOut" as const,
          delay: (index % 5) * 0.35,
        },
      }
    : {};
