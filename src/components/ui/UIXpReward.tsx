import React from "react";
import { Sparkles } from "lucide-react";
import { UIBurst } from "./UIBurst";
import { UICountUp } from "./UICountUp";

export interface UIXpRewardProps {
  xp: number;
  title: string;
  message?: string;
  /** How the number is written, e.g. `(n) => "+" + n + " XP"`. */
  format(n: number): string;
}

/**
 * XP earned, counted up so it feels earned.
 *
 * A quiet card: a small medallion, the title, and the XP climbing from zero to
 * what was won, with one small burst when it lands. The final number is in the
 * markup the whole time for a screen reader; the climb is only for the eyes.
 */
export const UIXpReward: React.FC<UIXpRewardProps> = ({ xp, title, message, format }) => (
  <div className="relative flex items-center gap-4 rounded-3xl border-2 border-indigo-200 bg-white p-4 dark:border-indigo-800 dark:bg-slate-900">
    <UIBurst className="left-12 top-6" />
    <span className="ui-pop-in flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
      <Sparkles aria-hidden="true" className="h-6 w-6" />
    </span>
    <div role="status" className="min-w-0 flex-1">
      <div className="text-lg font-black text-ink">{title}</div>
      {message && <p className="text-sm font-bold text-body">{message}</p>}
    </div>
    {/* The label is the final amount, so a screen reader never reads the numbers on the way up. */}
    <span role="img" aria-label={format(xp)} className="shrink-0">
      <UICountUp value={xp} startAt={0} durationMs={900} format={format} className="font-mono text-2xl font-black text-indigo-600 dark:text-indigo-300" />
    </span>
  </div>
);
