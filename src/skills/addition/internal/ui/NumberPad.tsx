import React from "react";
import { motion } from "motion/react";
import { SPRING } from "../../../kit";
import { themeSystem } from "../../../../lib/themeSystem";

/**
 * Ten digits and a delete.
 *
 * A child who has to *produce* a number rather than choose between four needs
 * somewhere to put it, and choice tiles stop working the moment an answer can
 * be two digits. Digits rather than whole numbers for the same reason: a pad of
 * every number up to a hundred is not a pad.
 *
 * Deliberately unaware of what it is filling in. It reports a digit and a
 * delete; which box those land in belongs to the activity, because only the
 * activity knows whether a bond has one blank or four.
 */
export interface NumberPadProps {
  onDigit(digit: string): void;
  onDelete(): void;
  /** Greyed out when there is nowhere to type — no blank selected, or it is full. */
  disabled?: boolean;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

export const NumberPad: React.FC<NumberPadProps> = ({ onDigit, onDelete, disabled }) => (
  <div className="flex flex-wrap items-center justify-center gap-2 max-w-[24rem] mx-auto">
    {DIGITS.map((digit) => (
      <motion.button
        key={digit}
        type="button"
        onClick={() => onDigit(digit)}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.08, y: -2 }}
        whileTap={disabled ? undefined : { scale: 0.9, y: 2 }}
        transition={SPRING.tap}
        aria-label={`Digit ${digit}`}
        className={themeSystem.button("secondary", "choice")}
      >
        {digit}
      </motion.button>
    ))}
    <motion.button
      type="button"
      onClick={onDelete}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={SPRING.tap}
      aria-label="Delete"
      className={themeSystem.button("secondary", "choice")}
    >
      ⌫
    </motion.button>
  </div>
);
