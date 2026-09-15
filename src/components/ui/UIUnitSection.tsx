import React from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

export interface UIUnitSectionProps {
  /** Unique on the page — names the panel the header controls. */
  id: string;
  /** What sits in the tile: the unit's number, or an icon for a set like practice. */
  marker: React.ReactNode;
  /** The small line above the title, e.g. "Unit 1". */
  eyebrow: string;
  title: string;
  done: number;
  total: number;
  /** Nothing in the unit can be opened yet. */
  locked?: boolean;
  open: boolean;
  onToggle(): void;
  children: React.ReactNode;
  className?: string;
}

/**
 * One unit of a learning path: a card whose header folds its lessons away.
 *
 * Folding is what lets a path of thirteen units fit on a phone. The page opens
 * the unit a learner is in and leaves the rest as one line each — name, a bar
 * and a count — so finished work and work far ahead are still one tap away but
 * no longer stand between a child and the lesson they came for.
 *
 * The theme's card and indigo, rather than a solid bar in a colour per unit.
 * Those fills cycled through orange and fuchsia, which no other surface in the
 * app wears, and a unit's colour never meant anything a child could use.
 */
export const UIUnitSection: React.FC<UIUnitSectionProps> = ({
  id,
  marker,
  eyebrow,
  title,
  done,
  total,
  locked = false,
  open,
  onToggle,
  children,
  className = "",
}) => {
  const complete = total > 0 && done >= total;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const panelId = `${id}-lessons`;

  return (
    <section className={`${themeSystem.card("default")} overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 p-3 sm:p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-sm font-black [&>svg]:h-5 [&>svg]:w-5 ${
            complete
              ? "bg-indigo-600 text-white"
              : locked
                ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
          }`}
        >
          {complete ? <Check strokeWidth={3} /> : locked ? <Lock /> : marker}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] font-black uppercase tracking-widest text-muted">
            {eyebrow}
          </span>
          <span className="mt-0.5 block text-base font-black leading-tight text-ink line-clamp-2">
            {title}
          </span>
          <span
            aria-hidden="true"
            className="mt-2 block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-muted"
          >
            <span
              className="block h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>

        <span className="shrink-0 font-mono text-xs font-black tabular-nums text-muted">
          {done}/{total}
          <span className="sr-only"> done</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id={panelId} className="border-t border-line p-2 sm:px-3">
          {children}
        </div>
      )}
    </section>
  );
};
