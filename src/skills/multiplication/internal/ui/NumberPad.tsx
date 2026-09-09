import React from "react";
import { themeSystem } from "../../../../lib/themeSystem";

/**
 * Ten digits and a delete.
 *
 * A child who has to produce a number rather than choose between four needs
 * somewhere to put it, and choice tiles stop working the moment a product runs
 * to three digits. Digits rather than whole numbers, because a pad of every
 * number up to a hundred and forty-four is not a pad.
 *
 * Deliberately unaware of what it is filling in: it reports a digit and a
 * delete, and the activity decides where those land.
 */
export interface NumberPadProps {
  onDigit(digit: string): void;
  onDelete(): void;
  disabled?: boolean;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

export const NumberPad: React.FC<NumberPadProps> = ({ onDigit, onDelete, disabled }) => (
  <div className="mx-auto flex max-w-[24rem] flex-wrap items-center justify-center gap-2">
    {DIGITS.map((digit) => (
      <button
        key={digit}
        type="button"
        onClick={() => onDigit(digit)}
        disabled={disabled}
        aria-label={`Digit ${digit}`}
        className={themeSystem.button("secondary", "choice")}
      >
        {digit}
      </button>
    ))}
    <button
      type="button"
      onClick={onDelete}
      disabled={disabled}
      aria-label="Delete"
      className={themeSystem.button("secondary", "choice")}
    >
      ⌫
    </button>
  </div>
);
