import React from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  /** Icon tint; the tile itself stays neutral so a row of them reads as one group. */
  tone?: "amber" | "violet" | "emerald" | "sky";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
};

/** One headline number: streak, XP, skills mastered. */
export const StatTile: React.FC<Props> = ({ icon: Icon, value, label, tone = "violet" }) => (
  <div className="flex items-center gap-2.5 rounded-2xl bg-white/80 px-3 py-2.5 dark:bg-white/5">
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${TONE[tone]}`}>
      <Icon size={16} />
    </span>
    <div className="min-w-0">
      <p className="text-lg font-black leading-none text-[#21183D] dark:text-[#F2EEFF]">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-bold text-[#6E6480] dark:text-[#9A94B8]">{label}</p>
    </div>
  </div>
);
