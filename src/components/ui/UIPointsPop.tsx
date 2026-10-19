import React from "react";

export interface UIPointsPopProps {
  /** The text that rises, e.g. "+3". */
  children: React.ReactNode;
  className?: string;
}

/**
 * "+3" rising from whoever just scored, then gone.
 *
 * Put it inside a `relative` parent. It plays once when it appears (give it a
 * new `key` for each score) and is decoration: the points are also in the
 * number beside it, which is what a screen reader reads.
 */
export const UIPointsPop: React.FC<UIPointsPopProps> = ({ children, className = "" }) => (
  <span aria-hidden="true" className={`ui-points-pop pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-black text-white shadow-sm ${className}`}>
    {children}
  </span>
);
