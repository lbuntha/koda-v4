import React from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Optional trailing link, e.g. "See all activities". */
  action?: { label: string; onClick: () => void };
  tone?: "violet" | "rose" | "emerald" | "sky";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
};

/** Section label used by every band section, so headings stay identical across the page. */
export const SectionHeader: React.FC<Props> = ({ icon: Icon, title, subtitle, action, tone = "violet" }) => (
  <div className="flex items-end justify-between gap-3">
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE[tone]}`}>
        <Icon size={15} />
      </span>
      <div>
        <h2 className="text-base font-black text-[#332750] dark:text-[#E4DEFF]">{title}</h2>
        {subtitle && (
          <p className="text-[11px] font-bold text-[#6E6480] dark:text-[#8F87AC]">{subtitle}</p>
        )}
      </div>
    </div>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-[#5C46DF] hover:underline dark:text-[#C3B4FF]"
      >
        {action.label} <ArrowRight size={13} />
      </button>
    )}
  </div>
);
