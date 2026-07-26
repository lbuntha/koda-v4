import React from "react";

interface Props {
  /** 0–1. Clamped, so a bad value cannot overflow the track. */
  value: number;
  label?: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "violet" | "emerald" | "amber" | "rose";
  /** Draws a handle at the current value — reads as "you are here" rather than a plain fill. */
  knob?: boolean;
  /** Taller track for the skill-path card. */
  size?: "sm" | "md";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  violet: "bg-[#5C46DF] dark:bg-[#A48BFF]",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  rose: "bg-rose-500 dark:bg-rose-400",
};

const KNOB_TONE: Record<NonNullable<Props["tone"]>, string> = {
  violet: "bg-[#5C46DF] ring-white dark:bg-[#A48BFF] dark:ring-[#191338]",
  emerald: "bg-emerald-500 ring-white dark:bg-emerald-400 dark:ring-[#191338]",
  amber: "bg-amber-500 ring-white dark:bg-amber-400 dark:ring-[#191338]",
  rose: "bg-rose-500 ring-white dark:bg-rose-400 dark:ring-[#191338]",
};

/** One meter shape for every progress reading on the learner pages. */
export const ProgressMeter: React.FC<Props> = ({
  value,
  label,
  trailing,
  tone = "violet",
  knob = false,
  size = "sm",
}) => {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      {(label || trailing) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-black text-[#4D4263] dark:text-[#C7BFE4]">
          <span className="truncate">{label}</span>
          {trailing && <span className="shrink-0 font-bold text-[#6E6480] dark:text-[#9A94B8]">{trailing}</span>}
        </div>
      )}
      <div
        className={`relative rounded-full bg-[#EBE6F8] dark:bg-white/10 ${size === "md" ? "h-2.5" : "h-2"} ${knob ? "" : "overflow-hidden"}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${TONE[tone]}`}
          style={{ width: `${pct}%` }}
        />
        {knob && (
          <span
            aria-hidden
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] transition-[left] duration-700 ${KNOB_TONE[tone]}`}
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
};
