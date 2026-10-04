import React from "react";
import { Check } from "lucide-react";

export interface UIStep {
  id: string;
  label: string;
  /** Done: a check in place of the number. */
  complete?: boolean;
  /** Not reachable yet. */
  disabled?: boolean;
}

export interface UIStepperProps {
  steps: UIStep[];
  /** Index of the step on screen. */
  current: number;
  onSelect(index: number): void;
  /** Names the list for a screen reader, e.g. "Steps". */
  label: string;
  className?: string;
}

/**
 * A row of numbered steps joined by a thin line — no boxes around them, so a
 * long flow reads as one path rather than a shelf of buttons.
 *
 * Every step's name shows when the stepper has room. Narrower, only the current step
 * keeps its name and the rest are numbered dots, so eight steps still fit a
 * phone without scrolling sideways; each dot keeps its name for a screen
 * reader and as a tooltip.
 */
export const UIStepper: React.FC<UIStepperProps> = ({
  steps,
  current,
  onSelect,
  label,
  className = "",
}) => (
  /* Sized by its own width, not the window's: in the Studio a sidebar takes
     part of the screen, and a stepper that judged by the window showed every
     name in a space too small for them. */
  <div className={`@container w-full ${className}`}>
    <ol className="flex w-full items-center" aria-label={label}>
      {steps.map((step, i) => {
        const here = i === current;
        const last = i === steps.length - 1;
        return (
          /* Each step as wide as its own name, the line taking what is left —
           equal slots squeezed the long names into the line beside them. */
          <li
            key={step.id}
            className={`flex items-center ${last ? "shrink-0" : "flex-auto"}`}
          >
            <button
              type="button"
              disabled={step.disabled}
              aria-current={here ? "step" : undefined}
              title={step.label}
              onClick={() => onSelect(i)}
              className="group flex min-h-11 shrink-0 items-center gap-2 rounded-full px-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                  here
                    ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-500/25"
                    : step.complete
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "border border-line bg-surface text-muted group-hover:border-indigo-300"
                }`}
              >
                {step.complete && !here ? (
                  <>
                    <span className="sr-only">{i + 1}</span>
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`whitespace-nowrap ${here ? "font-bold text-ink" : "sr-only font-medium text-muted group-hover:text-ink @[80rem]:not-sr-only"}`}
              >
                {step.label}
              </span>
            </button>
            {!last && (
              <span
                aria-hidden="true"
                className={`mx-2 h-px min-w-3 flex-1 ${step.complete ? "bg-indigo-300 dark:bg-indigo-500/50" : "bg-line"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  </div>
);
