import React from "react";

/**
 * Digits, for the answers that are not a choice between four numbers.
 *
 * From level 22 on, an answer is a *pair* — three remainder two — and offering
 * four of those as buttons would be offering four complete answers to compare
 * with each other. Typing one is the only way a child has to commit to a
 * quotient and a remainder they worked out rather than recognised.
 *
 * Division's own rather than a shared one: addition has a pad in its `internal/`
 * folder and a skill may not reach into another's internals. Thirty lines is the
 * price of that rule.
 */

export interface NumberPadProps {
  /** Called with the digit tapped, 0-9. */
  onDigit(digit: number): void;
  onBackspace(): void;
  onSubmit(): void;
  disabled?: boolean;
  /** Greyed out until the answer is complete enough to check. */
  canSubmit?: boolean;
  submitLabel?: string;
}

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export const NumberPad: React.FC<NumberPadProps> = ({
  onDigit,
  onBackspace,
  onSubmit,
  disabled,
  canSubmit = true,
  submitLabel = "Check",
}) => (
  <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
    <div className="grid grid-cols-5 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onDigit(key)}
          disabled={disabled}
          aria-label={`Digit ${key}`}
          className="min-h-11 rounded-xl bg-surface py-2 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30"
        >
          {key}
        </button>
      ))}
    </div>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onBackspace}
        disabled={disabled}
        aria-label="Delete the last digit"
        className="min-h-11 flex-1 rounded-xl bg-surface py-2 text-base text-muted shadow-sm disabled:opacity-30"
      >
        ⌫
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !canSubmit}
        className="min-h-11 flex-[2] rounded-xl bg-indigo-600 py-2 text-base font-bold text-white shadow-sm disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  </div>
);
