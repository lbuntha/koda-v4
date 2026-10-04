import React from "react";

export type RewardProgressTone = "primary" | "emerald" | "sky" | "rose";

export interface UIRewardProgressProps {
  value: number;
  max: number;
  /** Names the bar for a screen reader, e.g. "Daily quest progress". */
  label: string;
  /** What the learner is working towards, drawn at the end. Defaults to a chest; `null` draws none. */
  reward?: React.ReactNode | null;
  tone?: RewardProgressTone;
  /** On a dark surface (the round-complete card): a see-through track and a light count. */
  onDark?: boolean;
  className?: string;
}

/**
 * `primary` is the primary button's colour, so a bar and the button beside it
 * read as one theme. No amber: yellow is hard to read in this app.
 */
const FILL: Record<RewardProgressTone, string> = {
  primary: "bg-indigo-600",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
};

/**
 * A chest, closed until the bar is full and then open. Drawn in the primary colour rather
 * than the gold and brown a chest usually is — yellow tones are off-limits here.
 */
export const RewardChest: React.FC<{ open?: boolean; className?: string }> = ({ open = false, className = "" }) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
    {/* body */}
    <rect x="4" y="17" width="32" height="19" rx="3" className="fill-indigo-800" />
    <rect x="4" y="17" width="5" height="19" rx="2" className="fill-indigo-300" />
    <rect x="31" y="17" width="5" height="19" rx="2" className="fill-indigo-300" />
    {open ? (
      <>
        {/* lid raised and tipped back, a glow where it opened */}
        <rect x="8" y="14" width="24" height="4" rx="2" className="fill-white/90" />
        <path d="M5 13 L8 3 H32 L35 13 Z" className="fill-indigo-600" />
        <rect x="5" y="11" width="30" height="3" rx="1.5" className="fill-indigo-300" />
      </>
    ) : (
      <>
        <path d="M4 18 V11 a7 7 0 0 1 7-7 H29 a7 7 0 0 1 7 7 V18 Z" className="fill-indigo-600" />
        <rect x="4" y="4" width="5" height="14" rx="2" className="fill-indigo-300" />
        <rect x="31" y="4" width="5" height="14" rx="2" className="fill-indigo-300" />
        {/* lock */}
        <rect x="16" y="14" width="8" height="10" rx="2" className="fill-indigo-100" />
        <circle cx="20" cy="18" r="1.6" className="fill-indigo-800" />
        <rect x="19.3" y="18.5" width="1.4" height="3" rx="0.7" className="fill-indigo-800" />
      </>
    )}
  </svg>
);

/**
 * A thick progress bar with the count written inside it and the reward at its
 * end — the shape a child reads as "fill this up to get that".
 *
 * The count is drawn twice: once in grey on the track and once in white on the
 * fill, clipped to the fill's width. Wherever the fill reaches, the number
 * turns white, so it stays readable at any value instead of being grey on
 * colour or white on grey for half the bar.
 */
export const UIRewardProgress: React.FC<UIRewardProgressProps> = ({
  value,
  max,
  label,
  reward,
  tone = "primary",
  onDark = false,
  className = "",
}) => {
  const safeMax = Math.max(1, max);
  const shown = Math.min(Math.max(0, value), safeMax);
  const percent = (shown / safeMax) * 100;
  const complete = shown >= safeMax;
  const count = `${shown} / ${max}`;
  /* A visible stub once anything is done: 1 of 52 is a sliver nobody reads as progress. */
  const fill = percent > 0 ? `max(${percent}%, 1.25rem)` : "0px";
  const end = reward === undefined ? <RewardChest open={complete} className="h-full w-full" /> : reward;

  return (
    <div className={`flex items-center ${className}`}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={shown}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={count}
        className={`relative h-5 min-w-0 flex-1 overflow-hidden rounded-full ${onDark ? "bg-white/15" : "bg-slate-200 dark:bg-slate-700"}`}
      >
        <span className={`absolute inset-0 grid place-items-center text-xs font-black tabular-nums ${onDark ? "text-white/70" : "text-slate-500 dark:text-slate-300"}`}>
          {count}
        </span>
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${FILL[tone]}`}
          style={{ width: fill }}
        />
        {/* The white copy is clipped to exactly the fill's width, so the two
            numbers line up and the colour change follows the fill's edge. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center text-xs font-black tabular-nums text-white transition-[clip-path] duration-500 ease-out"
          style={{ clipPath: `inset(0 calc(100% - ${fill}) 0 0)` }}
        >
          {count}
        </span>
      </div>
      {end && <span className="-ml-2.5 h-9 w-9 shrink-0 drop-shadow-sm">{end}</span>}
    </div>
  );
};
