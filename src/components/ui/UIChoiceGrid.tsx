import React from "react";
import { Check, X } from "lucide-react";

export interface UIChoiceGridProps {
  options: readonly string[];
  /** Answers already tried and wrong: crossed out and not tappable again. */
  tried?: ReadonlySet<string>;
  /** The answer just chosen and right, shown with a tick. */
  chosen?: string | null;
  disabled?: boolean;
  onPick(option: string): void;
  /** Names the group for a screen reader, e.g. "Choose your answer". */
  label: string;
}

const LETTERS = ["A", "B", "C", "D"];

/**
 * Answers to tap.
 *
 * One column on a phone and two beside each other from a tablet up, each a big
 * target with its letter. A wrong tap crosses that answer out (with an X and a
 * shake, never colour alone) and leaves the rest to try; a right one gets a
 * tick. A hint that takes a wrong answer away simply stops listing it.
 */
export const UIChoiceGrid: React.FC<UIChoiceGridProps> = ({ options, tried, chosen = null, disabled = false, onPick, label }) => (
  <div role="group" aria-label={label} className="grid gap-2 sm:grid-cols-2">
    {options.map((option, i) => {
      const wrong = tried?.has(option) ?? false;
      const right = chosen === option;
      return (
        <button
          key={option}
          type="button"
          disabled={disabled || wrong || chosen !== null}
          onClick={() => onPick(option)}
          className={`relative flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2 text-left text-lg font-black text-ink transition-colors duration-200 active:scale-[0.98] motion-reduce:transition-none dark:bg-slate-900 ${
            right
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
              : wrong
                ? "ui-shake border-rose-300 text-muted line-through opacity-70"
                : "border-line hover:border-indigo-400 focus-visible:border-indigo-500 dark:hover:border-indigo-500/60"
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
              right ? "bg-emerald-500 text-white" : wrong ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            }`}
          >
            {right ? <Check className="h-4 w-4" /> : wrong ? <X className="h-4 w-4" /> : LETTERS[i]}
          </span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{option}</span>
        </button>
      );
    })}
  </div>
);
