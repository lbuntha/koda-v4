import React, { useEffect, useRef, useState } from "react";

const prefersReducedMotion = (): boolean => {
  try {
    // No matchMedia (a test, an old browser) means no animation: the number is simply right.
    return typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

export interface UICountUpProps {
  value: number;
  /** How long the climb takes. Short on purpose: it should feel like a tick, not a wait. */
  durationMs?: number;
  /** Where to start on first show, to climb from (0 for "you earned 28 XP"). Missing: show the value at once. */
  startAt?: number;
  className?: string;
  format?(n: number): string;

  "aria-hidden"?: boolean;
}

/**
 * A number that climbs to its new value instead of jumping.
 *
 * Used where points or XP are added, so a child sees the total grow rather
 * than find it changed. It only moves up or down to a new value (it does not
 * replay on every render), eases out so the last steps are slow, lands exactly
 * on the value, and stands still for a player who asked for less motion.
 */
export const UICountUp: React.FC<UICountUpProps> = ({ value, durationMs = 700, startAt, className = "", format = String, "aria-hidden": hidden }) => {
  const [shown, setShown] = useState(startAt ?? value);
  const from = useRef(startAt ?? value);

  useEffect(() => {
    if (value === from.current) return;
    if (prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(origin + (value - origin) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, durationMs]);

  return (
    <span className={className} aria-hidden={hidden}>
      {format(shown)}
    </span>
  );
};
