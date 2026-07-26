import React from "react";
import { Flame } from "lucide-react";

/** Day streak, from the real activity signal. Renders nothing at zero — no empty brag. */
export const StreakChip: React.FC<{ days: number }> = ({ days }) => {
  if (days <= 0) return null;
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-xs font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
      <Flame size={14} className="fill-current" />
      {days} day{days === 1 ? "" : "s"}
      <span className="hidden sm:inline">streak</span>
    </span>
  );
};
