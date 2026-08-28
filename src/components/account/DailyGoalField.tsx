import React from "react";
import { Minus, Plus, Target } from "lucide-react";

import { DAILY_GOAL_MAX, DAILY_GOAL_MIN } from "../../lib/dailyGoal";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";

/**
 * How many rounds a day, as a control two very different readers can use.
 *
 * A stepper rather than a slider or a number field: the range is small, the
 * numbers are whole, and the two people who set this are a parent glancing at a
 * child's card and a learner setting their own — neither of whom should have to
 * be accurate with a drag or a keyboard.
 *
 * It owns no state. Whoever draws it decides where the number is kept, because
 * a parent is editing somebody else's goal and a student their own.
 */
export const DailyGoalField: React.FC<{
  value: number;
  onChange(value: number): void;
  /** Says whose goal this is when that is not obvious from the surroundings. */
  label?: string;
  hint?: string;
  disabled?: boolean;
}> = ({ value, onChange, label = "Daily goal", hint, disabled = false }) => {
  const step = (by: number) => {
    const next = Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, value + by));
    if (next === value) return;
    playSound("pop");
    onChange(next);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-amber-500">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h4 className="font-mono text-sm font-bold text-ink">{label}</h4>
          <p className="text-xs text-muted">{hint ?? "Rounds to finish each day"}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || value <= DAILY_GOAL_MIN}
          aria-label={`Lower ${label.toLowerCase()}`}
          className={themeSystem.button("secondary", "sm")}
        >
          <Minus />
        </button>
        <span
          className="w-8 text-center font-mono text-lg font-black tabular-nums text-ink"
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled || value >= DAILY_GOAL_MAX}
          aria-label={`Raise ${label.toLowerCase()}`}
          className={themeSystem.button("secondary", "sm")}
        >
          <Plus />
        </button>
      </div>
    </div>
  );
};
