/**
 * Small building blocks for Trace Studio: icon buttons with a tooltip that
 * names the tool and its shortcut, collapsible panel sections, fields, and
 * the little drawings used as icons for stroke shapes.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export const inputCls =
  "min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-900";

interface IconButtonProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
  /** Where the tooltip appears. */
  tip?: "right" | "bottom" | "top";
  size?: "sm" | "md";
  tone?: "default" | "danger";
}

export function IconButton({ label, shortcut, active, disabled, onClick, children, tip = "bottom", size = "md", tone = "default" }: IconButtonProps) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const place =
    tip === "right" ? "left-full top-1/2 ml-2 -translate-y-1/2" : tip === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "top-full left-1/2 mt-2 -translate-x-1/2";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex ${box} shrink-0 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-violet-600 text-white shadow-sm"
          : tone === "danger"
            ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/50"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-900 ${place}`}
      >
        {label}
        {shortcut && <kbd className="ml-2 rounded bg-white/15 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-900/10">{shortcut}</kbd>}
      </span>
    </button>
  );
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return <span aria-hidden="true" className={vertical ? "mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" : "my-1 h-px w-6 bg-slate-200 dark:bg-slate-700"} />;
}

export function Section({ title, aside, defaultOpen = true, children }: { title: string; aside?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">{aside}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">{children}</div>}
    </section>
  );
}

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange(v: number): void; format?(v: number): string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-mono normal-case tabular-nums">{format ? format(value) : Math.round(value * 100) / 100}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-violet-600" />
    </label>
  );
}

/** A segmented control whose options are icons with tooltips. */
export function IconSegment<T extends string>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: string; icon: ReactNode }[]; onChange(v: T): void; disabled?: boolean }) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map((o) => (
        <IconButton key={o.value} label={o.label} size="sm" active={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.icon}
        </IconButton>
      ))}
    </div>
  );
}

/* ------------------------------------------------ shape icons (24×24) */

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const ShapeIcon = {
  line: () => (
    <Svg>
      <path d="M12 4v16" />
    </Svg>
  ),
  arc: () => (
    <Svg>
      <path d="M4 17C6 7 18 7 20 17" />
    </Svg>
  ),
  curve: () => (
    <Svg>
      <path d="M4 17C6 7 18 7 20 17" />
    </Svg>
  ),
  hook: () => (
    <Svg>
      <path d="M9 3v11c0 4 3 6 6 5s3-3 2-4" />
    </Svg>
  ),
  loop: () => (
    <Svg>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5l2-2M12 5l2 2" />
    </Svg>
  ),
  dot: () => (
    <Svg>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </Svg>
  ),
  zigzag: () => (
    <Svg>
      <path d="M3 16l4.5-8 4.5 8 4.5-8 4.5 8" />
    </Svg>
  ),
  wave: () => (
    <Svg>
      <path d="M3 12c2.5-5 5.5-5 7.5 0s5 5 7.5 0 2.5-2 3-2" />
    </Svg>
  ),
  free: () => (
    <Svg>
      <path d="M4 18c3-9 5 2 8-5s5-3 8-8" />
    </Svg>
  ),
  rectangle: () => (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="1" />
    </Svg>
  ),
  square: () => (
    <Svg>
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </Svg>
  ),
  triangle: () => (
    <Svg>
      <path d="M12 4 21 19H3Z" />
    </Svg>
  ),
  circle: () => (
    <Svg>
      <circle cx="12" cy="12" r="8" />
    </Svg>
  ),
  polygon: () => (
    <Svg>
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z" />
    </Svg>
  ),
  bendUp: () => (
    <Svg>
      <path d="M4 18C7 6 17 6 20 18" />
      <path d="M12 3v4M10 5l2-2 2 2" />
    </Svg>
  ),
  bendDown: () => (
    <Svg>
      <path d="M4 6c3 12 13 12 16 0" />
      <path d="M12 21v-4M10 19l2 2 2-2" />
    </Svg>
  ),
};
