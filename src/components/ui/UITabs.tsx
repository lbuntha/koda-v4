import React from "react";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";

/**
 * No `= string` default on `T`.
 *
 * With one, a tab list typed as a union still inferred `T` as `string` at the
 * call site, and the `onChange` handler for the narrow union no longer matched —
 * so every use needed the type argument written out. Requiring `T` lets it
 * infer from the items, which is the point of the generic.
 */
export interface UITabItem<T extends string> {
  id: T;
  label: string;
  /** A small figure beside the label — lesson count, features on, entries logged. */
  count?: number | string;
}

export interface UITabsProps<T extends string> {
  items: readonly UITabItem<T>[];
  value: T;
  /**
   * `NoInfer` matters here.
   *
   * A `useState` setter is `(value: T | ((prev: T) => T)) => void`, and passing
   * one let inference take that whole union as a candidate for `T`. It fails the
   * `extends string` constraint, so `T` fell back to plain `string` and the
   * narrow handler no longer matched its own tab list. Keeping this parameter
   * out of inference lets `items` and `value` decide `T`, which is what they are
   * for.
   */
  onChange: (id: NoInfer<T>) => void;
  /** Names the set for a screen reader when no visible heading does. */
  label?: string;
  className?: string;
}

/**
 * One row of pills, one panel shown at a time.
 *
 * The pills are the same pressable geometry as every other button, so a tab row
 * needs no new visual language — what marks the current one is the primary
 * fill. Panels stay with the caller: this owns the switch, not what is switched.
 *
 * Arrow keys move between tabs and only the current one is tabbable, which is
 * what `role="tablist"` promises a screen reader.
 */
export function UITabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = "",
}: UITabsProps<T>) {
  const select = (id: T) => {
    if (id === value) return;
    playSound("pop");
    onChange(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const at = items.findIndex((item) => item.id === value);
    const next = items[(at + step + items.length) % items.length];
    select(next.id);
    // Follow the selection with focus, or the next arrow press starts over.
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[(at + step + items.length) % items.length]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(item.id)}
            className={`${themeSystem.button(selected ? "primary" : "secondary", "sm")} transition-none active:translate-y-0 active:border-b-4`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`font-mono text-[11px] ${selected ? "opacity-80" : "opacity-60"}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
