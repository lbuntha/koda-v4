import React from "react";
import { Lightbulb } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "./ThemeUI";

const RING = 2 * Math.PI * 18;

export type UIHintStatus =
  | { state: "locked"; secondsLeft: number }
  | { state: "ready"; rung: number }
  | { state: "exhausted" };

export interface UIHint {
  rung: number;
  text: string;
}

export interface UIHintPanelProps {
  status: UIHintStatus;
  /** The wait before a hint unlocks, so the ring can drain against it. */
  delaySec: number;
  /** How many hints a puzzle offers. */
  totalRungs: number;
  /** The hints already taken, oldest first. */
  hints: readonly UIHint[];
  onTake(): void;
  /** What the button says in each state. */
  buttonLabel: string;
  /** "Hint 2" for a taken hint's chip. */
  hintTitle(rung: number): string;
  /** Spoken description of how many hints are used, e.g. "2 of 3 hints used". */
  progressLabel: string;
}

/**
 * Asking for help, and the help you have been given.
 *
 * The button is a ring that drains while a hint is locked, so the wait is
 * something a child can watch rather than be told; when it unlocks the bulb
 * glows (a few soft rings, then it rests) and the button invites a tap. Under
 * it, dots show how many hints exist and how many are used. Each hint taken
 * slides in as its own card with its number, and glows once, so the new help
 * is easy to find and the old help stays readable.
 */
export const UIHintPanel: React.FC<UIHintPanelProps> = ({ status, delaySec, totalRungs, hints, onTake, buttonLabel, hintTitle, progressLabel }) => {
  const left = status.state === "locked" ? status.secondsLeft : 0;
  const ready = status.state === "ready";

  return (
    <div className="flex flex-col gap-3">
      {hints.length > 0 && (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {hints.map((h) => (
            <li key={h.rung} className="ui-hint-in flex items-start gap-3 rounded-2xl border border-line border-l-4 border-l-indigo-500 bg-white px-3 py-2.5 dark:bg-slate-900">
              <Lightbulb aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300">{hintTitle(h.rung)}</div>
                <div className="text-base font-bold text-ink [overflow-wrap:anywhere]">{h.text}</div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <UIButton
        variant="secondary"
        fullWidth
        disabled={!ready}
        onClick={onTake}
        icon={
          status.state === "locked" ? (
            <svg viewBox="0 0 44 44" aria-hidden="true" className="!h-7 !w-7">
              <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" stroke="currentColor" className="text-line" />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                stroke="currentColor"
                className="origin-center -rotate-90 text-indigo-600 transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - Math.min(1, left / Math.max(1, delaySec)))}
              />
            </svg>
          ) : (
            <span className={`inline-flex rounded-full ${ready ? "ui-glow text-indigo-600 dark:text-indigo-300" : ""}`}>
              <Lightbulb />
            </span>
          )
        }
      >
        {buttonLabel}
      </UIButton>

      <div role="img" aria-label={progressLabel} className={`${themeSystem.typography("caption")} flex justify-center gap-1.5`}>
        {Array.from({ length: totalRungs }, (_, i) => (
          <span key={i} aria-hidden="true" className={`h-2 w-6 rounded-full transition-colors duration-300 ${i < hints.length ? "bg-indigo-600 dark:bg-indigo-400" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
};
