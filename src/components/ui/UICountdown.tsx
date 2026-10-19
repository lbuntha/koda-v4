import React from "react";
import { Hourglass } from "lucide-react";

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The last seconds: ten, or a fifth of the time, whichever comes first. */
export const isLowTime = (secondsLeft: number, totalSeconds: number): boolean =>
  secondsLeft > 0 && (secondsLeft <= 10 || secondsLeft / Math.max(1, totalSeconds) <= 0.2);

export interface UICountdownProps {
  secondsLeft: number;
  totalSeconds: number;
  /** What a screen reader says, e.g. "23 seconds left". Changes are not announced every second. */
  label: string;
  className?: string;
}

/**
 * How much time is left, as a ring that empties.
 *
 * Calm and indigo while there is plenty. In the last seconds the ring turns
 * rose and beats gently, so a child feels the time without a number having to
 * be read; at zero it shows an hourglass. State is never colour alone: the
 * seconds are written in the middle, and the hourglass says "out of time".
 */
export const UICountdown: React.FC<UICountdownProps> = ({ secondsLeft, totalSeconds, label, className = "" }) => {
  const out = secondsLeft <= 0;
  const low = isLowTime(secondsLeft, totalSeconds);
  const share = Math.min(1, Math.max(0, secondsLeft / Math.max(1, totalSeconds)));
  const stroke = out || low ? "text-rose-500" : "text-indigo-600 dark:text-indigo-400";

  return (
    <div role="timer" aria-label={label} aria-live="off" className={`relative inline-flex h-14 w-14 shrink-0 items-center justify-center ${low ? "ui-tick" : ""} ${className}`}>
      <svg viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="4" stroke="currentColor" className="text-line" />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke="currentColor"
          className={`${stroke} transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none`}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        />
      </svg>
      {out ? <Hourglass aria-hidden="true" className="h-5 w-5 text-rose-500" /> : <span className={`text-base font-black leading-none ${low ? "text-rose-600 dark:text-rose-300" : "text-ink"}`}>{Math.ceil(secondsLeft)}</span>}
    </div>
  );
};
