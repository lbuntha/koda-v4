import React from "react";
import { Zap } from "lucide-react";

interface Props {
  value: number;
}

/** A short reward cue on mount/value change; it never loops or competes with navigation. */
export const AnimatedXpPill: React.FC<Props> = ({ value }) => (
  <span
    key={value}
    className="kid-xp-pill inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full bg-[#F8FAFD] px-2.5 text-[10px] font-black text-[#3F4654] ring-1 ring-[#EDF0F5] sm:px-3 sm:text-xs dark:bg-white/5 dark:text-[#E4DEFF] dark:ring-white/10"
    aria-label={`${value} experience points`}
    title="XP earned"
  >
    <span className="kid-xp-bolt relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFC928] text-white shadow-sm shadow-amber-400/40">
      <Zap size={9} className="fill-current" />
    </span>
    <span className="relative z-10 tabular-nums">{value}</span>
  </span>
);
