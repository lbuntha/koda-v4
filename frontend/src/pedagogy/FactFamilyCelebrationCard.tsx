/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Sparkles, Award } from "lucide-react";

export interface FactFamilyCelebrationCardProps {
  isSolved: boolean;
  factFamilyText?: string;
  numberBond?: { part1: number | string; part2: number | string; total: number | string };
  isDark?: boolean;
  className?: string;
}

/**
 * Celebratory Number Bond and Fact Family card pop-over.
 * Slides up gracefully above the Helper Footer upon puzzle or task completion (`isSolved = true`)
 * to reinforce inverse algebraic connections (e.g., if 3 + 2 = 5, then 5 - 3 = 2).
 */
export const FactFamilyCelebrationCard: React.FC<FactFamilyCelebrationCardProps> = ({
  isSolved,
  factFamilyText,
  numberBond,
  isDark = false,
  className = ""
}) => {
  if (!isSolved) return null;

  return (
    <div
      className={`w-full max-w-lg mx-auto rounded-2xl border-2 p-3 my-1 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg animate-bounce-short transition-all duration-300 z-20 ${
        isDark
          ? "bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-emerald-950/90 border-emerald-500/60 text-emerald-200 shadow-emerald-500/10"
          : "bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-emerald-400 text-emerald-900 shadow-emerald-500/15"
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md animate-pulse flex-shrink-0">
          <Award size={22} />
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-extrabold uppercase tracking-wider text-emerald-500">
            <Sparkles size={13} className="text-emerald-500 animate-spin" />
            <span>Fact Family Unlocked!</span>
          </div>
          <p className="text-xs font-bold leading-tight mt-0.5">
            {factFamilyText || (numberBond ? `Fact Family: ${numberBond.part1} + ${numberBond.part2} = ${numberBond.total}  •  ${numberBond.total} - ${numberBond.part1} = ${numberBond.part2}` : "Brilliant counting! You mastered the mathematical structure!")}
          </p>
        </div>
      </div>

      {numberBond && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-black text-xs shadow-inner flex-shrink-0 ${
          isDark ? "bg-slate-900 border-emerald-500/40 text-emerald-300" : "bg-emerald-100/70 border-emerald-300 text-emerald-800"
        }`}>
          <span className="text-emerald-500">{numberBond.part1}</span>
          <span className="opacity-50">+</span>
          <span className="text-emerald-500">{numberBond.part2}</span>
          <span className="opacity-50">=</span>
          <span className="text-lg text-emerald-600 font-extrabold">{numberBond.total}</span>
        </div>
      )}
    </div>
  );
};
