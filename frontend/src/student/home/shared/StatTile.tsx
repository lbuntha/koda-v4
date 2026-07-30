import React from "react";
import type { LucideIcon } from "lucide-react";
import { STAT_ICON } from "./dimensions";

interface Props {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  tone?: "amber" | "violet" | "emerald" | "sky";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  amber: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
  violet: "bg-violet-100 text-violet-500 dark:bg-violet-400/15 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-500 dark:bg-sky-400/15 dark:text-sky-300",
};

/**
 * One headline number. Sized to its content and `whitespace-nowrap` on the caption — a
 * stretched grid cell was clipping "skills mastered" to "skills master…", and a stat you
 * cannot read is not a stat.
 */
export const StatTile: React.FC<Props> = ({ icon: Icon, value, label, tone = "violet" }) => (
  <div className="flex min-w-[104px] flex-1 items-center gap-2 rounded-xl bg-white/95 px-2.5 py-2 shadow-[0_6px_18px_-14px_rgba(47,36,78,0.5)] dark:bg-white/5 dark:shadow-none">
    <span className={`flex shrink-0 items-center justify-center rounded-full ${STAT_ICON} ${TONE[tone]}`}>
      <Icon size={15} className="fill-current/20" />
    </span>
    <div className="min-w-0">
      <p className="text-base font-black leading-none text-[#21183D] sm:text-lg dark:text-[#F2EEFF]">
        {value}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-[10px] font-bold leading-tight text-[#6E6480] dark:text-[#9A94B8]">
        {label}
      </p>
    </div>
  </div>
);
