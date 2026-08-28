import React from "react";

/**
 * The app's on/off switch, and the row it usually sits in.
 *
 * There were seven copies of this button before, one per settings page, drifting
 * a pixel and a focus ring apart from each other. There is one now: a switch is
 * not a page's idea, it is the app's, and a person who learns what one looks
 * like on Settings should recognise it on the Ask Koda page without thinking.
 *
 * `tone` exists because the two greens mean different things in this app —
 * emerald reads "this is running", indigo reads "you chose this" — and the
 * pages that use each were consistent about it before this component existed.
 */
export const UIToggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  /** For screen readers: what this switch is, not what it does. */
  label: string;
  disabled?: boolean;
  tone?: "indigo" | "emerald";
}> = ({ checked, onChange, label, disabled = false, tone = "indigo" }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={[
      "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
      "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      checked
        ? tone === "emerald"
          ? "bg-emerald-600"
          : "bg-indigo-600"
        : "bg-slate-300 dark:bg-slate-700",
    ].join(" ")}
  >
    <span
      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
        checked ? "left-6" : "left-1"
      }`}
    />
  </button>
);

/**
 * One switched thing: what it is, what it does, and the switch.
 *
 * The shape every settings surface in the app repeats. Taking it as a component
 * rather than a copied `<div>` is what keeps a disabled row looking disabled
 * everywhere, which matters on the Ask Koda page: half of it greys out together
 * when the master switch goes off, and a row that missed the memo reads as a
 * bug rather than as a consequence.
 */
export const UIToggleRow: React.FC<{
  title: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  tone?: "indigo" | "emerald";
  /** Drawn beside the title — a badge, a "$0.002 a call" note, anything small. */
  aside?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, description, checked, onChange, disabled, tone, aside, icon }) => (
  <div
    className={`flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted p-4 transition-opacity ${
      disabled ? "opacity-60" : ""
    }`}
  >
    <div className="flex min-w-0 items-start gap-3">
      {icon && <span className="mt-0.5 shrink-0 text-muted">{icon}</span>}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-mono text-sm font-bold text-ink">{title}</h4>
          {aside}
        </div>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
    </div>
    <UIToggle
      checked={checked}
      onChange={onChange}
      label={title}
      disabled={disabled}
      tone={tone}
    />
  </div>
);
