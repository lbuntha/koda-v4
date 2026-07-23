/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NumberPad — a shared on-screen number pad for canvases that take numeric
 * answers from young children, who often can't type and shouldn't have the OS
 * keyboard covering the board on a tablet. Any canvas can render it and wire the
 * three callbacks to its own answer state.
 *
 * Flexible: digits + delete are always there; an optional confirm key appears
 * only when `onEnter` is given (and the lone 0 widens to fill when it isn't),
 * and the accent colours are overridable so it matches the host canvas.
 *
 * Responsive to its *container*, not the viewport: it measures the width it's
 * actually given with a ResizeObserver (the same approach as KodaActor) and
 * steps the pad width, key height, text and icon size across three tiers — so
 * it's big in the full-screen player and compact in a narrow Studio panel, with
 * tap targets that never drop below ~40px. Themes itself for light/dark.
 */

import React, { useEffect, useRef, useState } from "react";
import { Delete, Check } from "lucide-react";

export interface NumberPadProps {
  /** Called with "0".."9" when a digit key is pressed. */
  onDigit: (digit: string) => void;
  /** Called when the delete key is pressed. */
  onBackspace: () => void;
  /** Optional confirm key (e.g. "Check"). Omit it and the 0 key widens to fill. */
  onEnter?: () => void;
  enterDisabled?: boolean;
  /** Content of the confirm key; defaults to a check icon. */
  enterContent?: React.ReactNode;
  /** Text-colour class for the delete icon, e.g. "text-indigo-600 dark:text-indigo-400". */
  accentText?: string;
  /** Solid classes for the confirm key, e.g. "bg-indigo-600 text-white". */
  accentSolid?: string;
  disabled?: boolean;
  className?: string;
}

/** Width tiers, chosen from the space the pad is actually given. */
type Tier = "sm" | "md" | "lg";
const SIZES: Record<Tier, { max: number; key: string; action: string; gap: string; icon: number }> = {
  sm: { max: 232, key: "h-10 text-lg",  action: "h-10", gap: "gap-1.5", icon: 18 },
  md: { max: 280, key: "h-12 text-2xl", action: "h-12", gap: "gap-2",   icon: 22 },
  lg: { max: 324, key: "h-14 text-3xl", action: "h-14", gap: "gap-2.5", icon: 26 },
};

/** Measure the element's own width; drives the tier so the pad tracks its box. */
function useElementWidth(ref: React.RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width;
      if (typeof next === "number") setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

const DIGIT_BASE =
  "flex items-center justify-center rounded-xl font-mono font-black select-none cursor-pointer " +
  "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-slate-700 " +
  "hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-transform " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed";

const ACTION_BASE =
  "flex items-center justify-center rounded-xl select-none cursor-pointer border " +
  "active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

export const NumberPad: React.FC<NumberPadProps> = ({
  onDigit,
  onBackspace,
  onEnter,
  enterDisabled,
  enterContent,
  accentText = "text-indigo-600 dark:text-indigo-400",
  accentSolid = "bg-indigo-600 text-white",
  disabled,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);
  // Until measured, assume medium so the pad doesn't visibly jump on first paint.
  const tier: Tier = width === null ? "md" : width < 300 ? "sm" : width < 560 ? "md" : "lg";
  const size = SIZES[tier];

  const digitKey = `${DIGIT_BASE} ${size.key}`;
  const actionKey = `${ACTION_BASE} ${size.action}`;

  return (
    <div ref={ref} className={`w-full flex justify-center ${className}`}>
      <div
        className={`grid grid-cols-3 ${size.gap} w-full`}
        style={{ maxWidth: size.max }}
        role="group"
        aria-label="Number pad"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} type="button" disabled={disabled} onClick={() => onDigit(String(n))} className={digitKey} aria-label={`Enter ${n}`}>
            {n}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          aria-label="Delete last digit"
          className={`${actionKey} ${accentText} bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700`}
        >
          <Delete style={{ width: size.icon, height: size.icon }} />
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onDigit("0")}
          className={`${digitKey} ${onEnter ? "" : "col-span-2"}`}
          aria-label="Enter 0"
        >
          0
        </button>

        {onEnter && (
          <button
            type="button"
            disabled={disabled || enterDisabled}
            onClick={onEnter}
            aria-label="Check answer"
            className={`${actionKey} border-transparent hover:opacity-90 ${accentSolid}`}
          >
            {enterContent ?? <Check style={{ width: size.icon, height: size.icon }} />}
          </button>
        )}
      </div>
    </div>
  );
};
