import React from "react";

export type ProgressBarSize = "sm" | "md" | "lg";
export type ProgressBarTone = "primary" | "emerald";

export interface UIProgressBarProps {
  value: number;
  max: number;
  /**
   * Names the bar for a screen reader. Leave it out where the number is already
   * said as text inside a control (a row that is one big button) — a
   * progressbar nested in a button is read inconsistently, so there the bar is
   * decoration and the text does the work.
   */
  label?: string;
  /** A line under the bar, e.g. "3 of 15 lessons complete". */
  caption?: React.ReactNode;
  size?: ProgressBarSize;
  /** `primary` is the primary button's colour. No amber: yellow is hard to read here. */
  tone?: ProgressBarTone;
  /** On a coloured banner: a see-through white track, a white fill and caption. */
  onColor?: boolean;
  className?: string;
}

const HEIGHT: Record<ProgressBarSize, string> = { sm: "h-1.5", md: "h-2", lg: "h-3" };
const FILL: Record<ProgressBarTone, string> = { primary: "bg-indigo-600", emerald: "bg-emerald-500" };

/**
 * The slim progress bar — a track, a fill and, if given, a caption beneath.
 * Every list row, card and banner draws its progress with this one, so the
 * heights, colours and rounding stay the same wherever a learner sees "how far".
 * For a bar a learner fills towards a reward, use `UIRewardProgress`.
 */
export const UIProgressBar: React.FC<UIProgressBarProps> = ({
  value,
  max,
  label,
  caption,
  size = "md",
  tone = "primary",
  onColor = false,
  className = "",
}) => {
  const safeMax = Math.max(1, max);
  const shown = Math.min(Math.max(0, value), safeMax);
  const percent = (shown / safeMax) * 100;

  const bar = (
    <span
      className={`block w-full overflow-hidden rounded-full ${HEIGHT[size]} ${onColor ? "bg-white/30" : "bg-surface-muted"}`}
      {...(label
        ? { role: "progressbar", "aria-label": label, "aria-valuenow": shown, "aria-valuemin": 0, "aria-valuemax": max }
        : { "aria-hidden": true })}
    >
      <span
        className={`block h-full rounded-full transition-[width] duration-500 ease-out ${onColor ? "bg-white" : FILL[tone]}`}
        /* A visible stub once anything is done: 1 of 52 is a dot nobody reads as progress. */
        style={{ width: percent > 0 ? `max(${percent}%, 0.75rem)` : 0 }}
      />
    </span>
  );

  if (!caption) return <span className={`block ${className}`}>{bar}</span>;
  return (
    <span className={`flex flex-col gap-1.5 ${className}`}>
      {bar}
      <span className={`text-sm font-semibold tabular-nums ${onColor ? "text-white/90" : "text-muted"}`}>{caption}</span>
    </span>
  );
};
